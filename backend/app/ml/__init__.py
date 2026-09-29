"""Machine-learning layer: K-Means over engineered spending features.

The pipeline is deliberately explicit so the model page can explain it:

1. :mod:`app.ml.features` builds six behavioural features per transaction.
2. :class:`sklearn.preprocessing.StandardScaler` standardises them.
3. :class:`sklearn.cluster.KMeans` partitions the transactions.
4. :class:`sklearn.decomposition.PCA` projects the feature space to 2D for the plot.
5. :func:`sklearn.metrics.silhouette_score` scores the partition for K = 2…8.
"""

from app.ml.clustering import (
    ClusteringRun,
    compute_sweep,
    evaluate_silhouette,
    run_clustering,
)
from app.ml.features import FEATURE_NAMES, FEATURE_SPECS, build_feature_matrix, feature_catalogue

__all__ = [
    "ClusteringRun",
    "FEATURE_NAMES",
    "FEATURE_SPECS",
    "build_feature_matrix",
    "compute_sweep",
    "evaluate_silhouette",
    "feature_catalogue",
    "run_clustering",
]
