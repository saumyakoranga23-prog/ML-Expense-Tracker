"""Deterministic spending insights.

Every sentence here is generated from a statistic that is computed on the spot.
There is no model-generated advice, no randomness and no prose template that can
appear without the supporting number existing in the response payload.
"""

from __future__ import annotations

from datetime import datetime, timezone

import numpy as np
import pandas as pd

from app.schemas.clustering import ClusterStat
from app.schemas.insights import Insight, InsightMetric, InsightsResponse
from app.services.analytics import (
    DatasetContext,
    money,
    month_label,
    percent,
    ratio,
    safe_divide,
)

RECURRING_MONTH_SHARE = 0.7
MIN_TRANSACTIONS_FOR_OUTLIERS = 20
MAX_INSIGHTS = 12


def _metric(label: str, value: float, kind: str) -> InsightMetric:
    return InsightMetric(label=label, value=round(float(value), 2), kind=kind)  # type: ignore[arg-type]


def _category_leader(context: DatasetContext) -> Insight | None:
    if context.expenses.empty or context.total_spending <= 0 or context.category_totals.empty:
        return None
    category = str(context.category_totals.index[0])
    total = float(context.category_totals.iloc[0])
    share = percent(safe_divide(total, context.total_spending) * 100)
    count = int(context.category_counts.get(context.category_totals.index[0], 0))
    return Insight(
        id="category-leader",
        title=f"{category} drives the largest share of spending",
        detail=(
            f"{category} accounts for {share:.1f}% of total spending across {count:,} transactions, "
            f"averaging {money(safe_divide(total, count)):,.0f} per transaction."
        ),
        group="category",
        tone="neutral",
        metrics=[
            _metric("Category spending", total, "currency"),
            _metric("Share of total spending", share, "percent"),
            _metric("Transactions", count, "count"),
        ],
    )


def _category_concentration(context: DatasetContext) -> Insight | None:
    if len(context.category_totals) < 4 or context.total_spending <= 0:
        return None
    top = context.category_totals.head(3)
    share = percent(safe_divide(float(top.sum()), context.total_spending) * 100)
    names = ", ".join(str(name) for name in top.index[:3])
    return Insight(
        id="category-concentration",
        title="Spending is concentrated in a few categories",
        detail=(
            f"The three largest categories ({names}) account for {share:.1f}% of total spending, "
            f"while the remaining {max(len(context.category_totals) - 3, 0)} categories share the rest."
        ),
        group="category",
        tone="neutral",
        metrics=[
            _metric("Top 3 share", share, "percent"),
            _metric("Categories in use", int(len(context.category_totals)), "count"),
        ],
    )


def _average_transaction_momentum(context: DatasetContext) -> Insight | None:
    if context.expenses.empty:
        return None
    monthly = context.expenses.groupby("month")["amount"].mean()
    if len(monthly) < 2:
        return None
    latest = float(monthly.iloc[-1])
    previous = float(monthly.iloc[-2])
    change = percent(safe_divide(latest - previous, previous) * 100)
    direction = "rose" if change > 0.05 else "fell" if change < -0.05 else "held steady"
    detail = (
        f"The average expense per transaction {direction} {abs(change):.1f}% in "
        f"{month_label(str(monthly.index[-1]))} compared with {month_label(str(monthly.index[-2]))}."
        if direction != "held steady"
        else (
            f"The average expense per transaction was unchanged between "
            f"{month_label(str(monthly.index[-2]))} and {month_label(str(monthly.index[-1]))}."
        )
    )
    return Insight(
        id="average-transaction-momentum",
        title="Average transaction size month over month",
        detail=detail,
        group="trend",
        tone="negative" if change > 5 else "positive" if change < -5 else "neutral",
        metrics=[
            _metric(f"Average {month_label(str(monthly.index[-1]))}", latest, "currency"),
            _metric(f"Average {month_label(str(monthly.index[-2]))}", previous, "currency"),
            _metric("Change", change, "percent"),
        ],
    )


def _monthly_spending_vs_average(context: DatasetContext) -> Insight | None:
    if context.expenses.empty or len(context.months) < 3:
        return None
    per_month = context.expenses.groupby("month")["amount"].sum()
    latest_month = str(context.months[-1])
    latest = float(per_month.get(latest_month, 0.0))
    average = float(np.mean([float(per_month.get(month, 0.0)) for month in context.months]))
    change = percent(safe_divide(latest - average, average) * 100)
    if abs(change) < 1:
        return None
    direction = "above" if change > 0 else "below"
    return Insight(
        id="latest-month-vs-average",
        title=f"{month_label(latest_month)} spending compared with the monthly average",
        detail=(
            f"Spending in {month_label(latest_month)} was {abs(change):.1f}% {direction} the average of the "
            f"{len(context.months)} months covered by the dataset."
        ),
        group="trend",
        tone="warning" if change > 15 else "neutral",
        metrics=[
            _metric(f"{month_label(latest_month)} spending", latest, "currency"),
            _metric("Average monthly spending", average, "currency"),
            _metric("Difference", change, "percent"),
        ],
    )


def _income_balance(context: DatasetContext) -> Insight | None:
    if context.total_income <= 0:
        return None
    net = context.net_cash_flow
    rate = percent(safe_divide(net, context.total_income) * 100)
    surplus = net >= 0
    detail = (
        f"Income of {context.total_income:,.0f} exceeded spending by {abs(rate):.1f}% over the period covered."
        if surplus
        else f"Spending exceeded income: expenses were {abs(rate):.1f}% higher than the income recorded."
    )
    return Insight(
        id="income-balance",
        title="Net cash flow over the covered period",
        detail=detail,
        group="income",
        tone="positive" if surplus else "negative",
        metrics=[
            _metric("Total income", context.total_income, "currency"),
            _metric("Total spending", context.total_spending, "currency"),
            _metric("Net cash flow", net, "currency"),
            _metric("Savings rate", rate, "percent"),
        ],
    )


def _recurring_baseline(context: DatasetContext) -> Insight | None:
    if context.expenses.empty or len(context.months) < 3:
        return None
    months_covered = len(context.months)
    presence = context.expenses.groupby("category")["month"].nunique()
    threshold = max(2, int(round(months_covered * RECURRING_MONTH_SHARE)))
    recurring = presence[presence >= threshold]
    if recurring.empty:
        return None
    recurring_spend = float(context.expenses[context.expenses["category"].isin(recurring.index)]["amount"].sum())
    share = percent(safe_divide(recurring_spend, context.total_spending) * 100)
    preview = ", ".join(str(name) for name in recurring.index[:4])
    return Insight(
        id="recurring-baseline",
        title="Recurring categories form a fixed baseline",
        detail=(
            f"{len(recurring)} categories appear in at least {threshold} of the {months_covered} months covered "
            f"({preview}) and together represent {share:.1f}% of total spending."
        ),
        group="behaviour",
        tone="neutral",
        metrics=[
            _metric("Recurring categories", int(len(recurring)), "count"),
            _metric("Recurring spending", recurring_spend, "currency"),
            _metric("Share of spending", share, "percent"),
        ],
    )


def _weekend_pattern(context: DatasetContext) -> Insight | None:
    frame = context.frame
    if frame.empty or len(frame) < 20:
        return None
    weekend_mask = frame["weekday"].isin(["Sat", "Sun"])
    weekend, weekday = frame[weekend_mask], frame[~weekend_mask]
    if weekend.empty or weekday.empty:
        return None
    weekend_days = max(int(weekend["date"].nunique()), 1)
    weekday_days = max(int(weekday["date"].nunique()), 1)
    weekend_daily = safe_divide(float(weekend["amount"].sum()), float(weekend_days))
    weekday_daily = safe_divide(float(weekday["amount"].sum()), float(weekday_days))
    multiple = ratio(safe_divide(weekend_daily, weekday_daily), 2)
    if multiple == 0:
        return None
    more_expensive = multiple >= 1
    return Insight(
        id="weekend-pattern",
        title="Weekends versus weekdays",
        detail=(
            f"Average daily transaction value on weekends is {multiple:.2f}× the weekday figure, and "
            f"{context.weekend_share:.1f}% of all transactions happen on a Saturday or Sunday."
        ),
        group="behaviour",
        tone="neutral",
        metrics=[
            _metric("Weekend daily value", weekend_daily, "currency"),
            _metric("Weekday daily value", weekday_daily, "currency"),
            _metric("Ratio", multiple, "ratio"),
        ],
    )


def _largest_expense(context: DatasetContext) -> Insight | None:
    if context.expenses.empty or context.total_spending <= 0:
        return None
    row = context.expenses.loc[context.expenses["amount"].idxmax()]
    amount = float(row["amount"])
    average_month = safe_divide(context.total_spending, context.month_count)
    multiple = ratio(safe_divide(amount, average_month), 2)
    return Insight(
        id="largest-expense",
        title="Largest single expense",
        detail=(
            f"The largest expense was {row['description']} ({row['category']}) on "
            f"{row['date'].date().isoformat()}, equal to {multiple:.2f}× the average monthly spending."
        ),
        group="spending",
        tone="neutral",
        metrics=[
            _metric("Amount", money(amount), "currency"),
            _metric("Average monthly spending", money(average_month), "currency"),
            _metric("Multiple of monthly spend", multiple, "ratio"),
        ],
    )


def _outliers(context: DatasetContext) -> Insight | None:
    if context.expense_count < MIN_TRANSACTIONS_FOR_OUTLIERS:
        return None
    amounts = context.expenses["amount"]
    mean = float(amounts.mean())
    std = float(amounts.std(ddof=1))
    if not np.isfinite(std) or std <= 0:
        return None
    threshold = mean + 3 * std
    outliers = context.expenses[context.expenses["amount"] > threshold]
    if outliers.empty:
        return None
    share = percent(safe_divide(float(outliers["amount"].sum()), context.total_spending) * 100)
    return Insight(
        id="spend-outliers",
        title="A few transactions carry a large share of spending",
        detail=(
            f"{len(outliers)} transactions are more than three standard deviations above the mean expense "
            f"(above {threshold:,.0f}) and together account for {share:.1f}% of total spending."
        ),
        group="spending",
        tone="warning",
        metrics=[
            _metric("Outlier transactions", int(len(outliers)), "count"),
            _metric("Outlier threshold", money(threshold), "currency"),
            _metric("Share of spending", share, "percent"),
        ],
    )


def _trend_direction(context: DatasetContext) -> Insight | None:
    if context.expenses.empty or len(context.months) < 4:
        return None
    per_month = context.expenses.groupby("month")["amount"].sum()
    values = [float(per_month.get(month, 0.0)) for month in context.months]
    half = len(values) // 2
    first_half = float(np.mean(values[:half]))
    second_half = float(np.mean(values[half:]))
    change = percent(safe_divide(second_half - first_half, first_half) * 100)
    if abs(change) < 1:
        return None
    verb = "rose" if change > 0 else "fell"
    return Insight(
        id="trend-direction",
        title="Average monthly spending trajectory",
        detail=(
            f"Average monthly spending {verb} {abs(change):.1f}% between the first half and the second half "
            f"of the transaction history."
        ),
        group="trend",
        tone="negative" if change > 0 else "positive",
        metrics=[
            _metric("First half average", money(first_half), "currency"),
            _metric("Second half average", money(second_half), "currency"),
            _metric("Change", change, "percent"),
        ],
    )


def _category_momentum(context: DatasetContext) -> Insight | None:
    if context.expenses.empty or len(context.months) < 6:
        return None
    window = 3
    months = context.months
    recent_months, previous_months = months[-window:], months[-2 * window : -window]
    if not previous_months:
        return None
    grouped = context.expenses.groupby(["category", "month"])["amount"].sum()
    best: tuple[float, str, float, float] | None = None
    for category in context.category_totals.index:
        recent = float(sum(float(grouped.get((category, month), 0.0)) for month in recent_months))
        previous = float(sum(float(grouped.get((category, month), 0.0)) for month in previous_months))
        if previous <= 0:
            continue
        change = safe_divide(recent - previous, previous) * 100
        share = safe_divide(float(context.category_totals.get(category, 0.0)), context.total_spending) * 100
        if share < 3:
            continue
        if best is None or abs(change) > abs(best[0]):
            best = (change, str(category), recent, previous)
    if best is None:
        return None
    change, category, recent, previous = best
    verb = "grew" if change > 0 else "slowed"
    return Insight(
        id="category-momentum",
        title=f"{category} is the fastest moving category",
        detail=(
            f"{category} {verb} {abs(change):.1f}% across the last {window} months compared with the "
            f"{window} months before them."
        ),
        group="category",
        tone="warning" if change > 0 else "positive",
        metrics=[
            _metric("Recent window", money(recent), "currency"),
            _metric("Previous window", money(previous), "currency"),
            _metric("Change", percent(change), "percent"),
        ],
    )


def _cluster_spend_imbalance(clusters: list[ClusterStat] | None) -> Insight | None:
    if not clusters or len(clusters) < 2:
        return None
    candidate = max(clusters, key=lambda stat: stat.spend_share - stat.percentage)
    gap = candidate.spend_share - candidate.percentage
    if gap < 5:
        return None
    return Insight(
        id="cluster-spend-imbalance",
        title=f"Cluster “{candidate.label}” punches above its weight",
        detail=(
            f"Cluster “{candidate.label}” contains {candidate.percentage:.1f}% of transactions but represents "
            f"{candidate.spend_share:.1f}% of total spending."
        ),
        group="cluster",
        tone="warning" if gap > 15 else "neutral",
        metrics=[
            _metric("Share of transactions", candidate.percentage, "percent"),
            _metric("Share of spending", candidate.spend_share, "percent"),
            _metric("Average transaction", candidate.avg_transaction, "currency"),
        ],
    )


def _cluster_highest_average(clusters: list[ClusterStat] | None, context: DatasetContext) -> Insight | None:
    if not clusters:
        return None
    candidates = [stat for stat in clusters if stat.size >= 3]
    if len(candidates) < 2:
        return None
    top = max(candidates, key=lambda stat: stat.avg_transaction)
    multiple = ratio(safe_divide(top.avg_transaction, context.average_transaction), 2)
    return Insight(
        id="cluster-highest-average",
        title=f"Cluster “{top.label}” carries the highest average value",
        detail=(
            f"Cluster “{top.label}” shows the largest average transaction of any cluster — {multiple:.2f}× the "
            f"dataset-wide average — while holding {top.percentage:.1f}% of all transactions."
        ),
        group="cluster",
        tone="neutral",
        metrics=[
            _metric("Average transaction", top.avg_transaction, "currency"),
            _metric("Dataset average", context.average_transaction, "currency"),
            _metric("Multiple", multiple, "ratio"),
        ],
    )


def _cluster_routine(clusters: list[ClusterStat] | None) -> Insight | None:
    if not clusters or len(clusters) < 2:
        return None
    fastest = max(clusters, key=lambda stat: stat.transactions_per_month)
    return Insight(
        id="cluster-routine",
        title=f"Cluster “{fastest.label}” is the most routine pattern",
        detail=(
            f"Cluster “{fastest.label}” runs at {fastest.transactions_per_month:.1f} transactions per active month "
            f"across {fastest.active_months} months, the highest cadence in the dataset."
        ),
        group="cluster",
        tone="neutral",
        metrics=[
            _metric("Transactions per month", fastest.transactions_per_month, "ratio"),
            _metric("Active months", fastest.active_months, "count"),
            _metric("Transactions", fastest.size, "count"),
        ],
    )


def build_insights(
    *,
    dataset_id: str,
    context: DatasetContext,
    clusters: list[ClusterStat] | None = None,
    k: int | None = None,
) -> InsightsResponse:
    """Generate every insight that the data actually supports."""

    candidates = [
        _category_leader(context),
        _income_balance(context),
        _trend_direction(context),
        _average_transaction_momentum(context),
        _cluster_spend_imbalance(clusters),
        _cluster_highest_average(clusters, context),
        _cluster_routine(clusters),
        _category_concentration(context),
        _recurring_baseline(context),
        _latest_month_insight(context),
        _category_momentum(context),
        _weekend_pattern(context),
        _largest_expense(context),
        _outliers(context),
    ]
    insights = [insight for insight in candidates if insight is not None][:MAX_INSIGHTS]
    return InsightsResponse(
        dataset_id=dataset_id,
        generated_at=datetime.now(timezone.utc),
        cluster_based=bool(clusters),
        cluster_k=k,
        insights=insights,
    )


def _latest_month_insight(context: DatasetContext) -> Insight | None:
    return _monthly_spending_vs_average(context)


__all__ = ["build_insights"]
