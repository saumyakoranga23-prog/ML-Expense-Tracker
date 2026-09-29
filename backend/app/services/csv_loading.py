"""Safe CSV decoding, delimiter sniffing and header detection.

Nothing here executes user input: the file is decoded from bytes, split with the
``csv`` module for delimiter detection and parsed by pandas with explicit
options. The raw text never reaches a shell, an evaluator or the filesystem.
"""

from __future__ import annotations

import csv
import io
import re
from dataclasses import dataclass, field

import pandas as pd

SNIFF_CHARS = 8192
CANDIDATE_DELIMITERS = ",;\t|"

# Values pandas treats as missing. Kept explicit so behaviour is predictable.
NA_VALUES = ["", "na", "n/a", "null", "none", "nil", "nan", "-", "--", "unknown"]

_NUMBER_LIKE = re.compile(r"^-?[\d\s.,()]+$")
_DATE_LIKE = re.compile(r"^\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}|^\d{4}-\d{2}-\d{2}")


@dataclass
class ParsedCsv:
    """Result of decoding and reading an uploaded CSV."""

    frame: pd.DataFrame
    delimiter: str = ","
    encoding: str = "utf-8"
    headerless: bool = False
    truncated_rows: int = 0
    notes: list[str] = field(default_factory=list)


def decode_bytes(raw: bytes) -> tuple[str, str]:
    """Decode as UTF-8, falling back to common single-byte encodings."""

    for encoding in ("utf-8-sig", "utf-8", "cp1252"):
        try:
            return raw.decode(encoding), encoding
        except UnicodeDecodeError:
            continue
    return raw.decode("latin-1", errors="replace"), "latin-1 (lossy)"


def sniff_delimiter(text: str) -> str:
    """Guess the field delimiter from the first lines of the file."""

    sample = text[:SNIFF_CHARS]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=CANDIDATE_DELIMITERS)
        if dialect.delimiter:
            return dialect.delimiter
    except csv.Error:
        pass

    first_line = next((line for line in sample.splitlines() if line.strip()), "")
    counts = {delimiter: first_line.count(delimiter) for delimiter in CANDIDATE_DELIMITERS}
    best = max(counts, key=lambda key: counts[key])
    return best if counts[best] > 0 else ","


def _looks_like_header(row: list[str]) -> bool:
    """A header row is text-heavy and almost never parses as money or a date."""

    cells = [str(cell).strip() for cell in row if str(cell).strip() != ""]
    if not cells:
        return True
    data_like = 0
    for cell in cells:
        if _DATE_LIKE.match(cell) or (_NUMBER_LIKE.match(cell) and any(ch.isdigit() for ch in cell)):
            data_like += 1
    return data_like / len(cells) < 0.34


def read_transactions_csv(text: str, *, max_rows: int) -> ParsedCsv:
    """Read a transaction CSV defensively, returning a string-typed frame.

    Missing values are normalised to ``NaN`` and every column is kept as text so
    the cleaning pipeline sees exactly what the user exported (including things
    like ``"₹1,250.00"`` or ``"(450.00)"``).
    """

    notes: list[str] = []
    delimiter = sniff_delimiter(text)

    common = {
        "sep": delimiter,
        "dtype": str,
        "keep_default_na": True,
        "na_values": NA_VALUES,
        "skip_blank_lines": True,
        "engine": "python",
    }

    preview = pd.read_csv(io.StringIO(text), header=None, nrows=3, **common)
    headerless = False
    if not preview.empty and not _looks_like_header(list(preview.iloc[0])):
        headerless = True
        notes.append(
            "The first line did not look like a header row, so column names were generated "
            "from the file position and the fields were detected by inspecting values."
        )

    frame = pd.read_csv(io.StringIO(text), header=None if headerless else 0, **common)
    if headerless:
        frame.columns = [f"column_{index + 1}" for index in range(frame.shape[1])]

    # Drop rows that are entirely empty (common at the end of bank exports).
    # The original index is preserved so cleaning can report accurate file line
    # numbers for every rejected row.
    before = len(frame)
    frame = frame.dropna(how="all")
    if before != len(frame):
        notes.append(f"Removed {before - len(frame)} fully empty line(s).")

    truncated = 0
    if len(frame) > max_rows:
        truncated = len(frame) - max_rows
        frame = frame.iloc[:max_rows]
        notes.append(
            f"The file contained more than the {max_rows:,} row limit, so only the first "
            f"{max_rows:,} rows were analysed ({truncated:,} rows ignored)."
        )

    return ParsedCsv(
        frame=frame,
        delimiter=delimiter,
        headerless=headerless,
        truncated_rows=truncated,
        notes=notes,
    )


__all__ = ["ParsedCsv", "decode_bytes", "read_transactions_csv", "sniff_delimiter"]
