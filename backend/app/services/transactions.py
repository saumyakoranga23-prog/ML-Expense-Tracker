"""Transaction explorer queries: filtering, sorting and pagination."""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import date

import pandas as pd

from app.schemas.transactions import (
    FacetCluster,
    Facets,
    Transaction,
    TransactionPage,
    TransactionTotals,
)
from app.services.analytics import money, safe_divide
from app.services.store import DatasetRecord

SORTABLE_FIELDS = {
    "date": "date",
    "amount": "amount",
    "description": "description",
    "category": "category",
    "cluster": "cluster",
}
MAX_PAGE_SIZE = 200


@dataclass
class TransactionQuery:
    search: str | None = None
    categories: list[str] = field(default_factory=list)
    flows: list[str] = field(default_factory=list)
    clusters: list[int] = field(default_factory=list)
    start: date | None = None
    end: date | None = None
    min_amount: float | None = None
    max_amount: float | None = None
    sort_by: str = "date"
    sort_dir: str = "desc"
    page: int = 1
    page_size: int = 25


def _facets(record: DatasetRecord, assignments: dict[int, tuple[int, str]]) -> Facets:
    frame = record.context.frame
    categories = sorted(frame["category"].unique().tolist())
    amounts = frame["amount"]
    clusters: list[FacetCluster] = []
    if assignments:
        sizes: dict[int, int] = {}
        labels: dict[int, str] = {}
        for cluster_id, label in assignments.values():
            sizes[cluster_id] = sizes.get(cluster_id, 0) + 1
            labels[cluster_id] = label
        clusters = [
            FacetCluster(id=cluster_id, label=labels[cluster_id], size=size)
            for cluster_id, size in sorted(sizes.items())
        ]
    return Facets(
        categories=[str(category) for category in categories],
        flows=["expense", "income"],
        clusters=clusters,
        months=[str(month) for month in record.context.months],
        min_amount=money(float(amounts.min())) if not frame.empty else 0.0,
        max_amount=money(float(amounts.max())) if not frame.empty else 0.0,
    )


def query_transactions(record: DatasetRecord, query: TransactionQuery) -> TransactionPage:
    frame = record.context.frame.copy()
    assignments = record.assigned_clusters()

    if assignments:
        frame["cluster"] = frame["transaction_id"].map(
            {transaction_id: cluster for transaction_id, (cluster, _) in assignments.items()}
        )
        frame["cluster_label"] = frame["transaction_id"].map(
            {transaction_id: label for transaction_id, (_, label) in assignments.items()}
        )
    else:
        frame["cluster"] = pd.NA
        frame["cluster_label"] = pd.NA

    mask = pd.Series(True, index=frame.index)

    if query.search:
        needle = query.search.strip().lower()
        if needle:
            mask &= frame["description"].str.lower().str.contains(needle, regex=False, na=False) | frame[
                "category"
            ].str.lower().str.contains(needle, regex=False, na=False)
    if query.categories:
        mask &= frame["category"].isin(query.categories)
    if query.flows:
        mask &= frame["flow"].isin(query.flows)
    if query.clusters:
        mask &= frame["cluster"].isin(query.clusters)
    if query.start is not None:
        mask &= frame["date"] >= pd.Timestamp(query.start)
    if query.end is not None:
        mask &= frame["date"] <= pd.Timestamp(query.end)
    if query.min_amount is not None:
        mask &= frame["amount"] >= query.min_amount
    if query.max_amount is not None:
        mask &= frame["amount"] <= query.max_amount

    filtered = frame.loc[mask]

    expenses = filtered.loc[filtered["flow"] == "expense", "amount"]
    incomes = filtered.loc[filtered["flow"] == "income", "amount"]
    totals = TransactionTotals(
        transactions=int(len(filtered)),
        spending=money(float(expenses.sum())) if not expenses.empty else 0.0,
        income=money(float(incomes.sum())) if not incomes.empty else 0.0,
        net=money((float(incomes.sum()) if not incomes.empty else 0.0) - (float(expenses.sum()) if not expenses.empty else 0.0)),
        average=money(float(filtered["amount"].mean())) if not filtered.empty else 0.0,
        largest=money(float(filtered["amount"].max())) if not filtered.empty else 0.0,
    )

    sort_column = SORTABLE_FIELDS.get(query.sort_by, "date")
    ascending = query.sort_dir.lower() != "desc"
    sorted_frame = filtered.sort_values(
        by=[sort_column, "transaction_id"],
        ascending=[ascending, True],
        kind="stable",
    )

    total = int(len(sorted_frame))
    page_size = max(1, min(int(query.page_size), MAX_PAGE_SIZE))
    pages = max(1, math.ceil(total / page_size)) if total else 1
    page = min(max(int(query.page), 1), pages)
    start_index = (page - 1) * page_size
    window = sorted_frame.iloc[start_index : start_index + page_size]

    items = [
        Transaction(
            id=int(row.transaction_id),
            date=row.date.date(),
            description=str(row.description),
            category=str(row.category),
            amount=money(row.amount),
            signed_amount=money(row.signed_amount),
            flow=str(row.flow),  # type: ignore[arg-type]
            cluster=int(row.cluster) if pd.notna(row.cluster) else None,
            cluster_label=str(row.cluster_label) if pd.notna(row.cluster_label) else None,
            month=str(row.month),
            month_label=str(row.month_label),
            weekday=str(row.weekday),
        )
        for row in window.itertuples()
    ]

    return TransactionPage(
        dataset_id=record.dataset_id,
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
        totals=totals,
        facets=_facets(record, assignments),
        clustering_available=bool(assignments),
    )


def filtered_share(record: DatasetRecord, query: TransactionQuery) -> float:
    """Share of the dataset matched by a query (used by tests and diagnostics)."""

    page = query_transactions(
        record,
        TransactionQuery(**{**query.__dict__, "page": 1, "page_size": 1}),
    )
    return safe_divide(page.total, record.row_count) * 100


__all__ = ["MAX_PAGE_SIZE", "SORTABLE_FIELDS", "TransactionQuery", "filtered_share", "query_transactions"]
