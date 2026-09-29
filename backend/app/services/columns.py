"""Intelligent detection of transaction columns in an arbitrary CSV.

The detector understands the column names people actually export from banks and
apps (``Txn Date``, ``Narration``, ``Withdrawal Amt.`` …) and, when names are
unhelpful, falls back to inspecting the values themselves.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

import pandas as pd

# Canonical field -> accepted normalised spellings.
FIELD_ALIASES: dict[str, tuple[str, ...]] = {
    "date": (
        "date",
        "transaction_date",
        "txn_date",
        "trans_date",
        "posting_date",
        "posted_date",
        "value_date",
        "booking_date",
        "date_time",
        "datetime",
        "timestamp",
        "time",
    ),
    "description": (
        "description",
        "transaction_description",
        "narration",
        "particulars",
        "details",
        "merchant",
        "merchant_name",
        "payee",
        "name",
        "memo",
        "remarks",
        "note",
        "notes",
        "reference",
        "transaction_details",
    ),
    "category": (
        "category",
        "category_name",
        "categories",
        "merchant_category",
        "spend_category",
        "group",
        "label",
        "tag",
        "tags",
        "type_of_expense",
    ),
    "amount": (
        "amount",
        "amt",
        "value",
        "transaction_amount",
        "txn_amount",
        "amount_inr",
        "amount_usd",
        "amount_rs",
        "amount_rupees",
        "total",
        "net_amount",
    ),
    "transaction_type": (
        "transaction_type",
        "txn_type",
        "type",
        "direction",
        "dr_cr",
        "debit_credit",
        "credit_debit",
        "cr_dr",
        "flow",
        "indicator",
        "transaction_kind",
        "kind",
    ),
    "debit": (
        "debit",
        "debit_amount",
        "debit_amt",
        "withdrawal",
        "withdrawal_amount",
        "withdrawal_amt",
        "money_out",
        "paid_out",
        "outflow",
        "dr",
    ),
    "credit": (
        "credit",
        "credit_amount",
        "credit_amt",
        "deposit",
        "deposit_amount",
        "deposit_amt",
        "money_in",
        "paid_in",
        "inflow",
        "cr",
    ),
    "balance": (
        "balance",
        "closing_balance",
        "running_balance",
        "available_balance",
        "balance_amount",
    ),
}

REQUIRED_FIELDS = ("date",)

_DATE_PATTERN = re.compile(r"[-/.]\d{1,2}[-/.]|^[A-Za-z]{3,9}\s+\d{1,2}|\d{1,2}\s+[A-Za-z]{3,9}")
_MONEY_PATTERN = re.compile(r"^\s*[(\-+]?\s*[₹$€£¥]?\s*\d[\d,\s]*(\.\d+)?\s*\)?\s*$")


@dataclass
class ColumnDetection:
    """Detected column mapping plus how each decision was reached."""

    columns: dict[str, str | None] = field(default_factory=dict)
    confidence: dict[str, str] = field(default_factory=dict)
    notes: list[str] = field(default_factory=list)

    @property
    def missing_required(self) -> list[str]:
        missing = [field_name for field_name in REQUIRED_FIELDS if not self.columns.get(field_name)]
        has_amount = bool(self.columns.get("amount")) or (
            bool(self.columns.get("debit")) and bool(self.columns.get("credit"))
        )
        if not has_amount:
            missing.append("amount")
        return missing


def normalize_column_name(name: object) -> str:
    """Lower-case, strip punctuation and collapse separators."""

    text = str(name).strip().lower()
    text = re.sub(r"[^a-z0-9]+", "_", text)
    return text.strip("_")


def _score_alias(column: str, alias: str) -> int:
    """Rank how well a column name matches an alias (higher is better)."""

    if column == alias:
        return 100 + len(alias)
    if len(alias) >= 4 and alias in column:
        return 60 + len(alias)
    if len(column) >= 4 and column in alias:
        return 40 + len(column)
    return 0


def _sample(series: pd.Series, limit: int = 60) -> list[str]:
    values = series.dropna()
    values = values[values.astype("string").str.strip() != ""]
    return [str(value) for value in values.head(limit).tolist()]


def _date_ratio(values: list[str]) -> float:
    if not values:
        return 0.0
    parsed = pd.to_datetime(pd.Series(values), errors="coerce", format="mixed")
    return float(parsed.notna().mean())


def _money_ratio(values: list[str], tolerance: float = 0.9) -> float:
    if not values:
        return 0.0
    hits = sum(1 for value in values if _MONEY_PATTERN.match(value))
    return hits / len(values) if hits / len(values) >= tolerance else 0.0


def detect_columns(frame: pd.DataFrame) -> ColumnDetection:
    """Map canonical fields onto the frame's actual columns."""

    detection = ColumnDetection()
    normalised = {column: normalize_column_name(column) for column in frame.columns}
    used: set[str] = set()

    # Pass 1 matches exact names only, and pass 2 allows looser aliases. Two
    # passes matter because a loose alias must never steal a column that another
    # field matches exactly ("Credit" belongs to a credit column, not to a
    # "credit_debit" transaction-type column).
    for exact_only in (True, False):
        for field_name, aliases in FIELD_ALIASES.items():
            if detection.columns.get(field_name):
                continue
            best_column: str | None = None
            best_score = 0
            for column, normalised_name in normalised.items():
                if column in used or not normalised_name:
                    continue
                score = max((_score_alias(normalised_name, alias) for alias in aliases), default=0)
                if exact_only and score < 100:
                    continue
                if score > best_score:
                    best_score, best_column = score, str(column)
            if best_column is not None and best_score > 0:
                detection.columns[field_name] = best_column
                detection.confidence[field_name] = "exact" if best_score >= 100 else "alias"
                used.add(best_column)

    # Pass 2: value based fallbacks for anything still missing.
    for field_name in FIELD_ALIASES:
        if detection.columns.get(field_name):
            continue

        if field_name == "date":
            candidate, ratio = _best_by_ratio(frame, used, _date_ratio)
            if candidate is not None:
                detection.columns["date"] = candidate
                detection.confidence["date"] = "heuristic"
                used.add(candidate)
                detection.notes.append(
                    f"No date column name was recognised; '{candidate}' was used because "
                    f"{ratio:.0%} of its values parse as dates."
                )
        elif field_name == "amount":
            candidate, ratio = _best_by_ratio(frame, used, _money_ratio)
            if candidate is not None:
                detection.columns["amount"] = candidate
                detection.confidence["amount"] = "heuristic"
                used.add(candidate)
                detection.notes.append(
                    f"No amount column name was recognised; '{candidate}' was used because "
                    f"{ratio:.0%} of its values look numeric."
                )
        elif field_name == "description":
            column = _longest_text_column(frame, used)
            if column is not None:
                detection.columns["description"] = column
                detection.confidence["description"] = "heuristic"
                used.add(column)
                detection.notes.append(
                    f"No description column name was recognised; '{column}' was used as the "
                    "transaction description."
                )

    for field_name in FIELD_ALIASES:
        detection.columns.setdefault(field_name, None)
        detection.confidence.setdefault(field_name, "missing" if not detection.columns[field_name] else "alias")
        if detection.columns[field_name]:
            detection.confidence[field_name] = detection.confidence.get(field_name, "alias")

    if detection.columns.get("amount") is None and detection.columns.get("debit") and detection.columns.get("credit"):
        detection.notes.append(
            "Separate debit and credit columns were detected and combined into a single signed amount."
        )

    if _has_low_diversity_dates(detection, frame):
        detection.notes.append(
            "The detected date column has very few distinct values; check that it points at a real "
            "transaction date rather than a fiscal period."
        )

    return detection


def _has_low_diversity_dates(detection: ColumnDetection, frame: pd.DataFrame) -> bool:
    column = detection.columns.get("date")
    if not column or len(frame) < 20:
        return False
    distinct = frame[column].dropna().nunique()
    return 0 < distinct <= 2


def _best_by_ratio(frame: pd.DataFrame, used: set[str], ratio_fn) -> tuple[str | None, float]:
    best: tuple[str | None, float] = (None, 0.0)
    for column in frame.columns:
        if column in used:
            continue
        values = _sample(frame[column])
        ratio = ratio_fn(values)
        if ratio > best[1]:
            best = (str(column), ratio)
    return best if best[1] >= 0.8 else (None, 0.0)


def _longest_text_column(frame: pd.DataFrame, used: set[str]) -> str | None:
    candidates: list[tuple[str, float]] = []
    for column in frame.columns:
        if column in used:
            continue
        values = _sample(frame[column], limit=40)
        if not values:
            continue
        average_length = sum(len(value) for value in values) / len(values)
        if average_length >= 4:
            candidates.append((str(column), average_length))
    if not candidates:
        return None
    candidates.sort(key=lambda item: item[1], reverse=True)
    return candidates[0][0]


__all__ = [
    "ColumnDetection",
    "FIELD_ALIASES",
    "REQUIRED_FIELDS",
    "detect_columns",
    "normalize_column_name",
]
