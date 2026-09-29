"""Tests for the behavioural feature engineering."""

from __future__ import annotations

import numpy as np
import pytest

from app.config import Settings
from app.ml.features import FEATURE_NAMES, build_feature_matrix, feature_catalogue
from app.services.analytics import build_context
from app.services.cleaning import clean_dataset
from app.services.csv_loading import read_transactions_csv
from app.utils.errors import AnalysisUnavailable
from tests.conftest import csv_bytes, synthetic_rows


@pytest.fixture(scope="module")
def context():
    text = csv_bytes(synthetic_rows(count=120)).decode()
    parsed = read_transactions_csv(text, max_rows=5000)
    cleaned = clean_dataset(parsed, min_rows=2, min_rows_for_clustering=8)
    return build_context(cleaned)


def test_feature_catalogue_is_documented() -> None:
    specs = feature_catalogue()
    assert [spec.name for spec in specs] == list(FEATURE_NAMES)
    assert all(spec.description and spec.source for spec in specs)


def test_feature_matrix_shape_and_finiteness(context) -> None:
    matrix = build_feature_matrix(context)
    assert matrix.values.shape == (len(context.frame), len(FEATURE_NAMES))
    assert np.isfinite(matrix.values).all()
    assert matrix.n_features == len(FEATURE_NAMES)
    assert matrix.frame["transaction_id"].is_monotonic_increasing


def test_feature_semantics(context) -> None:
    matrix = build_feature_matrix(context)
    frame = matrix.frame
    index = {name: position for position, name in enumerate(matrix.feature_names)}

    log_amount = matrix.values[:, index["log_amount"]]
    assert np.allclose(log_amount, np.log1p(frame["amount"].to_numpy()))

    flow = matrix.values[:, index["flow_indicator"]]
    assert set(np.unique(flow)).issubset({0.0, 1.0})
    assert flow.sum() == pytest.approx(float((frame["flow"] == "income").sum()))

    frequency = matrix.values[:, index["category_frequency"]]
    assert frequency.min() > 0
    assert frequency.max() <= 1.0

    weekend = matrix.values[:, index["weekend_indicator"]]
    assert set(np.unique(weekend)).issubset({0.0, 1.0})

    intensity = matrix.values[:, index["monthly_spend_z"]]
    # A z-score over the dataset's months is centred close to zero.
    assert abs(float(np.mean(intensity))) < 1.5


def test_feature_matrix_requires_transactions() -> None:
    class _EmptyContext:
        frame = None

    with pytest.raises(AttributeError):
        build_feature_matrix(_EmptyContext())  # type: ignore[arg-type]


def test_settings_defaults_are_sane() -> None:
    settings = Settings()
    assert (settings.min_k, settings.max_k) == (2, 8)
    assert settings.max_upload_bytes == 10 * 1024 * 1024
    assert settings.min_rows_for_clustering >= 2
