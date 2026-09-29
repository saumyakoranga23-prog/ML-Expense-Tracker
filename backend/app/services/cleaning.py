"""The data cleaning pipeline.

Every transformation is auditable: rows that cannot be interpreted are dropped
*and reported*, missing values are filled with explicit markers, duplicates are
counted, and the final frame carries normalised dates, amounts, flows, months
and stable transaction ids. Nothing is silently coerced.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date

import numpy as np
import pandas as pd

from app.schemas.common import CleaningIssue, CleaningReport, DetectedColumn
from app.services.columns import detect_columns
from app.services.csv_loading import ParsedCsv
from app.utils.errors import ValidationFailure

MAX_REPORTED_ISSUES = 60
MIN_PLAUSIBLE_YEAR = 1970
MAX_PLAUSIBLE_YEAR = date.today().year + 1

INCOME_TOKENS = (
    "income",
    "credit",
    "deposit",
    "inflow",
    "money in",
    "received",
    "receipt",
    "salary",
    "refund",
    "reversal",
    "interest",
    "dividend",
    "cashback",
    "reimbursement",
)
EXPENSE_TOKENS = (
    "expense",
    "expenditure",
    "debit",
    "withdrawal",
    "outflow",
    "money out",
    "payment",
    "paid",
    "spent",
    "purchase",
    "bill",
    "charge",
    "fee",
)
INCOME_CATEGORY_HINTS = ("income", "salary", "interest", "dividend", "refund", "credit")

_MONEY_CLEAN = re.compile(r"[^0-9.\-]")
_WHITESPACE = re.compile(r"\s+")
_NULLISH = {"", "nan", "none", "null", "n/a", "na", "nil", "-", "--", "unknown", "missing"}


@dataclass
class CleanedDataset:
    """Normalised transactions plus the auditable cleaning report."""

    frame: pd.DataFrame
    report: CleaningReport = field(default_factory=CleaningReport)


def parse_money_value(value: object) -> float | None:
    """Parse a money string into a float, tolerating real-world formatting.

    Handles currency symbols, thousands separators, trailing currency codes,
    accounting negatives such as ``(450.00)`` and null-ish sentinels. Returns
    ``None`` when the value cannot be interpreted as a number.
    """

    if value is None:
        return None
    if isinstance(value, (int, float, np.integer, np.floating)) and not isinstance(value, bool):
        number = float(value)
        return number if np.isfinite(number) else None

    text = str(value).strip()
    if text.lower() in _NULLISH:
        return None

    negative = text.startswith("(") and text.endswith(")")
    if negative:
        text = text[1:-1]
    negative = negative or text.lstrip().startswith("-")

    cleaned = _MONEY_CLEAN.sub("", text).lstrip("-")
    if cleaned in {"", "."}:
        return None
    # More than one dot means a malformed number such as "1.2.3".
    if cleaned.count(".") > 1:
        return None
    try:
        number = float(cleaned)
    except ValueError:
        return None
    if not np.isfinite(number):
        return None
    return -abs(number) if negative else number


def _parse_money_series(series: pd.Series) -> pd.Series:
    values = [parse_money_value(value) for value in series.tolist()]
    return pd.Series(pd.to_numeric(pd.Series(values, dtype="object"), errors="coerce"), index=series.index)


def classify_direction(value: object) -> str | None:
    """Classify an explicit transaction-type value as income or expense."""

    if value is None or (isinstance(value, float) and np.isnan(value)):
        return None
    text = _WHITESPACE.sub(" ", str(value).strip().lower())
    if not text or text in _NULLISH:
        return None
    text = text.replace("_", " ").replace("-", " ")

    if text in {"cr", "c", "in", "i", "+"}:
        return "income"
    if text in {"dr", "d", "out", "-"}:
        return "expense"

    # Real exports contain combinations such as "Credit Card Payment" where two
    # tokens disagree. The longest matched token is the most specific one, so it
    # wins; ties fall back to the token that appears first.
    matches: list[tuple[int, int, str]] = []
    for token in INCOME_TOKENS:
        position = text.find(token)
        if position >= 0:
            matches.append((len(token), -position, "income"))
    for token in EXPENSE_TOKENS:
        position = text.find(token)
        if position >= 0:
            matches.append((len(token), -position, "expense"))
    if not matches:
        return None
    matches.sort(reverse=True)
    return matches[0][2]


def _parse_dates(series: pd.Series) -> pd.Series:
    """Parse a text date column, trying month-first and then day-first."""

    parsed = pd.to_datetime(series, errors="coerce", format="mixed")
    missing = parsed.isna() & series.notna()
    if bool(missing.any()):
        retry = pd.to_datetime(series[missing], errors="coerce", format="mixed", dayfirst=True)
        parsed = parsed.copy()
        parsed.loc[missing] = retry
    return parsed


TITLE_CASE_SMALL_WORDS = {"and", "of", "the", "for", "in", "on", "to", "a", "an", "at", "by"}


def _title_case(value: str) -> str:
    """Title-case a value only when it is entirely lower case.

    Mixed case (``BigBasket``) and acronyms (``IRCTC``) are left untouched so
    the pipeline never destroys how a merchant was actually written.
    """

    if value != value.lower() or not any(character.isalpha() for character in value):
        return value
    words = value.split()
    titled: list[str] = []
    for index, word in enumerate(words):
        if index > 0 and word in TITLE_CASE_SMALL_WORDS:
            titled.append(word)
        else:
            titled.append(word[:1].upper() + word[1:])
    return " ".join(titled)


def _canonicalize(series: pd.Series, fallback: str) -> tuple[pd.Series, int]:
    """Trim whitespace and unify case variants to the most common spelling."""

    cleaned = series.map(lambda value: _WHITESPACE.sub(" ", str(value)).strip() if pd.notna(value) else "")
    cleaned = cleaned.replace({"": np.nan})
    filled = int(cleaned.isna().sum())

    keyed = pd.DataFrame({"value": cleaned, "key": cleaned.str.lower()})
    known = keyed.dropna(subset=["key"])
    if known.empty:
        return pd.Series([fallback] * len(series), index=series.index), len(series)

    preferred = known.groupby("key")["value"].agg(lambda values: values.value_counts().idxmax())
    preferred = preferred.map(_title_case)
    result = keyed["key"].map(preferred)
    return result.fillna(fallback), filled


def _line_numbers(frame: pd.DataFrame, headerless: bool) -> pd.Series:
    """Map each row onto its 1-based line number in the uploaded file."""

    offset = 1 if headerless else 2
    return pd.Series(frame.index.to_numpy() + offset, index=frame.index, dtype="int64")


def clean_dataset(
    parsed: ParsedCsv,
    *,
    min_rows: int,
    min_rows_for_clustering: int,
) -> CleanedDataset:
    """Run the full cleaning pipeline over a parsed CSV."""

    if parsed.frame.empty:
        raise ValidationFailure(
            "The uploaded file does not contain any data rows.",
            details=["The file was read successfully but only contained a header or blank lines."],
        )

    frame = parsed.frame.copy()
    detection = detect_columns(frame)
    if detection.missing_required:
        raise ValidationFailure(
            "The file is missing required transaction columns.",
            details=[f"No usable '{name}' column could be found." for name in detection.missing_required]
            + [f"Columns found in the file: {', '.join(str(column) for column in frame.columns)}"],
            context={
                "required": list(detection.missing_required),
                "available_columns": [str(column) for column in frame.columns],
            },
        )

    columns = detection.columns
    issues: list[CleaningIssue] = []
    notes: list[str] = list(parsed.notes) + list(detection.notes)
    lines = _line_numbers(frame, parsed.headerless)

    def line_of(position: int) -> int:
        return int(lines.iloc[position])

    # ---------------------------------------------------------------- dates ----
    raw_dates = frame[columns["date"]]
    parsed_dates = _parse_dates(raw_dates)
    if isinstance(parsed_dates.dtype, pd.DatetimeTZDtype):
        parsed_dates = parsed_dates.dt.tz_localize(None)
    plausible = parsed_dates.notna() & parsed_dates.dt.year.between(MIN_PLAUSIBLE_YEAR, MAX_PLAUSIBLE_YEAR)
    if bool((parsed_dates.notna() & ~plausible).any()):
        notes.append(
            f"Dates outside {MIN_PLAUSIBLE_YEAR}-{MAX_PLAUSIBLE_YEAR} were treated as invalid rather than "
            "being silently accepted."
        )

    invalid_date_positions = np.flatnonzero(~plausible.to_numpy())
    for position in invalid_date_positions[:MAX_REPORTED_ISSUES]:
        issues.append(
            CleaningIssue(
                row=line_of(int(position)),
                column=str(columns["date"]),
                reason="Value could not be parsed as a valid calendar date",
                severity="error",
                value=_preview(raw_dates.iloc[int(position)]),
            )
        )

    # -------------------------------------------------------------- amounts ----
    amount_values: pd.Series | None = None
    derived_flow: pd.Series | None = None

    if columns.get("amount"):
        amount_values = _parse_money_series(frame[columns["amount"]])
        if columns.get("debit") and columns.get("credit"):
            notes.append(
                f"Both '{columns['amount']}' and separate debit/credit columns were present; the explicit "
                "amount column was used."
            )
    elif columns.get("debit") and columns.get("credit"):
        debit_values = _parse_money_series(frame[columns["debit"]]).abs()
        credit_values = _parse_money_series(frame[columns["credit"]]).abs()
        amount_values = credit_values.fillna(0.0) - debit_values.fillna(0.0)
        derived_flow = pd.Series(
            np.where(
                debit_values.notna(),
                "expense",
                np.where(credit_values.notna(), "income", None),
            ),
            index=frame.index,
            dtype="object",
        )
    elif columns.get("debit"):
        amount_values = _parse_money_series(frame[columns["debit"]]).abs() * -1
        derived_flow = pd.Series("expense", index=frame.index, dtype="object")
    elif columns.get("credit"):
        amount_values = _parse_money_series(frame[columns["credit"]]).abs()
        derived_flow = pd.Series("income", index=frame.index, dtype="object")

    assert amount_values is not None  # guaranteed by the required-column check

    if bool(amount_values.isna().any()):
        for position in np.flatnonzero(amount_values.isna().to_numpy())[:MAX_REPORTED_ISSUES]:
            issues.append(
                CleaningIssue(
                    row=line_of(int(position)),
                    column=str(columns.get("amount") or columns.get("debit")),
                    reason="Value could not be parsed as a number",
                    severity="error",
                    value=_preview(frame[columns.get("amount") or columns.get("debit")].iloc[int(position)]),
                )
            )

    zero_mask = amount_values == 0
    if bool(zero_mask.any()):
        notes.append(f"{int(zero_mask.sum())} transaction(s) with a zero amount were ignored as unusable.")

    amount_valid = amount_values.notna() & ~zero_mask

    # --------------------------------------------------------------- flows -----
    explicit_flow: pd.Series | None = None
    if columns.get("transaction_type"):
        unique_values = frame[columns["transaction_type"]].dropna().unique()
        lookup = {value: classify_direction(value) for value in unique_values}
        explicit_flow = frame[columns["transaction_type"]].map(lookup)
        recognised = int(explicit_flow.notna().sum())
        if recognised == 0:
            notes.append(
                f"'{columns['transaction_type']}' was detected as the transaction type column but none of its "
                "values could be classified, so the sign of the amount was used instead."
            )
    elif derived_flow is not None:
        explicit_flow = derived_flow

    signs = np.sign(amount_values.to_numpy(dtype="float64"))
    inferred = pd.Series(np.where(signs < 0, "expense", np.where(signs > 0, "income", None)), index=frame.index, dtype="object")

    if explicit_flow is not None and bool(explicit_flow.notna().any()):
        flow = explicit_flow.where(explicit_flow.notna(), inferred)
    else:
        flow = inferred.copy()

    no_type_source = explicit_flow is None or not bool(explicit_flow.notna().any())
    if no_type_source and not bool((amount_values[amount_valid] < 0).any()):
        category_hint = pd.Series(False, index=frame.index)
        if columns.get("category"):
            category_hint = (
                frame[columns["category"]]
                .fillna("")
                .astype(str)
                .str.lower()
                .map(lambda value: any(hint in value for hint in INCOME_CATEGORY_HINTS))
            )
        flow = pd.Series(np.where(category_hint, "income", "expense"), index=frame.index, dtype="object")
        notes.append(
            "No transaction type column and no negative amounts were found, so positive amounts were treated as "
            "expenses. Rows whose category looks like income were kept as income; add a type column or signed "
            "amounts to separate income reliably."
        )

    unresolved = flow.isna() & amount_valid
    if bool(unresolved.any()):
        flow = flow.where(flow.notna(), "expense")

    # ------------------------------------------------------------ assembling ---
    keep_mask = plausible & amount_valid
    removed = int((~keep_mask).sum())
    if removed:
        notes.append(f"{removed} unreadable row(s) were removed; see the issue list for details.")

    description_column = columns.get("description")
    category_column = columns.get("category")
    if description_column is None:
        notes.append("No description column was available; transactions are labelled 'Unknown merchant'.")
    if category_column is None:
        notes.append("No category column was available; all transactions were placed in 'Uncategorized'.")

    working = pd.DataFrame(
        {
            "date": parsed_dates,
            "amount": amount_values.abs(),
            "signed_amount": np.where(flow.to_numpy() == "income", amount_values.abs(), -amount_values.abs()),
            "flow": flow,
            "description": (
                frame[description_column] if description_column else pd.Series(np.nan, index=frame.index)
            ),
            "category": frame[category_column] if category_column else pd.Series(np.nan, index=frame.index),
            "source_line": lines,
        },
        index=frame.index,
    )

    working = working.loc[keep_mask].copy()

    description, description_filled = _canonicalize(working["description"], "Unknown merchant")
    category, category_filled = _canonicalize(working["category"], "Uncategorized")
    working["description"] = description
    working["category"] = category

    # ------------------------------------------------------------- duplicates --
    duplicate_mask = working.duplicated(subset=["date", "description", "category", "signed_amount"], keep="first")
    duplicates = int(duplicate_mask.sum())
    if duplicates:
        notes.append(f"{duplicates} exact duplicate row(s) were removed.")
        working = working.loc[~duplicate_mask].copy()

    if working.empty:
        raise ValidationFailure(
            "No usable transactions remained after cleaning.",
            details=[issue.reason for issue in issues[:5]]
            or ["Every row either had an unreadable date, an unreadable amount or was a duplicate."],
            context={"rows_read": len(frame)},
        )

    working = working.sort_values(["date", "signed_amount"], ascending=[True, True], kind="stable").reset_index(drop=True)
    working.insert(0, "transaction_id", np.arange(len(working), dtype="int64"))
    working["date"] = pd.to_datetime(working["date"]).dt.normalize()
    working["month"] = working["date"].dt.strftime("%Y-%m")
    working["month_label"] = working["date"].dt.strftime("%b %Y")
    working["weekday"] = working["date"].dt.day_name().str.slice(0, 3)
    working["amount"] = working["amount"].astype("float64")
    working["signed_amount"] = working["signed_amount"].astype("float64")
    working["flow"] = working["flow"].astype("str")
    working["description"] = working["description"].astype("str")
    working["category"] = working["category"].astype("str")

    rows_clean = len(working)
    if rows_clean < min_rows:
        raise ValidationFailure(
            f"Only {rows_clean} usable transaction(s) were found, which is not enough to build a dashboard.",
            details=[f"At least {min_rows} readable transactions are required."],
        )

    expense_rows = int((working["flow"] == "expense").sum())
    income_rows = int((working["flow"] == "income").sum())

    if rows_clean < min_rows_for_clustering:
        notes.append(
            f"Only {rows_clean} transactions are available; at least {min_rows_for_clustering} are required before "
            "spending clusters can be computed."
        )
    if income_rows == 0:
        notes.append("No income rows were detected; income-based metrics are reported as zero.")
    if expense_rows == 0:
        notes.append("No expense rows were detected; spending metrics are reported as zero.")

    reported = min(len(issues), MAX_REPORTED_ISSUES)
    report = CleaningReport(
        rows_read=len(frame),
        rows_clean=rows_clean,
        rows_removed=max(removed, int(len(frame) - rows_clean)),
        invalid_date_rows=int((~plausible).sum()),
        invalid_amount_rows=int((amount_values.isna() | zero_mask).sum()),
        duplicate_rows_removed=duplicates,
        missing_category_filled=category_filled,
        missing_description_filled=description_filled,
        income_rows=income_rows,
        expense_rows=expense_rows,
        delimiter=parsed.delimiter,
        truncated_rows=parsed.truncated_rows,
        detected_columns=[
            DetectedColumn(field=name, source_column=columns.get(name), confidence=detection.confidence.get(name, "missing"))
            for name in columns
            if name not in {"debit", "credit", "balance"}
        ],
        issues=issues[:reported],
        notes=notes,
        truncated_issues=max(0, len(issues) - reported),
    )

    return CleanedDataset(frame=working, report=report)


def _preview(value: object, limit: int = 60) -> str:
    text = str(value)
    return text if len(text) <= limit else f"{text[: limit - 1]}…"


__all__ = ["CleanedDataset", "classify_direction", "clean_dataset", "parse_money_value"]
