"""Feature engineering for spending-behaviour clustering.

Clustering raw ``(date, amount)`` rows would only rediscover the amount scale.
Instead each transaction is described by six behavioural features that together
capture size, direction, category context, category-relative size, the spending
intensity of the month it belongs to, and weekend behaviour.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from app.services.analytics import DatasetContext
from app.utils.errors import AnalysisUnavailable


@dataclass(frozen=True)
class FeatureSpec:
    name: str
    label: str
    description: str
    source: str


FEATURE_SPECS: tuple[FeatureSpec, ...] = (
    FeatureSpec(
        name="log_amount",
        label="Log transaction amount",
        description=(
            "Natural logarithm of the absolute amount. Log-scaling stops a handful of very large "
            "purchases from dominating the distance metric."
        ),
        source="amount",
    ),
    FeatureSpec(
        name="flow_indicator",
        label="Income indicator",
        description="1 for income rows and 0 for expenses, so income streams can form their own cluster.",
        source="transaction_type / amount sign",
    ),
    FeatureSpec(
        name="category_frequency",
        label="Category frequency",
        description="Share of all transactions that belong to the same category: how routine this kind of spending is.",
        source="category",
    ),
    FeatureSpec(
        name="amount_vs_category",
        label="Amount vs category norm",
        description=(
            "log(1 + amount / mean amount of the same category and direction). Captures whether a "
            "transaction is unusually large for its own category."
        ),
        source="amount + category",
    ),
    FeatureSpec(
        name="monthly_spend_z",
        label="Month spending intensity",
        description=(
            "Z-score of the transaction's monthly spending total against all other months. Flags "
            "expenses that happen during unusually expensive months."
        ),
        source="amount + date",
    ),
    FeatureSpec(
        name="weekend_indicator",
        label="Weekend indicator",
        description="1 when the transaction took place on a Saturday or Sunday.",
        source="date",
    ),
)

FEATURE_NAMES: tuple[str, ...] = tuple(spec.name for spec in FEATURE_SPECS)


@dataclass
class FeatureMatrix:
    """Scaled-ready matrix plus the enriched frame it was built from."""

    values: np.ndarray
    frame: pd.DataFrame
    feature_names: list[str]

    @property
    def n_samples(self) -> int:
        return int(self.values.shape[0])

    @property
    def n_features(self) -> int:
        return int(self.values.shape[1])


def feature_catalogue() -> tuple[FeatureSpec, ...]:
    return FEATURE_SPECS


def build_feature_matrix(context: DatasetContext) -> FeatureMatrix:
    """Build the behavioural feature matrix for every transaction."""

    frame = context.frame
    if frame.empty:
        raise AnalysisUnavailable(
            "There are no transactions to describe, so spending clusters cannot be computed."
        )

    work = frame.copy()
    amount = work["amount"].to_numpy(dtype="float64")
    log_amount = np.log1p(np.clip(amount, 0.0, None))

    flow_indicator = (work["flow"].to_numpy() == "income").astype("float64")

    category_counts = work["category"].value_counts()
    category_frequency = (
        work["category"].map(category_counts).to_numpy(dtype="float64") / max(len(work), 1)
    )

    grouped_mean = (
        work.groupby(["category", "flow"])["amount"].transform("mean").to_numpy(dtype="float64")
    )
    safe_mean = np.where(grouped_mean > 0, grouped_mean, np.nan)
    with np.errstate(divide="ignore", invalid="ignore"):
        relative = np.where(np.isfinite(safe_mean), amount / safe_mean, 1.0)
    amount_vs_category = np.log1p(np.clip(np.nan_to_num(relative, nan=1.0), 0.0, 1e6))

    expense_totals = work.loc[work["flow"] == "expense"].groupby("month")["amount"].sum()
    if len(expense_totals) > 1 and float(expense_totals.std(ddof=1)) > 0:
        standardised = (expense_totals - float(expense_totals.mean())) / float(expense_totals.std(ddof=1))
    else:
        standardised = expense_totals * 0.0
    monthly_spend_z = work["month"].map(standardised).fillna(0.0).to_numpy(dtype="float64")

    weekend_indicator = work["weekday"].isin(["Sat", "Sun"]).to_numpy(dtype="float64")

    matrix = np.column_stack(
        [
            log_amount,
            flow_indicator,
            category_frequency,
            amount_vs_category,
            monthly_spend_z,
            weekend_indicator,
        ]
    ).astype("float64")

    # Defensive: every feature above is guarded, but clustering must never see a
    # non-finite value even if a future edit introduces one.
    matrix = np.nan_to_num(matrix, nan=0.0, posinf=0.0, neginf=0.0)

    enriched = work.copy()
    for index, name in enumerate(FEATURE_NAMES):
        enriched[name] = matrix[:, index]

    return FeatureMatrix(values=matrix, frame=enriched, feature_names=list(FEATURE_NAMES))


__all__ = [
    "FEATURE_NAMES",
    "FEATURE_SPECS",
    "FeatureMatrix",
    "FeatureSpec",
    "build_feature_matrix",
    "feature_catalogue",
]
