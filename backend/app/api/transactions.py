"""Transaction explorer route."""

from __future__ import annotations

from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Query, Request

from app.api.deps import DatasetId, resolve_dataset
from app.schemas.transactions import TransactionPage
from app.services.transactions import MAX_PAGE_SIZE, SORTABLE_FIELDS, TransactionQuery, query_transactions

router = APIRouter(tags=["transactions"])


@router.get(
    "/transactions",
    response_model=TransactionPage,
    summary="Search, filter, sort and paginate the transaction table",
)
def list_transactions(
    dataset_id: DatasetId,
    request: Request,
    search: Annotated[str | None, Query(max_length=120, description="Case-insensitive text match")] = None,
    category: Annotated[list[str] | None, Query(description="Repeatable category filter")] = None,
    flow: Annotated[list[Literal["income", "expense"]] | None, Query(description="Repeatable direction filter")] = None,
    cluster: Annotated[list[int] | None, Query(description="Repeatable cluster id filter")] = None,
    start: Annotated[date | None, Query(description="Inclusive start date")] = None,
    end: Annotated[date | None, Query(description="Inclusive end date")] = None,
    min_amount: Annotated[float | None, Query(ge=0)] = None,
    max_amount: Annotated[float | None, Query(ge=0)] = None,
    sort_by: Annotated[str, Query(description=f"One of: {', '.join(SORTABLE_FIELDS)}")] = "date",
    sort_dir: Annotated[Literal["asc", "desc"], Query()] = "desc",
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=5, le=MAX_PAGE_SIZE)] = 25,
) -> TransactionPage:
    record = resolve_dataset(dataset_id, request)
    query = TransactionQuery(
        search=search,
        categories=[value for value in (category or []) if value],
        flows=list(flow or []),
        clusters=list(cluster or []),
        start=start,
        end=end,
        min_amount=min_amount,
        max_amount=max_amount,
        sort_by=sort_by if sort_by in SORTABLE_FIELDS else "date",
        sort_dir=sort_dir,
        page=page,
        page_size=page_size,
    )
    return query_transactions(record, query)


__all__ = ["router"]
