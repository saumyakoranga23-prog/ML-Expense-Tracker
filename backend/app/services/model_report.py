"""Builds the model-information payload for the ML page."""

from __future__ import annotations

from app.config import Settings
from app.ml.features import FEATURE_SPECS
from app.schemas.model import FeatureDescription, MetricExplanation, ModelInfo
from app.services.store import DatasetRecord

INERTIA_MEANING = (
    "Inertia is the sum of squared distances between every transaction and the centre of the cluster it "
    "was assigned to. Lower means tighter clusters, but it always falls as K grows, so on its own it can "
    "never tell you which K is right."
)
SILHOUETTE_MEANING = (
    "The silhouette score compares how close a transaction is to its own cluster against the nearest "
    "other cluster. It runs from -1 to 1: values near 0 mean clusters overlap, roughly 0.2-0.4 shows "
    "usable structure, and above 0.5 is strong separation."
)
SILHOUETTE_CAUTION = (
    "This is a diagnostic, not a verdict. A single number cannot prove one configuration is the correct "
    "one — the feature set, the scaling and how interpretable the result is matter just as much."
)
PCA_MEANING = (
    "PCA projects the standardised feature space onto the two directions that explain the most variance, "
    "so a six-dimensional clustering can be drawn on a flat chart without inventing coordinates."
)
K_MEANING = (
    "K is a modelling choice, not a discovered truth: K-Means will always find exactly K clusters, even "
    "in random data. Compare the silhouette sweep and the cluster descriptions before settling on one."
)


def _feature_descriptions() -> list[FeatureDescription]:
    return [
        FeatureDescription(
            name=spec.name,
            label=spec.label,
            description=spec.description,
            source=spec.source,
        )
        for spec in FEATURE_SPECS
    ]


def build_model_info(record: DatasetRecord, settings: Settings, k: int | None = None) -> ModelInfo:
    """Describe the algorithm, features, hyperparameters and fitted metrics."""

    available = record.clustering_available
    unavailable_reason = None
    if not available:
        unavailable_reason = (
            f"At least {settings.min_rows_for_clustering} usable transactions are required before the model can "
            f"be fitted; this dataset has {record.row_count}."
        )

    sweep = record.sweep(settings) if available else []
    optimal_k = max(sweep, key=lambda entry: entry.silhouette).k if sweep else None

    metrics = None
    selected_k: int | None = None
    if available:
        selected_k = k if k is not None else optimal_k
        if selected_k is not None:
            try:
                metrics = record.cluster(selected_k, settings, include_points=False).metrics
            except Exception:  # noqa: BLE001 - a model page must render even if fitting fails
                metrics = None
                selected_k = None

    explanations: list[MetricExplanation] = [
        MetricExplanation(
            name="Number of clusters (K)",
            value=float(selected_k) if selected_k is not None else None,
            display="number",
            meaning=K_MEANING,
            caution="Try a different K and compare the cluster descriptions, not just the scores.",
        ),
        MetricExplanation(
            name="Inertia",
            value=metrics.inertia if metrics else None,
            display="number",
            meaning=INERTIA_MEANING,
        ),
        MetricExplanation(
            name="Silhouette score",
            value=metrics.silhouette if metrics else None,
            display="score",
            meaning=SILHOUETTE_MEANING,
            caution=SILHOUETTE_CAUTION,
        ),
        MetricExplanation(
            name="PCA variance captured",
            value=(metrics.explained_variance_total * 100) if metrics else None,
            display="percent",
            meaning=PCA_MEANING,
            caution="If the two components capture very little variance, the 2D plot understates the separation.",
        ),
        MetricExplanation(
            name="K-Means iterations",
            value=float(metrics.iterations) if metrics else None,
            display="number",
            meaning="How many Lloyd iterations the algorithm needed before the assignments stopped changing.",
        ),
    ]

    return ModelInfo(
        dataset_id=record.dataset_id,
        algorithm="K-Means clustering",
        algorithm_detail=(
            "Lloyd's algorithm with k-means++ initialisation, run "
            f"{settings.kmeans_n_init} times per K and keeping the best inertia."
        ),
        preprocessing="StandardScaler (z-score standardisation)",
        preprocessing_detail=(
            "Each of the six behavioural features is centred on its mean and divided by its standard "
            "deviation. Without it, log-amount would dominate the Euclidean distance."
        ),
        dimensionality_reduction="PCA (2 components) for visualisation only",
        dimensionality_reduction_detail=(
            "PCA is fitted on the standardised features to place every transaction on the cluster scatter "
            "plot. Clustering itself runs on the full feature space, not on the two components."
        ),
        evaluation="Silhouette score, with an inertia sweep for reference",
        features=_feature_descriptions(),
        selected_k=selected_k,
        optimal_k=optimal_k,
        sweep=sweep,
        metrics=metrics,
        explanations=explanations,
        clustering_available=available,
        unavailable_reason=unavailable_reason,
        total_transactions=record.row_count,
        hyperparameters={
            "n_init": str(settings.kmeans_n_init),
            "random_state": str(settings.random_state),
            "max_iter": "300 (library default)",
            "init": "k-means++",
            "silhouette_sample_size": f"{min(settings.silhouette_sample_size, record.row_count):,}",
            "k_range": f"{settings.min_k}-{settings.max_k}",
        },
    )


__all__ = ["build_model_info"]
