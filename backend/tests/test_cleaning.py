"""Tests for the data cleaning pipeline."""

from __future__ import annotations

import pytest

from app.services.cleaning import classify_direction, clean_dataset, parse_money_value
from app.services.csv_loading import read_transactions_csv
from app.utils.errors import ValidationFailure
from tests.conftest import csv_bytes, synthetic_rows


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("1250.00", 1250.0),
        ("₹1,250.00", 1250.0),
        ("$1,234.56", 1234.56),
        ("1200 INR", 1200.0),
        ("(450.00)", -450.0),
        ("-899.00", -899.0),
        ("1,250", 1250.0),
        ("  42  ", 42.0),
        ("N/A", None),
        ("", None),
        ("-", None),
        ("1.2.3", None),
        ("abc", None),
        (None, None),
    ],
)
def test_parse_money_value(raw: object, expected: float | None) -> None:
    assert parse_money_value(raw) == expected


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("Debit", "expense"),
        ("DR", "expense"),
        ("Withdrawal", "expense"),
        ("MONEY OUT", "expense"),
        ("Credit Card Payment", "expense"),
        ("Purchase", "expense"),
        ("Credit", "income"),
        ("CR", "income"),
        ("Deposit", "income"),
        ("Salary", "income"),
        ("Refund", "income"),
        ("Salary Credit", "income"),
        ("", None),
        ("whatever", None),
    ],
)
def test_classify_direction(raw: str, expected: str | None) -> None:
    assert classify_direction(raw) == expected


def _clean(text: str, **overrides: int):
    parsed = read_transactions_csv(text, max_rows=overrides.pop("max_rows", 10_000))
    return clean_dataset(
        parsed,
        min_rows=overrides.pop("min_rows", 2),
        min_rows_for_clustering=overrides.pop("min_rows_for_clustering", 8),
    )


def test_pipeline_normalises_amounts_dates_and_flow() -> None:
    rows = [
        ("2024-01-05", "Swiggy", " food & dining ", "₹1,250.00", "Debit"),
        ("2024-01-06", "Croma", "Electronics", "(450.00)", "Debit"),
        ("2024-01-31", "Salary Credit", "Income", "152000.00", "Credit"),
        ("2024-02-01", "Refund - Amazon", "Shopping", "-899.00", "Credit"),
    ]
    cleaned = _clean(csv_bytes(rows).decode())
    frame = cleaned.frame

    assert list(frame["flow"]) == ["expense", "expense", "income", "income"]
    assert frame["amount"].tolist() == [1250.0, 450.0, 152000.0, 899.0]
    assert frame["signed_amount"].tolist() == [-1250.0, -450.0, 152000.0, 899.0]
    # Case variants of a category collapse onto the most common spelling.
    assert set(frame["category"]) == {"Food & Dining", "Electronics", "Income", "Shopping"}
    assert cleaned.report.income_rows == 2
    assert cleaned.report.expense_rows == 2


def test_pipeline_reports_and_removes_unreadable_rows() -> None:
    rows = [
        ("2024-01-05", "Swiggy", "Food", "250.00", "Debit"),
        ("31/02/2024", "Broken date", "Food", "300.00", "Debit"),
        ("2024-01-09", "Broken amount", "Food", "N/A", "Debit"),
        ("2024-01-10", "Zero amount", "Food", "0", "Debit"),
        ("2024-01-05", "Swiggy", "Food", "250.00", "Debit"),  # exact duplicate
        ("2024-01-12", "Uber", "Transport", "180.00", "Debit"),
    ]
    cleaned = _clean(csv_bytes(rows).decode())

    assert cleaned.report.rows_read == 6
    assert cleaned.report.rows_clean == 2
    assert cleaned.report.invalid_date_rows == 1
    assert cleaned.report.duplicate_rows_removed == 1
    assert cleaned.report.invalid_amount_rows == 2
    reasons = " ".join(issue.reason for issue in cleaned.report.issues)
    assert "calendar date" in reasons
    assert "parse" in reasons
    # The reported line numbers point at the original file lines.
    assert sorted(issue.row for issue in cleaned.report.issues) == [3, 4]


def test_missing_category_and_description_are_filled_and_reported() -> None:
    rows = [
        ("2024-01-05", "Swiggy", "", "250.00", "Debit"),
        ("2024-01-06", "", "Groceries", "800.00", "Debit"),
    ]
    cleaned = _clean(csv_bytes(rows).decode())

    assert cleaned.frame["category"].tolist()[0] == "Uncategorized"
    assert cleaned.frame["description"].tolist()[1] == "Unknown merchant"
    assert cleaned.report.missing_category_filled == 1
    assert cleaned.report.missing_description_filled == 1


def test_positive_only_amounts_without_type_are_treated_as_expenses_with_a_warning() -> None:
    rows = [
        ("2024-01-05", "Swiggy", "Food", "250.00"),
        ("2024-01-06", "Uber", "Transport", "180.00"),
        ("2024-02-01", "Salary Credit", "Income", "150000.00"),
    ]
    text = csv_bytes(rows, header=("date", "description", "category", "amount")).decode()
    cleaned = _clean(text)

    assert set(cleaned.frame["flow"]) == {"expense", "income"}
    assert any("positive amounts were treated as expenses" in note for note in cleaned.report.notes)
    # The row whose category looks like income is preserved as income.
    salary = cleaned.frame[cleaned.frame["description"] == "Salary Credit"]
    assert salary["flow"].iloc[0] == "income"


def test_debit_and_credit_columns_are_combined() -> None:
    rows = [
        ("2024-01-05", "Swiggy", "Food", "250.00", ""),
        ("2024-01-06", "Salary", "Income", "", "150000.00"),
    ]
    text = csv_bytes(rows, header=("date", "description", "category", "Debit", "Credit")).decode()
    cleaned = _clean(text)

    assert cleaned.frame["flow"].tolist() == ["expense", "income"]
    assert cleaned.frame["signed_amount"].tolist() == [-250.0, 150000.0]


def test_missing_required_columns_raise_a_clear_validation_error() -> None:
    text = csv_bytes([("Swiggy", "250.00")], header=("merchant_name_only", "value_thing")).decode()
    with pytest.raises(ValidationFailure) as error:
        _clean(text)
    assert "missing required transaction columns" in error.value.message.lower()
    assert any("date" in detail for detail in error.value.details)


def test_empty_file_is_rejected() -> None:
    with pytest.raises(ValidationFailure):
        _clean("date,description,amount\n")


def test_too_few_rows_for_clustering_is_a_note_not_an_error() -> None:
    cleaned = _clean(csv_bytes(synthetic_rows(count=4)).decode())
    assert cleaned.report.rows_clean == 4
    assert any("required before spending clusters" in note for note in cleaned.report.notes)
