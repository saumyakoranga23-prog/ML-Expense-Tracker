"""Deterministic financial analytics computed from the cleaned transaction frame.

Everything the dashboard shows is derived here from the processed dataset: KPI
cards, monthly series, category breakdowns, transaction volume and merchant
rankings. No values are mocked or randomised.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timezone

import numpy as np
import pandas as pd

from app.schemas.dataset import (
    CategoryStat,
    DatasetSummary,
    Kpis,
    MerchantStat,
    MonthlyPoint,
    VolumePoint,
)
from app.services.cleaning import CleanedDataset

TREND_WINDOW_MONTHS = 3
RECENT_MONTHS_FOR_TREND = 3


def money(value: float) -> float:
    """Round a monetary value and normalise non-finite input to zero."""

    if value is None or not np.isfinite(value):
        return 0.0
    return round(float(value), 2)


def ratio(value: float, digits: int = 3) -> float:
    if value is None or not np.isfinite(value):
        return 0.0
    return round(float(value), digits)


def percent(value: float, digits: int = 1) -> float:
    if value is None or not np.isfinite(value):
        return 0.0
    return round(float(value), digits)


def safe_divide(numerator: float, denominator: float, default: float = 0.0) -> float:
    if not denominator or not np.isfinite(denominator) or denominator == 0:
        return default
    result = numerator / denominator
    return float(result) if np.isfinite(result) else default


def month_sequence(frame: pd.DataFrame) -> list[str]:
    """Continuous list of ``YYYY-MM`` keys covering the dataset's full range."""

    if frame.empty:
        return []
    start = pd.Period(frame["date"].min(), freq="M")
    end = pd.Period(frame["date"].max(), freq="M")
    return [str(period) for period in pd.period_range(start, end, freq="M")]


def month_label(month: str) -> str:
    return pd.Period(month, freq="M").strftime("%b %Y")


@dataclass
class DatasetContext:
    """Shared intermediate statistics reused by every analytics service."""

    frame: pd.DataFrame
    expenses: pd.DataFrame
    incomes: pd.DataFrame
    months: list[str]
    month_count: int
    total_spending: float
    total_income: float
    expense_count: int
    income_count: int
    average_expense: float
    median_expense: float
    average_transaction: float
    transactions_per_month: float
    category_totals: pd.Series
    category_counts: pd.Series
    weekend_share: float
    category_diversity: int
    first_date: date
    last_date: date

    @property
    def net_cash_flow(self) -> float:
        return self.total_income - self.total_spending


def build_context(cleaned: CleanedDataset) -> DatasetContext:
    frame = cleaned.frame
    expenses = frame[frame["flow"] == "expense"]
    incomes = frame[frame["flow"] == "income"]
    months = month_sequence(frame)
    month_count = max(len(months), 1)

    category_totals = (
        expenses.groupby("category")["amount"].sum().sort_values(ascending=False)
        if not expenses.empty
        else pd.Series(dtype="float64")
    )
    category_counts = (
        expenses.groupby("category")["amount"].size() if not expenses.empty else pd.Series(dtype="int64")
    )

    weekend_share = 0.0
    if not frame.empty:
        weekend = frame["weekday"].isin(["Sat", "Sun"])
        weekend_share = safe_divide(float(weekend.sum()), float(len(frame))) * 100

    return DatasetContext(
        frame=frame,
        expenses=expenses,
        incomes=incomes,
        months=months,
        month_count=month_count,
        total_spending=money(expenses["amount"].sum()) if not expenses.empty else 0.0,
        total_income=money(incomes["amount"].sum()) if not incomes.empty else 0.0,
        expense_count=int(len(expenses)),
        income_count=int(len(incomes)),
        average_expense=money(expenses["amount"].mean()) if not expenses.empty else 0.0,
        median_expense=money(expenses["amount"].median()) if not expenses.empty else 0.0,
        average_transaction=money(frame["amount"].mean()) if not frame.empty else 0.0,
        transactions_per_month=safe_divide(len(frame), month_count),
        category_totals=category_totals,
        category_counts=category_counts,
        weekend_share=weekend_share,
        category_diversity=int(frame["category"].nunique()) if not frame.empty else 0,
        first_date=frame["date"].min().date(),
        last_date=frame["date"].max().date(),
    )


def _monthly_points(context: DatasetContext) -> list[MonthlyPoint]:
    frame = context.frame
    if frame.empty:
        return []

    income_by_month = context.incomes.groupby("month")["amount"].sum() if not context.incomes.empty else pd.Series(dtype="float64")
    expense_by_month = context.expenses.groupby("month")["amount"].sum() if not context.expenses.empty else pd.Series(dtype="float64")
    count_by_month = frame.groupby("month")["amount"].size()
    avg_by_month = context.expenses.groupby("month")["amount"].mean() if not context.expenses.empty else pd.Series(dtype="float64")

    points: list[MonthlyPoint] = []
    for month in context.months:
        income = money(float(income_by_month.get(month, 0.0)))
        expense = money(float(expense_by_month.get(month, 0.0)))
        points.append(
            MonthlyPoint(
                month=month,
                label=month_label(month),
                income=income,
                expense=expense,
                net=money(income - expense),
                transactions=int(count_by_month.get(month, 0)),
                avg_transaction=money(float(avg_by_month.get(month, 0.0))),
            )
        )
    return points


def _volume_points(context: DatasetContext) -> list[VolumePoint]:
    if context.frame.empty:
        return []
    by_month = context.frame.groupby(["month", "flow"]).size().unstack(fill_value=0)
    points: list[VolumePoint] = []
    for month in context.months:
        row = by_month.loc[month] if month in by_month.index else None
        expenses = int(row["expense"]) if row is not None and "expense" in row else 0
        incomes = int(row["income"]) if row is not None and "income" in row else 0
        points.append(
            VolumePoint(
                month=month,
                label=month_label(month),
                transactions=expenses + incomes,
                expenses=expenses,
                incomes=incomes,
            )
        )
    return points


def _trend_change(values: list[float]) -> float:
    """Percent change between the recent window and the window before it."""

    if len(values) < 2:
        return 0.0
    window = min(RECENT_MONTHS_FOR_TREND, max(1, len(values) // 2))
    recent = values[-window:]
    previous = values[-2 * window : -window] or values[:-window]
    if not previous:
        return 0.0
    recent_avg = float(np.mean(recent))
    previous_avg = float(np.mean(previous))
    if previous_avg == 0:
        return 0.0
    return percent(safe_divide(recent_avg - previous_avg, previous_avg) * 100)


def _category_stats(context: DatasetContext) -> list[CategoryStat]:
    if context.expenses.empty:
        return []

    stats: list[CategoryStat] = []
    for category, group in context.expenses.groupby("category"):
        monthly_spend = group.groupby("month")["amount"].sum()
        trend_values = [money(float(monthly_spend.get(month, 0.0))) for month in context.months]
        total = money(group["amount"].sum())
        stats.append(
            CategoryStat(
                category=str(category),
                total_spending=total,
                share=percent(safe_divide(total, context.total_spending) * 100),
                transactions=int(len(group)),
                average_transaction=money(group["amount"].mean()),
                largest_transaction=money(group["amount"].max()),
                monthly=[
                    MonthlyPoint(
                        month=month,
                        label=month_label(month),
                        income=0.0,
                        expense=trend_values[index],
                        net=money(-trend_values[index]),
                        transactions=int(monthly_spend.get(month, 0)),
                        avg_transaction=money(
                            safe_divide(trend_values[index], float(monthly_spend.get(month, 0) or 1))
                        ),
                    )
                    for index, month in enumerate(context.months)
                ],
                trend_change=_trend_change(trend_values),
                first_date=group["date"].min().date(),
                last_date=group["date"].max().date(),
            )
        )

    stats.sort(key=lambda item: item.total_spending, reverse=True)
    return stats


def _merchant_stats(context: DatasetContext, limit: int) -> list[MerchantStat]:
    if context.expenses.empty:
        return []
    grouped = (
        context.expenses.groupby("description")
        .agg(
            total=("amount", "sum"),
            transactions=("amount", "size"),
            average=("amount", "mean"),
            category=("category", lambda values: values.value_counts().idxmax()),
        )
        .sort_values("total", ascending=False)
        .head(limit)
    )
    return [
        MerchantStat(
            description=str(name),
            category=str(row["category"]),
            total_spending=money(row["total"]),
            transactions=int(row["transactions"]),
            average_transaction=money(row["average"]),
        )
        for name, row in grouped.iterrows()
    ]


def _kpis(context: DatasetContext) -> Kpis:
    largest_expense = 0.0
    largest_description: str | None = None
    largest_date: date | None = None
    largest_category: str | None = None
    if not context.expenses.empty:
        row = context.expenses.loc[context.expenses["amount"].idxmax()]
        largest_expense = money(row["amount"])
        largest_description = str(row["description"])
        largest_date = row["date"].date()
        largest_category = str(row["category"])

    savings_rate = 0.0
    if context.total_income > 0:
        savings_rate = percent(safe_divide(context.net_cash_flow, context.total_income) * 100)

    return Kpis(
        total_spending=context.total_spending,
        total_income=context.total_income,
        net_cash_flow=money(context.net_cash_flow),
        average_monthly_spending=money(safe_divide(context.total_spending, context.month_count)),
        average_monthly_income=money(safe_divide(context.total_income, context.month_count)),
        largest_expense=largest_expense,
        largest_expense_description=largest_description,
        largest_expense_date=largest_date,
        largest_expense_category=largest_category,
        transaction_count=int(len(context.frame)),
        expense_count=context.expense_count,
        income_count=context.income_count,
        average_transaction=context.average_transaction,
        average_expense=context.average_expense,
        median_expense=context.median_expense,
        savings_rate=savings_rate,
        months_covered=context.month_count,
        first_date=context.first_date,
        last_date=context.last_date,
    )


def build_summary(
    dataset_id: str,
    cleaned: CleanedDataset,
    *,
    top_merchants: int = 8,
    context: DatasetContext | None = None,
) -> DatasetSummary:
    """Assemble the full financial summary for the dashboard."""

    ctx = context or build_context(cleaned)
    return DatasetSummary(
        dataset_id=dataset_id,
        kpis=_kpis(ctx),
        monthly=_monthly_points(ctx),
        categories=_category_stats(ctx),
        volume=_volume_points(ctx),
        top_merchants=_merchant_stats(ctx, top_merchants),
        cleaning=cleaned.report,
        generated_at=datetime.now(timezone.utc),
    )


__all__ = [
    "DatasetContext",
    "build_context",
    "build_summary",
    "money",
    "month_label",
    "month_sequence",
    "percent",
    "ratio",
    "safe_divide",
]
