"""K-Means clustering, PCA projection, silhouette scoring and label generation."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timezone

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import StandardScaler

from app.config import Settings
from app.ml.features import FEATURE_SPECS, FeatureMatrix, build_feature_matrix
from app.schemas.clustering import (
    CategoryBreakdown,
    Centroid,
    ClusterMetrics,
    ClusterPoint,
    ClusterResponse,
    ClusterStat,
    KSweepEntry,
)
from app.services.analytics import DatasetContext, money, percent, ratio, safe_divide
from app.utils.errors import AnalysisUnavailable

# Value tiers: cluster mean amount relative to the dataset mean for the same direction.
VALUE_TIERS: tuple[tuple[float, str], ...] = (
    (1.8, "High-Value"),
    (1.25, "Elevated"),
    (0.9, "Mid-Range"),
    (0.55, "Everyday"),
    (0.0, "Small-Ticket"),
)

# Frequency tiers: transactions per active month relative to the dataset average.
FREQUENCY_TIERS: tuple[tuple[float, str], ...] = (
    (1.4, "High-Frequency"),
    (0.7, "Steady"),
    (0.0, "Low-Frequency"),
)

# Natural-language templates keyed by the *computed* tiers, never by cluster id.
LABEL_TEMPLATES: dict[tuple[str, str], str] = {
    ("High-Value", "Low-Frequency"): "High-Value Occasional Spending",
    ("High-Value", "Steady"): "High-Value Spending",
    ("High-Value", "High-Frequency"): "High-Frequency High-Value Spending",
    ("Elevated", "Low-Frequency"): "Occasional Large Spending",
    ("Elevated", "Steady"): "Elevated Mid-Value Spending",
    ("Elevated", "High-Frequency"): "Frequent Medium Purchases",
    ("Mid-Range", "Low-Frequency"): "Occasional Everyday Spending",
    ("Mid-Range", "Steady"): "Steady Mid-Range Spending",
    ("Mid-Range", "High-Frequency"): "High-Frequency Everyday Spending",
    ("Everyday", "Low-Frequency"): "Low-Frequency Everyday Spending",
    ("Everyday", "Steady"): "Routine Everyday Spending",
    ("Everyday", "High-Frequency"): "Frequent Small Purchases",
    ("Small-Ticket", "Low-Frequency"): "Low-Value Occasional Spending",
    ("Small-Ticket", "Steady"): "Routine Small Purchases",
    ("Small-Ticket", "High-Frequency"): "Frequent Small Purchases",
}

CHARACTERISTIC_LIMIT = 5


@dataclass
class ClusteringRun:
    """Raw artefacts of one clustering run, kept for reuse by the API layer."""

    response: ClusterResponse
    scaled: np.ndarray
    labels: np.ndarray
    feature_matrix: FeatureMatrix
    kmeans: KMeans
    pca: PCA
    scaler: StandardScaler


def _tier(value: float, tiers: tuple[tuple[float, str], ...]) -> str:
    for threshold, name in tiers:
        if value >= threshold:
            return name
    return tiers[-1][1]


def evaluate_silhouette(scaled: np.ndarray, labels: np.ndarray, settings: Settings) -> tuple[float, bool, int]:
    """Silhouette score, sampling large datasets for tractability."""

    unique = np.unique(labels)
    if len(unique) < 2 or scaled.shape[0] <= len(unique):
        return 0.0, False, int(scaled.shape[0])

    sample_size = int(min(scaled.shape[0], settings.silhouette_sample_size))
    if sample_size < scaled.shape[0]:
        score = float(
            silhouette_score(
                scaled,
                labels,
                sample_size=sample_size,
                random_state=settings.random_state,
            )
        )
        return score, True, sample_size
    score = float(silhouette_score(scaled, labels, random_state=settings.random_state))
    return score, False, int(scaled.shape[0])


def _fit_kmeans(scaled: np.ndarray, k: int, settings: Settings) -> KMeans:
    if k < 2:
        raise AnalysisUnavailable("Clustering requires at least two clusters.")
    if scaled.shape[0] < k:
        raise AnalysisUnavailable(
            f"Only {scaled.shape[0]} transactions are available, which is not enough for {k} clusters.",
            details=["Reduce the number of clusters or upload a larger dataset."],
        )
    return KMeans(
        n_clusters=k,
        n_init=settings.kmeans_n_init,
        random_state=settings.random_state,
    ).fit(scaled)


def compute_sweep(scaled: np.ndarray, settings: Settings) -> list[KSweepEntry]:
    """Inertia and silhouette for every K between ``min_k`` and ``max_k``."""

    entries: list[KSweepEntry] = []
    upper = min(settings.max_k, scaled.shape[0])
    for k in range(settings.min_k, upper + 1):
        model = _fit_kmeans(scaled, k, settings)
        score, _, _ = evaluate_silhouette(scaled, model.labels_, settings)
        entries.append(KSweepEntry(k=k, inertia=money(model.inertia_), silhouette=ratio(score, 4)))
    return entries


@dataclass
class _ClusterView:
    """One cluster's descriptive statistics, computed before labels are assigned."""

    cluster_id: int
    subset: pd.DataFrame
    size: int
    percentage: float
    total_spending: float
    total_income: float
    spend_share: float
    income_share: float
    weekend_share: float
    by_category: pd.DataFrame
    dominant_category: str
    dominant_share: float
    active_months: int
    transactions_per_month: float
    value_ratio: float
    income_dominant: bool


def _value_ratio(subset: pd.DataFrame, context: DatasetContext, income_dominant: bool) -> float:
    """Mean amount in the cluster relative to the dataset mean for the same direction."""

    direction = "income" if income_dominant else "expense"
    cluster_mean = float(subset.loc[subset["flow"] == direction, "amount"].mean()) if len(subset) else 0.0
    if not np.isfinite(cluster_mean):
        cluster_mean = 0.0

    if direction == "income":
        dataset_mean = safe_divide(context.total_income, float(context.income_count), default=0.0)
    else:
        dataset_mean = safe_divide(context.total_spending, float(context.expense_count), default=0.0)
    return safe_divide(cluster_mean, dataset_mean, default=1.0)


def generate_label(
    *,
    income_dominant: bool,
    value_tier: str,
    frequency_tier: str,
    frequency: str,
    dominant_category: str,
    taken: set[str],
) -> str:
    """Turn computed tiers into a readable, unique cluster name."""

    if income_dominant:
        if value_tier == "High-Value":
            label = "High-Value Income"
        elif frequency == "High":
            label = "Frequent Income Inflows"
        else:
            label = "Recurring Income"
    else:
        label = LABEL_TEMPLATES.get((value_tier, frequency_tier), "Mixed Behaviour Spending")

    if label in taken:
        labelled_with_category = f"{label} · {dominant_category}"
        label = labelled_with_category if labelled_with_category not in taken else f"{label} (variant {len(taken) + 1})"
    taken.add(label)
    return label


def _frequency_word(frequency_ratio: float) -> str:
    for threshold, name in FREQUENCY_TIERS:
        if frequency_ratio >= threshold:
            return name
    return FREQUENCY_TIERS[-1][1]


def _frequency_band(frequency_ratio: float) -> str:
    if frequency_ratio >= 1.25:
        return "High"
    if frequency_ratio <= 0.75:
        return "Low"
    return "Medium"


def _characteristics(
    *,
    subset: pd.DataFrame,
    context: DatasetContext,
    value_ratio: float,
    frequency_word: str,
    dominant_category: str,
    dominant_share: float,
    active_months: int,
    income_share: float,
    weekend_share: float,
    spend_share: float,
    transaction_share: float,
) -> list[str]:
    bullets: list[str] = [
        f"Average transaction is {value_ratio:.1f}× the dataset average for its direction"
        if value_ratio
        else "Average transaction matches the dataset average",
        f"{dominant_category} accounts for {dominant_share:.0f}% of the cluster's value",
        f"Runs {safe_divide(len(subset), float(active_months)):.1f} transactions per active month "
        f"({frequency_word.lower()} cadence compared with the other clusters)",
    ]

    if income_share >= 5:
        bullets.append(f"{income_share:.0f}% of the rows in this cluster are income")
    if abs(weekend_share - context.weekend_share) >= 8:
        direction = "more" if weekend_share > context.weekend_share else "less"
        bullets.append(
            f"Weekend activity is {direction} common than average ({weekend_share:.0f}% of transactions)"
        )
    if abs(spend_share - transaction_share) >= 5:
        bullets.append(
            f"Holds {spend_share:.1f}% of total spending from {transaction_share:.1f}% of transactions"
        )
    else:
        bullets.append(f"Represents {transaction_share:.1f}% of all transactions")

    diversity = int(subset["category"].nunique())
    if diversity <= 3:
        bullets.append(f"Very concentrated: only {diversity} categor{'y' if diversity == 1 else 'ies'}")
    return bullets[:CHARACTERISTIC_LIMIT]


def _cluster_stats(
    *,
    labelled: pd.DataFrame,
    context: DatasetContext,
    labels: np.ndarray,
    scaled_centers: np.ndarray,
    feature_names: list[str],
) -> list[ClusterStat]:
    dataset_size = max(len(labelled), 1)
    views: list[_ClusterView] = []

    for cluster_id in sorted(np.unique(labels).tolist()):
        subset = labelled.loc[labelled["cluster"] == cluster_id]
        if subset.empty:
            continue

        size = int(len(subset))
        expense_rows = subset[subset["flow"] == "expense"]
        income_rows = subset[subset["flow"] == "income"]
        total_spending = money(expense_rows["amount"].sum()) if not expense_rows.empty else 0.0
        total_income = money(income_rows["amount"].sum()) if not income_rows.empty else 0.0
        income_share = percent(safe_divide(len(income_rows), float(size)) * 100)
        income_dominant = income_share >= 60
        active_months = max(int(subset["month"].nunique()), 1)

        by_category = (
            subset.groupby("category")
            .agg(total=("amount", "sum"), transactions=("amount", "size"))
            .sort_values("total", ascending=False)
        )
        cluster_total_value = money(subset["amount"].sum())
        dominant_category = str(by_category.index[0]) if not by_category.empty else "Uncategorized"
        dominant_share = (
            percent(safe_divide(float(by_category.iloc[0]["total"]), cluster_total_value) * 100)
            if not by_category.empty
            else 0.0
        )

        views.append(
            _ClusterView(
                cluster_id=int(cluster_id),
                subset=subset,
                size=size,
                percentage=percent(size / dataset_size * 100),
                total_spending=total_spending,
                total_income=total_income,
                spend_share=percent(safe_divide(total_spending, context.total_spending) * 100),
                income_share=income_share,
                weekend_share=percent(
                    safe_divide(float(subset["weekday"].isin(["Sat", "Sun"]).sum()), float(size)) * 100
                ),
                by_category=by_category,
                dominant_category=dominant_category,
                dominant_share=dominant_share,
                active_months=active_months,
                transactions_per_month=safe_divide(size, float(active_months), default=0.0),
                value_ratio=_value_ratio(subset, context, income_dominant),
                income_dominant=income_dominant,
            )
        )

    # Frequency is ranked against the other clusters. Comparing against the whole
    # dataset would call every cluster "low frequency" whenever spending is spread
    # over many months, which would hide the differences between the clusters.
    cadences = [view.transactions_per_month for view in views if not view.income_dominant]
    reference_cadence = float(np.median(cadences)) if cadences else 1.0
    if not np.isfinite(reference_cadence) or reference_cadence <= 0:
        reference_cadence = 1.0

    stats: list[ClusterStat] = []
    taken: set[str] = set()

    for view in views:
        subset = view.subset
        cluster_id = view.cluster_id
        size = view.size
        frequency_ratio = safe_divide(view.transactions_per_month, reference_cadence, default=1.0)
        frequency = _frequency_band(frequency_ratio)
        frequency_tier = _tier(frequency_ratio, FREQUENCY_TIERS)
        if view.income_dominant:
            value_tier = "High-Value" if view.value_ratio >= 1.25 else "Mid-Range"
        else:
            value_tier = _tier(view.value_ratio, VALUE_TIERS)
        label = generate_label(
            income_dominant=view.income_dominant,
            value_tier=value_tier,
            frequency_tier=frequency_tier,
            frequency=frequency,
            dominant_category=view.dominant_category,
            taken=taken,
        )

        top_categories = [
            CategoryBreakdown(
                category=str(name),
                transactions=int(row["transactions"]),
                total=money(row["total"]),
                share=percent(safe_divide(float(row["total"]), cluster_total_value) * 100),
            )
            for name, row in view.by_category.head(4).iterrows()
        ]

        feature_means = {
            name: ratio(float(subset[name].mean()), 4) for name in feature_names if name in subset.columns
        }
        feature_z = {
            name: ratio(float(value), 4)
            for name, value in zip(feature_names, scaled_centers[cluster_id].tolist(), strict=False)
        }

        stats.append(
            ClusterStat(
                cluster=cluster_id,
                label=label,
                size=size,
                percentage=view.percentage,
                avg_transaction=money(subset["amount"].mean()),
                median_transaction=money(subset["amount"].median()),
                total_spending=view.total_spending,
                total_income=view.total_income,
                spend_share=view.spend_share,
                dominant_category=view.dominant_category,
                dominant_category_share=view.dominant_share,
                frequency=frequency,  # type: ignore[arg-type]
                transactions_per_month=ratio(view.transactions_per_month, 2),
                active_months=view.active_months,
                income_share=view.income_share,
                weekend_share=view.weekend_share,
                characteristics=_characteristics(
                    subset=subset,
                    context=context,
                    value_ratio=view.value_ratio,
                    frequency_word=_frequency_word(frequency_ratio),
                    dominant_category=view.dominant_category,
                    dominant_share=view.dominant_share,
                    active_months=view.active_months,
                    income_share=view.income_share,
                    weekend_share=view.weekend_share,
                    spend_share=view.spend_share,
                    transaction_share=view.percentage,
                ),
                top_categories=top_categories,
                first_date=subset["date"].min().date(),
                last_date=subset["date"].max().date(),
                feature_means=feature_means,
                feature_z_scores=feature_z,
            )
        )

    stats.sort(key=lambda item: item.size, reverse=True)
    return stats


def _scatter_points(
    *,
    labelled: pd.DataFrame,
    coords: np.ndarray,
    labels_to_label: dict[int, str],
    settings: Settings,
) -> tuple[list[ClusterPoint], bool]:
    total = len(labelled)
    if total <= settings.max_scatter_points:
        selected = labelled.index
        sampled = False
    else:
        rng = np.random.default_rng(settings.random_state)
        keep: list[int] = []
        for cluster_id in np.unique(labelled["cluster"]):
            positions = np.flatnonzero(labelled["cluster"].to_numpy() == cluster_id)
            share = max(1, int(round(len(positions) / total * settings.max_scatter_points)))
            share = min(share, len(positions))
            keep.extend(rng.choice(positions, size=share, replace=False).tolist())
        selected = labelled.index[sorted(keep)]
        sampled = True

    points: list[ClusterPoint] = []
    for position in selected:
        row = labelled.loc[position]
        index = int(labelled.index.get_loc(position))
        cluster_id = int(row["cluster"])
        points.append(
            ClusterPoint(
                transaction_id=int(row["transaction_id"]),
                x=ratio(float(coords[index, 0]), 4),
                y=ratio(float(coords[index, 1]), 4),
                cluster=cluster_id,
                cluster_label=labels_to_label.get(cluster_id, f"Cluster {cluster_id}"),
                amount=money(row["amount"]),
                description=str(row["description"]),
                category=str(row["category"]),
                date=row["date"].date(),
                flow=str(row["flow"]),  # type: ignore[arg-type]
            )
        )
    return points, sampled


def run_clustering(
    *,
    dataset_id: str,
    context: DatasetContext,
    settings: Settings,
    k: int,
    sweep: list[KSweepEntry],
    feature_matrix: FeatureMatrix | None = None,
    include_points: bool = True,
    cached: bool = False,
) -> ClusteringRun:
    """Fit the full pipeline for a single K and describe every cluster."""

    if k < settings.min_k or k > settings.max_k:
        raise AnalysisUnavailable(
            f"K must be between {settings.min_k} and {settings.max_k}.",
            details=[f"Received K={k}."],
        )
    if len(context.frame) < settings.min_rows_for_clustering:
        raise AnalysisUnavailable(
            f"At least {settings.min_rows_for_clustering} transactions are required to build spending clusters.",
            details=[f"The current dataset has {len(context.frame)} usable transactions."],
            context={"rows": int(len(context.frame)), "required": settings.min_rows_for_clustering},
        )

    matrix = feature_matrix or build_feature_matrix(context)
    scaler = StandardScaler()
    scaled = scaler.fit_transform(matrix.values)

    kmeans = _fit_kmeans(scaled, k, settings)
    labels = kmeans.labels_.astype("int64")

    pca = PCA(n_components=2, random_state=settings.random_state)
    coords = pca.fit_transform(scaled)

    silhouette, sampled, sample_size = evaluate_silhouette(scaled, labels, settings)

    labelled = matrix.frame.copy()
    labelled["cluster"] = labels
    # Keep the position of every row so sampling can slice the PCA coordinates.
    labelled = labelled.reset_index(drop=True)

    stats = _cluster_stats(
        labelled=labelled,
        context=context,
        labels=labels,
        scaled_centers=kmeans.cluster_centers_,
        feature_names=matrix.feature_names,
    )
    labels_to_label = {stat.cluster: stat.label for stat in stats}

    centers_2d = pca.transform(kmeans.cluster_centers_)
    centroids = [
        Centroid(
            cluster=stat.cluster,
            label=stat.label,
            x=ratio(float(centers_2d[stat.cluster, 0]), 4),
            y=ratio(float(centers_2d[stat.cluster, 1]), 4),
            size=stat.size,
        )
        for stat in stats
    ]

    points: list[ClusterPoint] = []
    sampled_points = False
    if include_points:
        points, sampled_points = _scatter_points(
            labelled=labelled,
            coords=coords,
            labels_to_label=labels_to_label,
            settings=settings,
        )

    metrics = ClusterMetrics(
        k=k,
        inertia=money(float(kmeans.inertia_)),
        silhouette=ratio(silhouette, 4),
        iterations=int(kmeans.n_iter_),
        explained_variance=[ratio(float(value), 4) for value in pca.explained_variance_ratio_.tolist()],
        explained_variance_total=ratio(float(np.sum(pca.explained_variance_ratio_)), 4),
        feature_names=matrix.feature_names,
        n_samples=int(scaled.shape[0]),
        n_features=int(scaled.shape[1]),
        scaler_mean={name: ratio(float(value), 4) for name, value in zip(matrix.feature_names, scaler.mean_, strict=False)},
        scaler_scale={
            name: ratio(float(value), 6) for name, value in zip(matrix.feature_names, scaler.scale_, strict=False)
        },
        silhouette_sampled=sampled,
        silhouette_sample_size=sample_size,
    )

    optimal_k = max(sweep, key=lambda entry: entry.silhouette).k if sweep else k

    response = ClusterResponse(
        dataset_id=dataset_id,
        k=k,
        generated_at=datetime.now(timezone.utc),
        cached=cached,
        metrics=metrics,
        clusters=stats,
        centroids=centroids,
        points=points,
        total_points=int(len(labelled)),
        points_sampled=sampled_points,
        sweep=sweep,
        optimal_k=optimal_k,
    )

    return ClusteringRun(
        response=response,
        scaled=scaled,
        labels=labels,
        feature_matrix=matrix,
        kmeans=kmeans,
        pca=pca,
        scaler=scaler,
    )


def distinct_dates(frame: pd.DataFrame) -> tuple[date, date] | None:
    """Convenience helper used by tests and diagnostics."""

    if frame.empty:
        return None
    return frame["date"].min().date(), frame["date"].max().date()


__all__ = [
    "ClusteringRun",
    "compute_sweep",
    "distinct_dates",
    "evaluate_silhouette",
    "generate_label",
    "run_clustering",
]
