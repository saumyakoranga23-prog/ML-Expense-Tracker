"""Tests for safe CSV loading."""

from __future__ import annotations

from app.services.columns import detect_columns, normalize_column_name
from app.services.csv_loading import decode_bytes, read_transactions_csv, sniff_delimiter


def test_sniff_delimiter_supports_common_separators() -> None:
    assert sniff_delimiter("date,description,amount\n2024-01-01,Coffee,120\n") == ","
    assert sniff_delimiter("date;description;amount\n2024-01-01;Coffee;120\n") == ";"
    assert sniff_delimiter("date\tdescription\tamount\n2024-01-01\tCoffee\t120\n") == "\t"


def test_decode_bytes_falls_back_to_cp1252() -> None:
    text, encoding = decode_bytes("Café €120".encode("cp1252"))
    assert "Caf" in text
    assert encoding in {"cp1252", "latin-1 (lossy)"}


def test_headerless_file_gets_generated_column_names_and_value_detection() -> None:
    text = "2024-01-05,Swiggy,Food,250.00\n2024-01-06,Uber,Transport,180.00\n"
    parsed = read_transactions_csv(text, max_rows=100)
    assert parsed.headerless is True
    assert list(parsed.frame.columns) == ["column_1", "column_2", "column_3", "column_4"]

    detection = detect_columns(parsed.frame)
    assert detection.columns["date"] == "column_1"
    assert detection.columns["amount"] == "column_4"
    assert detection.missing_required == []


def test_row_limit_truncates_and_reports() -> None:
    rows = "\n".join(f"2024-01-{index % 28 + 1:02d},Merchant {index},Food,{100 + index}.00" for index in range(50))
    parsed = read_transactions_csv("date,description,category,amount\n" + rows, max_rows=10)
    assert len(parsed.frame) == 10
    assert parsed.truncated_rows == 40
    assert any("row limit" in note for note in parsed.notes)


def test_normalize_column_name_strips_noise() -> None:
    assert normalize_column_name("Txn Date") == "txn_date"
    assert normalize_column_name("Withdrawal Amt. (INR)") == "withdrawal_amt_inr"
    assert normalize_column_name("  Amount  ") == "amount"


def test_detects_bank_style_aliases() -> None:
    header = "Txn Date,Narration,Category,Withdrawal Amt.,Deposit Amt.\n"
    body = "2024-01-05,Coffee,Food,250.00,\n2024-01-06,Salary,Income,,150000.00\n"
    parsed = read_transactions_csv(header + body, max_rows=100)
    detection = detect_columns(parsed.frame)

    assert detection.columns["date"] == "Txn Date"
    assert detection.columns["description"] == "Narration"
    assert detection.columns["category"] == "Category"
    assert detection.columns["debit"] == "Withdrawal Amt."
    assert detection.columns["credit"] == "Deposit Amt."
    assert detection.missing_required == []
