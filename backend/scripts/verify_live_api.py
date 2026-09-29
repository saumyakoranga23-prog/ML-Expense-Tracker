"""Smoke-check every endpoint against a running server.

Usage::

    uvicorn app.main:app --port 8000
    python scripts/verify_live_api.py

Exits non-zero if any check fails, so it can be used in CI after the service is
started.
"""

from __future__ import annotations

import os
import pathlib
import sys

import httpx

BASE_URL = os.environ.get("LEDGERLENS_URL", "http://127.0.0.1:8000")
SAMPLE_PATH = pathlib.Path(__file__).resolve().parents[2] / "data" / "sample_transactions.csv"

failures: list[str] = []


def check(label: str, condition: bool, detail: str = "") -> None:
    status = "ok  " if condition else "FAIL"
    print(f"[{status}] {label}{f' — {detail}' if detail else ''}")
    if not condition:
        failures.append(label)


def main() -> int:
    client = httpx.Client(base_url=BASE_URL, timeout=120.0)

    health = client.get("/api/health").json()
    check("health endpoint", health.get("status") == "ok", f"limits {health.get('limits')}")

    demo = client.post("/api/demo")
    check("demo dataset ingestion", demo.status_code == 201, f"HTTP {demo.status_code}")
    payload = demo.json()
    dataset_id = payload["dataset_id"]
    cleaning = payload["cleaning"]
    check("demo row count", payload["row_count"] > 100, f"{payload['row_count']} usable rows")
    check(
        "cleaning pipeline reported changes",
        cleaning["duplicate_rows_removed"] > 0 and cleaning["invalid_date_rows"] > 0,
        f"{cleaning['duplicate_rows_removed']} duplicates, {cleaning['invalid_date_rows']} invalid dates",
    )

    summary = client.get("/api/summary", params={"dataset_id": dataset_id}).json()
    kpis = summary["kpis"]
    expense_total = sum(month["expense"] for month in summary["monthly"])
    category_total = sum(category["total_spending"] for category in summary["categories"])
    check(
        "monthly series reconciles with total spending",
        abs(expense_total - kpis["total_spending"]) < 1.0,
        f"{expense_total:,.2f} vs {kpis['total_spending']:,.2f}",
    )
    check(
        "category breakdown reconciles with total spending",
        abs(category_total - kpis["total_spending"]) < 1.0,
    )
    check(
        "net cash flow is income minus spending",
        abs(kpis["net_cash_flow"] - (kpis["total_income"] - kpis["total_spending"])) < 1.0,
    )
    check(
        "volume matches transaction count",
        sum(entry["transactions"] for entry in summary["volume"]) == kpis["transaction_count"],
    )

    clusters = client.post("/api/clusters", json={"dataset_id": dataset_id, "k": 4}).json()
    check("cluster count equals K", len(clusters["clusters"]) == 4)
    check(
        "cluster sizes cover every row",
        sum(stat["size"] for stat in clusters["clusters"]) == clusters["total_points"],
    )
    check(
        "silhouette score in range",
        -1.0 <= clusters["metrics"]["silhouette"] <= 1.0,
        f"{clusters['metrics']['silhouette']}",
    )
    check(
        "PCA projection present",
        len(clusters["metrics"]["explained_variance"]) == 2 and bool(clusters["points"]),
        f"variance {clusters['metrics']['explained_variance']}",
    )
    check("sweep covers K=2..8", [entry["k"] for entry in clusters["sweep"]] == list(range(2, 9)))
    check("optimal K is inside the sweep", clusters["optimal_k"] in range(2, 9), f"K={clusters['optimal_k']}")

    print("\n  cluster labels derived from the fitted centroids:")
    for stat in clusters["clusters"]:
        print(
            f"    C{stat['cluster']} {stat['label']:<38} rows={stat['size']:>4} "
            f"avg={stat['avg_transaction']:>10,.2f} share={stat['spend_share']:>5.1f}% "
            f"freq={stat['frequency']:<6} dominant={stat['dominant_category']}"
        )

    transactions = client.get(
        "/api/transactions", params={"dataset_id": dataset_id, "search": "swiggy", "page_size": 5}
    ).json()
    check("transaction search returns matches", transactions["total"] > 0, f"{transactions['total']} hits")
    check(
        "cluster assignment exposed in the explorer",
        all(item["cluster"] is not None for item in transactions["items"]),
    )

    filtered = client.get(
        "/api/transactions", params={"dataset_id": dataset_id, "flow": "income", "page_size": 50}
    ).json()
    check("income filter returns only income", all(item["flow"] == "income" for item in filtered["items"]))
    check("income filter reports no spending", filtered["totals"]["spending"] == 0)

    insights = client.get("/api/insights", params={"dataset_id": dataset_id}).json()
    check("insights generated", len(insights["insights"]) >= 5, f"{len(insights['insights'])} findings")
    check("cluster insights included", insights["cluster_based"] is True)
    print("\n  sample insights:")
    for insight in insights["insights"][:4]:
        print(f"    · {insight['detail'][:118]}")

    model = client.get("/api/model", params={"dataset_id": dataset_id, "k": 4}).json()
    check("model describes the algorithm", "K-Means" in model["algorithm"])
    check("model documents StandardScaler", "StandardScaler" in model["preprocessing"])
    check("model exposes six features", len(model["features"]) == 6)
    check("model metrics present", model["metrics"] is not None and model["metrics"]["k"] == 4)

    analyze = client.post("/api/analyze", json={"dataset_id": dataset_id}).json()
    check("analyze returns summary, clusters, insights and model", all(analyze[key] for key in ("summary", "clusters", "insights", "model")))

    if SAMPLE_PATH.exists():
        with SAMPLE_PATH.open("rb") as handle:
            upload = client.post(
                "/api/upload",
                files={"file": (SAMPLE_PATH.name, handle, "text/csv")},
            )
        check("multipart CSV upload", upload.status_code == 201, f"HTTP {upload.status_code}")
        check("uploaded dataset is usable", upload.json()["row_count"] > 100)
    else:
        check("sample CSV present", False, f"missing {SAMPLE_PATH}")

    check("invalid K is rejected", client.post("/api/clusters", json={"dataset_id": dataset_id, "k": 99}).status_code == 422)
    check("unknown dataset returns 404", client.get("/api/summary", params={"dataset_id": "nope12345"}).status_code == 404)
    check(
        "binary upload is rejected",
        client.post("/api/upload", files={"file": ("payload.exe", b"\x00\x01\x02", "application/octet-stream")}).status_code
        == 415,
    )
    check("sample CSV downloadable", client.get("/api/sample-csv").status_code == 200)

    client.close()
    print()
    if failures:
        print(f"{len(failures)} check(s) failed: {', '.join(failures)}")
        return 1
    print("All live API checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
