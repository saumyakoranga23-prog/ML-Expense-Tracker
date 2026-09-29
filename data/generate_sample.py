"""Generate the packaged sample transaction dataset.

The generator only uses the Python standard library, so the dataset can be
regenerated on a clean machine without installing the project dependencies:

    python data/generate_sample.py

The output intentionally contains a handful of realistic "dirty" rows
(duplicates, blank fields, accounting parentheses, a currency symbol, an
unparseable date and a non-numeric amount) so the cleaning pipeline that runs
on upload has something meaningful to report.
"""

from __future__ import annotations

import csv
import random
from datetime import date
from pathlib import Path

SEED = 20240917
START = date(2023, 10, 1)
MONTHS = 24
OUTPUT = Path(__file__).resolve().parent / "sample_transactions.csv"
HEADER = ["date", "description", "category", "amount", "transaction_type"]

# category -> (merchants, monthly count range, amount range, weekend bias)
BEHAVIOUR_PROFILES = {
    "Food & Dining": (
        ["Swiggy", "Zomato", "Cafe Coffee Day", "Third Wave Coffee", "Blinkit Cafe"],
        (16, 22),
        (140.0, 980.0),
        0.75,
    ),
    "Groceries": (
        ["BigBasket", "Zepto", "Reliance Fresh", "DMart", "More Supermarket"],
        (5, 8),
        (350.0, 3200.0),
        0.45,
    ),
    "Transport": (
        ["Uber", "Ola Cabs", "Namma Metro", "Indian Oil Fuel", "Rapido"],
        (12, 18),
        (60.0, 900.0),
        0.2,
    ),
    "Entertainment": (
        ["PVR Cinemas", "BookMyShow", "Steam Games"],
        (1, 3),
        (300.0, 1800.0),
        0.8,
    ),
    "Health": (
        ["Apollo Pharmacy", "Practo Consultation", "PharmEasy"],
        (0, 2),
        (250.0, 2200.0),
        0.25,
    ),
    "Dining Out": (
        ["Truffles", "Toit Brewpub", "Barbeque Nation", "The Permit Room"],
        (3, 6),
        (800.0, 3800.0),
        0.85,
    ),
    "Shopping": (
        ["Amazon India", "Myntra", "Ajio", "Decathlon"],
        (1, 3),
        (700.0, 6000.0),
        0.7,
    ),
    "Education": (
        ["Coursera", "Udemy", "O'Reilly Learning"],
        (0, 1),
        (500.0, 4500.0),
        0.15,
    ),
}

# (merchants, category, monthly probability, amount range, seasonal months, seasonal multiplier)
OCCASIONAL_EVENTS = [
    (["Reliance Digital", "Croma", "Apple Store", "Vijay Sales"], "Electronics", 0.18, (12000.0, 95000.0), {10, 11}, 1.35),
    (["MakeMyTrip", "IndiGo", "IRCTC", "Airbnb"], "Travel", 0.22, (4500.0, 52000.0), {12, 4}, 1.5),
    (["IKEA", "Pepperfry", "Urban Ladder"], "Home & Furniture", 0.12, (3000.0, 28000.0), {10}, 1.2),
]

# (day of month, description, category, amount, jitter)
FIXED_MONTHLY = [
    (1, "Rent - Palm Grove Apartments", "Housing", 32000.0, 0.0),
    (3, "Airtel Fiber Broadband", "Utilities", 1199.0, 0.0),
    (4, "State Electricity Board Bill", "Utilities", 2450.0, 700.0),
    (5, "Tata AIG Health Insurance", "Insurance", 3400.0, 0.0),
    (7, "Netflix Subscription", "Subscriptions", 649.0, 0.0),
    (9, "Spotify Premium", "Subscriptions", 119.0, 0.0),
    (12, "Cult.fit Gym Membership", "Fitness", 1799.0, 0.0),
]


def month_starts() -> list[date]:
    starts: list[date] = []
    year, month = START.year, START.month
    for _ in range(MONTHS):
        starts.append(date(year, month, 1))
        month += 1
        if month > 12:
            month, year = 1, year + 1
    return starts


def days_in_month(month_start: date) -> int:
    if month_start.month == 12:
        nxt = date(month_start.year + 1, 1, 1)
    else:
        nxt = date(month_start.year, month_start.month + 1, 1)
    return (nxt - month_start).days


def pick_day(rng: random.Random, month_start: date, weekend_bias: float) -> date:
    """Pick a day inside the month, biased towards weekends when requested."""
    span = days_in_month(month_start)
    for _ in range(12):
        candidate = date(month_start.year, month_start.month, rng.randint(1, span))
        if candidate.weekday() >= 5 and rng.random() > weekend_bias:
            continue
        return candidate
    return date(month_start.year, month_start.month, rng.randint(1, span))


def money(rng: random.Random, low: float, high: float, scale: float = 1.0) -> float:
    return round(rng.uniform(low, high) * scale, 2)


def build_rows(rng: random.Random) -> list[tuple[date | str, str, str, float | str, str]]:
    rows: list[tuple[date | str, str, str, float | str, str]] = []

    for index, month_start in enumerate(month_starts()):
        # Moderate inflation plus slight lifestyle creep over the two years.
        scale = 1.0 + 0.006 * index
        festival = month_start.month in {10, 11}
        holiday = month_start.month in {12, 4}

        # ---- income -----------------------------------------------------
        salary = 152000.0 if index < 12 else 168000.0
        rows.append((date(month_start.year, month_start.month, 1), "Salary Credit - Nexora Technologies", "Income", salary, "Credit"))
        if rng.random() < 0.4:
            day = date(month_start.year, month_start.month, rng.randint(15, 26))
            rows.append((day, "Freelance Project Payment", "Income", money(rng, 15000, 48000, scale), "Credit"))
        if rng.random() < 0.12:
            day = date(month_start.year, month_start.month, rng.randint(8, 20))
            rows.append((day, "Mutual Fund Dividend Payout", "Income", money(rng, 2500, 12000, scale), "Credit"))

        # ---- fixed recurring expenses -----------------------------------
        for day, description, category, amount, jitter in FIXED_MONTHLY:
            value = amount + (rng.uniform(-jitter, jitter) if jitter else 0.0)
            rows.append((date(month_start.year, month_start.month, day), description, category, round(value, 2), "Debit"))

        # ---- high-frequency behaviour ------------------------------------
        for category, (merchants, count_range, (low, high), weekend_bias) in BEHAVIOUR_PROFILES.items():
            count = rng.randint(*count_range)
            if category == "Shopping" and festival:
                count += rng.randint(1, 3)
            for _ in range(count):
                merchant = rng.choice(merchants)
                local_scale = scale * (1.25 if festival and category == "Shopping" else 1.0)
                day = pick_day(rng, month_start, weekend_bias)
                rows.append((day, merchant, category, money(rng, low, high, local_scale), "Debit"))

        # ---- occasional high-value purchases ------------------------------
        for merchants, category, probability, (low, high), seasonal_months, seasonal_mult in OCCASIONAL_EVENTS:
            if rng.random() >= probability:
                continue
            merchant = rng.choice(merchants)
            local_scale = scale * (seasonal_mult if month_start.month in seasonal_months else 1.0)
            if category == "Travel" and holiday:
                local_scale *= 1.2
            day = pick_day(rng, month_start, 0.3)
            rows.append((day, merchant, category, money(rng, low, high, local_scale), "Debit"))

    rows.sort(key=lambda row: row[0])
    return rows


def add_dirty_rows(
    rng: random.Random, rows: list[tuple[date | str, str, str, float | str, str]]
) -> list[tuple[date | str, str, str, float | str, str]]:
    """Append the realistic imperfections the cleaning pipeline must handle."""
    dirt: list[tuple[date | str, str, str, float | str, str]] = []

    # Three byte-identical duplicate rows (bank export artefacts).
    for source in rng.sample([r for r in rows if r[4] == "Debit"], 3):
        dirt.append(source)

    mid = rows[len(rows) // 3][0]
    late = rows[-len(rows) // 4][0]

    # Blank category / blank description: filled by the pipeline.
    dirt.append((mid, "Local Kirana Store", "", 480.0, "Debit"))
    dirt.append((late, "Metro Card Recharge", "", 300.0, "Debit"))
    dirt.append((mid, "", "Groceries", 1180.5, "Debit"))
    dirt.append((late, "", "Transport", 220.0, "Debit"))

    # Currency symbol and thousands separator.
    dirt.append((late, "Vijay Sales", "Electronics", "₹1,250.00", "Debit"))
    # Accounting-style negative in parentheses.
    dirt.append((mid, "Corner Bakery", "Food & Dining", "(450.00)", "Debit"))
    # Inconsistent casing / surrounding whitespace on a known category.
    dirt.append((mid, "  Swiggy  ", " food & dining ", 610.0, "Debit"))
    # Clean credit written with a negative sign (must still be income).
    dirt.append((mid, "Refund - Amazon India", "Shopping", -899.0, "Credit"))

    combined = rows + dirt
    # Two rows that simply cannot be interpreted: a date that does not exist and
    # an amount that is text. Both must be reported and dropped, never coerced.
    combined.append(("31/02/2025", "Malformed Date Row", "Food & Dining", 780.0, "Debit"))
    combined.append((date(2024, 7, 14), "Non Numeric Amount Row", "Shopping", "N/A", "Debit"))
    combined.sort(key=lambda row: str(row[0]))
    return combined


def format_amount(value: float | str) -> str:
    if isinstance(value, str):
        return value
    return f"{value:.2f}"


def format_date(value: date | str) -> str:
    if isinstance(value, str):
        return value
    return value.isoformat()


def main() -> None:
    rng = random.Random(SEED)
    rows = add_dirty_rows(rng, build_rows(rng))

    with OUTPUT.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(HEADER)
        for row_date, description, category, amount, txn_type in rows:
            writer.writerow([format_date(row_date), description, category, format_amount(amount), txn_type])

    print(f"Wrote {len(rows)} rows to {OUTPUT}")


if __name__ == "__main__":
    main()
