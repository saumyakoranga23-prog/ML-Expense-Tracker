"""In-memory dataset store with per-dataset result caching.

The service is designed for a single-user analyst tool: uploads live in memory
keyed by a generated dataset id, the oldest dataset is evicted once the
configured limit is reached, and expensive results (features, the K sweep,
cluster runs) are computed once and reused. Clustering is therefore never
recomputed for the same ``(dataset, K)`` pair.
"""

from __future__ import annotations

import threading
import uuid
from collections import OrderedDict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sklearn.preprocessing import StandardScaler

from app.config import Settings
from app.ml.clustering import ClusteringRun, compute_sweep, run_clustering
from app.ml.features import FeatureMatrix, build_feature_matrix
from app.schemas.clustering import ClusterResponse, KSweepEntry
from app.schemas.dataset import DatasetSummary
from app.services.analytics import DatasetContext, build_context, build_summary
from app.services.cleaning import CleanedDataset
from app.utils.errors import DatasetNotFound

if TYPE_CHECKING:  # pragma: no cover - typing only
    import numpy as np


@dataclass
class DatasetRecord:
    """One uploaded (or demo) dataset plus every cached artefact."""

    dataset_id: str
    filename: str
    source: str
    cleaned: CleanedDataset
    context: DatasetContext
    min_rows_for_clustering: int = 8
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    _summary: DatasetSummary | None = None
    _feature_matrix: FeatureMatrix | None = None
    _scaled: "np.ndarray | None" = None
    _sweep: list[KSweepEntry] | None = None
    _clusters: dict[int, ClusterResponse] = field(default_factory=dict)
    _assignments: dict[int, tuple[int, str]] = field(default_factory=dict)
    active_k: int | None = None
    lock: threading.RLock = field(default_factory=threading.RLock)

    @property
    def row_count(self) -> int:
        return int(len(self.context.frame))

    @property
    def clustering_available(self) -> bool:
        return self.row_count >= self.min_rows_for_clustering

    def summary(self) -> DatasetSummary:
        with self.lock:
            if self._summary is None:
                self._summary = build_summary(self.dataset_id, self.cleaned, context=self.context)
            return self._summary

    def feature_matrix(self) -> FeatureMatrix:
        with self.lock:
            if self._feature_matrix is None:
                self._feature_matrix = build_feature_matrix(self.context)
            return self._feature_matrix

    def scaled_features(self) -> "np.ndarray":
        """Standardised feature matrix, cached because K-Means and PCA both need it."""

        with self.lock:
            if self._scaled is None:
                matrix = self.feature_matrix()
                self._scaled = StandardScaler().fit_transform(matrix.values)
            return self._scaled

    def sweep(self, settings: Settings) -> list[KSweepEntry]:
        with self.lock:
            if self._sweep is None:
                self._sweep = compute_sweep(self.scaled_features(), settings)
            return self._sweep

    def cluster(self, k: int, settings: Settings, *, include_points: bool = True) -> ClusterResponse:
        with self.lock:
            cached = self._clusters.get(k)
            if cached is not None and (not include_points or cached.points):
                return cached.model_copy(update={"cached": True})

            run: ClusteringRun = run_clustering(
                dataset_id=self.dataset_id,
                context=self.context,
                settings=settings,
                k=k,
                sweep=self.sweep(settings),
                feature_matrix=self.feature_matrix(),
                include_points=include_points,
            )
            response = run.response
            self._clusters[k] = response
            labels_by_cluster = {stat.cluster: stat.label for stat in response.clusters}
            self._assignments = {
                int(transaction_id): (int(cluster), labels_by_cluster.get(int(cluster), f"Cluster {cluster}"))
                for transaction_id, cluster in zip(
                    run.feature_matrix.frame["transaction_id"].tolist(), run.labels.tolist(), strict=False
                )
            }
            self.active_k = k
            return response

    def assigned_clusters(self) -> dict[int, tuple[int, str]]:
        with self.lock:
            return dict(self._assignments)

    def latest_cluster_stats(self):
        with self.lock:
            if self.active_k is None:
                return None, None
            response = self._clusters.get(self.active_k)
            if response is None:
                return None, None
            return response.clusters, self.active_k


class DatasetStore:
    """Thread-safe, bounded collection of loaded datasets."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._records: OrderedDict[str, DatasetRecord] = OrderedDict()
        self._lock = threading.RLock()

    def add(self, cleaned: CleanedDataset, *, filename: str, source: str) -> DatasetRecord:
        dataset_id = uuid.uuid4().hex
        context = build_context(cleaned)
        record = DatasetRecord(
            dataset_id=dataset_id,
            filename=filename,
            source=source,
            cleaned=cleaned,
            context=context,
            min_rows_for_clustering=self._settings.min_rows_for_clustering,
        )
        with self._lock:
            self._records[dataset_id] = record
            while len(self._records) > self._settings.max_datasets_in_memory:
                self._records.popitem(last=False)
        return record

    def get(self, dataset_id: str) -> DatasetRecord:
        with self._lock:
            record = self._records.get(dataset_id)
            if record is None:
                raise DatasetNotFound(
                    "That dataset is not loaded any more. Upload the file again to continue.",
                    details=[
                        f"Unknown dataset id: {dataset_id}",
                        f"{len(self._records)} dataset(s) are currently in memory.",
                    ],
                )
            self._records.move_to_end(dataset_id)
            return record

    def drop(self, dataset_id: str) -> None:
        with self._lock:
            if self._records.pop(dataset_id, None) is None:
                raise DatasetNotFound("That dataset is not loaded any more.")

    def list(self) -> list[DatasetRecord]:
        with self._lock:
            return list(self._records.values())

    def clear(self) -> None:
        with self._lock:
            self._records.clear()


__all__ = ["DatasetRecord", "DatasetStore"]
