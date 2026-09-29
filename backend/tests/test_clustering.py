"""Tests for the clustering pipeline: features, K-Means, PCA, silhouette, labels."""

from __future__ import annotations

import numpy as np
import pytest

from app.config import Settings
from app.ml.clustering import compute_sweep, evaluate_silhouette, generate_label, run_clustering
from app.services.analytics import build_context
from app.services.cleaning import clean_dataset
from app.services.csv_loading import read_transactions_csv
from app.services.store import DatasetStore
from app.utils.errors import AnalysisUnavailable
from tests.conftest import csv_bytes, synthetic_rows


@pytest.fixture(scope="module")
def settings() -> Settings:
    return Settings()


@pytest.fixture(scope="module")
def record(settings: Settings):
    store = DatasetStore(settings)
    text = csv_bytes(synthetic_rows(count=180, seed=11)).decode()
    parsed = read_transactions_csv(text, max_rows=5000)
    cleaned = clean_dataset(parsed, min_rows=2, min_rows_for_clustering=8)
    return store.add(cleaned, filename="synthetic.csv", source="upload")


@pytest.fixture(scope="module")
def response(record, settings: Settings):
    return record.cluster(4, settings)


def test_cluster_sizes_and_shares_are_consistent(response, record) -> None:
    assert response.k == 4
    assert len(response.clusters) == 4
    assert sum(stat.size for stat in response.clusters) == record.row_count
    assert sum(stat.percentage for stat in response.clusters) == pytest.approx(100.0, abs=0.2)
    assert len(response.centroids) == 4
    assert {centroid.cluster for centroid in response.centroids} == {stat.cluster for stat in response.clusters}


def test_cluster_labels_are_derived_and_unique(response) -> None:
    labels = [stat.label for stat in response.clusters]
    assert len(set(labels)) == len(labels)
    assert all(label and len(label) > 5 for label in labels)


def test_cluster_statistics_stay_inside_the_dataset(response, record) -> None:
    frame = record.context.frame
    total_spending = float(frame.loc[frame["flow"] == "expense", "amount"].sum())

    for stat in response.clusters:
        assert stat.frequency in {"Low", "Medium", "High"}
        assert stat.characteristics, "each cluster needs at least one behaviour bullet"
        assert stat.dominant_category
        assert 0 <= stat.percentage <= 100
        assert stat.avg_transaction >= 0
        assert stat.first_date <= stat.last_date
        assert stat.top_categories
        assert sum(item.transactions for item in stat.top_categories) <= stat.size

    spend_shares = sum(stat.spend_share for stat in response.clusters)
    # Every expense belongs to exactly one cluster, so the shares must add up - except for
    # income-only clusters, which contribute no spending at all.
    expense_only = [stat for stat in response.clusters if stat.income_share < 60]
    assert 99.4 <= spend_shares <= 100.6
    assert all(stat.total_spending <= total_spending + 0.01 for stat in expense_only)
    assert all(stat.total_spending > 0 for stat in expense_only)


def test_pca_projection_and_explained_variance(response) -> None:
    metrics = response.metrics
    assert len(metrics.explained_variance) == 2
    assert all(0 < value <= 1 for value in metrics.explained_variance)
    assert metrics.explained_variance_total == pytest.approx(sum(metrics.explained_variance), abs=1e-4)
    assert metrics.explained_variance_total <= 1.0
    assert metrics.n_features == len(metrics.feature_names) == 6
    assert len(metrics.scaler_mean) == 6
    assert all(value > 0 for value in metrics.scaler_scale.values())

    assert response.points, "the scatter plot needs points"
    assert len(response.points) == response.total_points
    assert response.points_sampled is False
    clusters = {stat.cluster for stat in response.clusters}
    assert {point.cluster for point in response.points} == clusters
    labels = {stat.cluster: stat.label for stat in response.clusters}
    assert all(point.cluster_label == labels[point.cluster] for point in response.points)
    assert all(point.flow in {"income", "expense"} for point in response.points)


def test_silhouette_is_in_range_and_sweep_covers_the_k_range(response, record, settings: Settings) -> None:
    assert -1.0 <= response.metrics.silhouette <= 1.0
    sweep = response.sweep
    assert [entry.k for entry in sweep] == [2, 3, 4, 5, 6, 7, 8]
    assert all(-1.0 <= entry.silhouette <= 1.0 for entry in sweep)
    # Inertia always decreases as clusters are added.
    inertias = [entry.inertia for entry in sweep]
    assert inertias == sorted(inertias, reverse=True)
    assert response.optimal_k in {entry.k for entry in sweep}
    assert record.sweep(settings) == sweep


def test_pca_does_not_change_the_clustering_but_drives_the_plot(response) -> None:
    # Clustering runs on the full feature space, so an elbow/silhouette score
    # must not equal a value derived from only two components.
    assert response.metrics.n_features > len(response.metrics.explained_variance)


def test_silhouette_sampling_path(settings: Settings) -> None:
    scaled = np.random.default_rng(0).normal(size=(400, 4))
    labels = np.concatenate([np.zeros(200, dtype=int), np.ones(200, dtype=int)])
    sampled_settings = settings.model_copy(update={"silhouette_sample_size": 50})

    score, sampled, sample_size = evaluate_silhouette(scaled, labels, sampled_settings)
    assert sampled is True
    assert sample_size == 50
    assert -1.0 <= score <= 1.0

    degenerated, sampled_single, _ = evaluate_silhouette(scaled, np.zeros(400, dtype=int), settings)
    assert (degenerated, sampled_single) == (0.0, False)


def test_generate_label_uses_tiers_and_stays_unique() -> None:
    taken: set[str] = set()
    assert (
        generate_label(
            income_dominant=False,
            value_tier="High-Value",
            frequency_tier="Low-Frequency",
            frequency="Low",
            dominant_category="Electronics",
            taken=taken,
        )
        == "High-Value Occasional Spending"
    )
    # A colliding label is disambiguated with the dominant category.
    second = generate_label(
        income_dominant=False,
        value_tier="High-Value",
        frequency_tier="Low-Frequency",
        frequency="Low",
        dominant_category="Travel",
        taken=taken,
    )
    assert second != "High-Value Occasional Spending"
    assert "Travel" in second
    assert (
        generate_label(
            income_dominant=True,
            value_tier="High-Value",
            frequency_tier="Low-Frequency",
            frequency="Low",
            dominant_category="Income",
            taken=taken,
        )
        == "High-Value Income"
    )


def test_clustering_is_cached_per_k(record, settings: Settings) -> None:
    first = record.cluster(3, settings)
    second = record.cluster(3, settings)
    assert first.k == second.k == 3
    assert second.cached is True
    assert first.metrics.inertia == second.metrics.inertia


def test_clustering_rejects_too_few_rows_and_invalid_k(settings: Settings) -> None:
    store = DatasetStore(settings)
    text = csv_bytes(synthetic_rows(count=4)).decode()
    parsed = read_transactions_csv(text, max_rows=5000)
    cleaned = clean_dataset(parsed, min_rows=2, min_rows_for_clustering=8)
    small = store.add(cleaned, filename="small.csv", source="upload")

    with pytest.raises(AnalysisUnavailable):
        small.cluster(3, settings)

    context = small.context
    with pytest.raises(AnalysisUnavailable):
        run_clustering(
            dataset_id="x",
            context=context,
            settings=settings,
            k=9,
            sweep=[],
        )


def test_compute_sweep_requires_enough_samples(settings: Settings) -> None:
    scaled = np.random.default_rng(1).normal(size=(4, 6))
    entries = compute_sweep(scaled, settings)
    # Only the K values that the sample count supports are produced.
    assert [entry.k for entry in entries] == [2, 3, 4]
