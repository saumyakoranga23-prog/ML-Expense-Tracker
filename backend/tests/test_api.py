"""End-to-end tests for the HTTP API."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from tests.conftest import csv_bytes, synthetic_rows


def _upload(client: TestClient, rows: list[tuple[object, ...]], filename: str = "transactions.csv"):
    return client.post(
        "/api/upload",
        files={"file": (filename, csv_bytes(rows), "text/csv")},
    )


@pytest.fixture
def demo(client: TestClient):
    response = client.post("/api/demo")
    assert response.status_code == 201, response.text
    return client, response.json()


def test_health_reports_configuration(client: TestClient) -> None:
    body = client.get("/api/health").json()
    assert body["status"] == "ok"
    assert body["limits"]["k_range"] == [2, 8]
    assert body["limits"]["min_rows_for_clustering"] >= 2


def test_demo_dataset_flows_through_the_whole_pipeline(demo) -> None:
    client, body = demo
    dataset_id = body["dataset_id"]
    cleaning = body["cleaning"]

    assert body["source"] == "demo"
    assert body["clustering_available"] is True
    assert cleaning["rows_clean"] == body["row_count"] > 100
    # The packaged sample deliberately contains dirty rows to exercise cleaning.
    assert cleaning["duplicate_rows_removed"] >= 1
    assert cleaning["invalid_date_rows"] >= 1
    assert cleaning["invalid_amount_rows"] >= 1
    assert {column["field"] for column in cleaning["detected_columns"]} >= {"date", "amount", "description"}

    summary = client.get("/api/summary", params={"dataset_id": dataset_id}).json()
    kpis = summary["kpis"]

    assert kpis["total_spending"] > 0
    assert kpis["total_income"] > 0
    assert kpis["net_cash_flow"] == pytest.approx(kpis["total_income"] - kpis["total_spending"], abs=0.05)
    assert kpis["transaction_count"] == cleaning["rows_clean"]
    assert kpis["expense_count"] + kpis["income_count"] == kpis["transaction_count"]

    # Every dashboard series must reconcile with the KPI cards.
    assert sum(month["expense"] for month in summary["monthly"]) == pytest.approx(kpis["total_spending"], abs=1)
    assert sum(month["income"] for month in summary["monthly"]) == pytest.approx(kpis["total_income"], abs=1)
    assert len(summary["monthly"]) == kpis["months_covered"]
    assert sum(entry["transactions"] for entry in summary["volume"]) == kpis["transaction_count"]
    assert sum(category["total_spending"] for category in summary["categories"]) == pytest.approx(
        kpis["total_spending"], abs=1
    )
    assert all(category["share"] <= 100 for category in summary["categories"])
    assert summary["top_merchants"]


def test_upload_synthetic_dataset_drives_clustering(client: TestClient) -> None:
    upload = _upload(client, synthetic_rows(count=120))
    assert upload.status_code == 201
    dataset_id = upload.json()["dataset_id"]

    response = client.post("/api/clusters", json={"dataset_id": dataset_id, "k": 4})
    assert response.status_code == 200
    payload = response.json()

    assert payload["k"] == 4
    assert len(payload["clusters"]) == 4
    assert payload["total_points"] == upload.json()["row_count"]
    assert len(payload["points"]) == payload["total_points"]
    assert payload["points_sampled"] is False
    assert len(payload["centroids"]) == 4
    assert [entry["k"] for entry in payload["sweep"]] == [2, 3, 4, 5, 6, 7, 8]
    assert -1 <= payload["metrics"]["silhouette"] <= 1
    assert payload["metrics"]["inertia"] > 0
    assert payload["optimal_k"] in range(2, 9)

    # A cached re-run must return the same partition.
    again = client.post("/api/clusters", json={"dataset_id": dataset_id, "k": 4}).json()
    assert again["cached"] is True
    assert again["metrics"]["silhouette"] == payload["metrics"]["silhouette"]


def test_clusters_reject_invalid_k_and_unknown_datasets(client: TestClient) -> None:
    upload = _upload(client, synthetic_rows(count=60))
    dataset_id = upload.json()["dataset_id"]

    too_large = client.post("/api/clusters", json={"dataset_id": dataset_id, "k": 12})
    assert too_large.status_code == 422
    assert too_large.json()["error"]["code"] == "invalid_request"

    unknown = client.post("/api/clusters", json={"dataset_id": "doesnotexist", "k": 3})
    assert unknown.status_code == 404
    assert unknown.json()["error"]["code"] == "dataset_not_found"


def test_clustering_unavailable_for_tiny_datasets(client: TestClient) -> None:
    upload = _upload(client, synthetic_rows(count=5))
    assert upload.status_code == 201
    body = upload.json()
    assert body["clustering_available"] is False

    response = client.post("/api/clusters", json={"dataset_id": body["dataset_id"], "k": 3})
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "analysis_unavailable"

    model = client.get("/api/model", params={"dataset_id": body["dataset_id"]}).json()
    assert model["clustering_available"] is False
    assert model["unavailable_reason"]
    assert model["metrics"] is None


def test_transaction_explorer_filters_sorts_and_paginates(client: TestClient) -> None:
    upload = _upload(client, synthetic_rows(count=150))
    dataset_id = upload.json()["dataset_id"]

    first_page = client.get(
        "/api/transactions", params={"dataset_id": dataset_id, "page": 1, "page_size": 10, "sort_by": "amount", "sort_dir": "desc"}
    ).json()
    assert len(first_page["items"]) == 10
    assert first_page["pages"] > 1
    amounts = [item["amount"] for item in first_page["items"]]
    assert amounts == sorted(amounts, reverse=True)

    second_page = client.get(
        "/api/transactions", params={"dataset_id": dataset_id, "page": 2, "page_size": 10, "sort_by": "amount", "sort_dir": "desc"}
    ).json()
    assert second_page["items"][0]["id"] != first_page["items"][0]["id"]

    search = client.get("/api/transactions", params={"dataset_id": dataset_id, "search": "swiggy"}).json()
    assert search["total"] > 0
    assert all("swiggy" in item["description"].lower() for item in search["items"])

    income_only = client.get(
        "/api/transactions", params={"dataset_id": dataset_id, "flow": "income", "page_size": 50}
    ).json()
    assert income_only["total"] > 0
    assert all(item["flow"] == "income" for item in income_only["items"])
    assert income_only["totals"]["spending"] == 0

    category = search["facets"]["categories"][0]
    filtered = client.get("/api/transactions", params={"dataset_id": dataset_id, "category": category}).json()
    assert filtered["total"] > 0
    assert all(item["category"] == category for item in filtered["items"])

    ranged = client.get(
        "/api/transactions",
        params={"dataset_id": dataset_id, "start": "2024-03-01", "end": "2024-03-31", "page_size": 200},
    ).json()
    assert all(item["date"].startswith("2024-03") for item in ranged["items"])

    big_only = client.get(
        "/api/transactions",
        params={"dataset_id": dataset_id, "min_amount": 10_000, "sort_by": "amount"},
    ).json()
    assert all(item["amount"] >= 10_000 for item in big_only["items"])

    # Spending totals for a filtered selection never exceed the whole dataset.
    everything = client.get("/api/transactions", params={"dataset_id": dataset_id, "page_size": 5}).json()
    assert everything["totals"]["spending"] >= income_only["totals"]["spending"]


def test_cluster_assignment_is_exposed_in_the_explorer(client: TestClient) -> None:
    upload = _upload(client, synthetic_rows(count=140))
    dataset_id = upload.json()["dataset_id"]
    clusters = client.post("/api/clusters", json={"dataset_id": dataset_id, "k": 3}).json()

    page = client.get("/api/transactions", params={"dataset_id": dataset_id, "page_size": 50}).json()
    assert page["clustering_available"] is True
    assert all(item["cluster"] is not None for item in page["items"])
    assert all(item["cluster_label"] for item in page["items"])
    assert {cluster["id"] for cluster in page["facets"]["clusters"]} == {stat["cluster"] for stat in clusters["clusters"]}

    filtered = client.get("/api/transactions", params={"dataset_id": dataset_id, "cluster": 0, "page_size": 200}).json()
    assert filtered["total"] > 0
    assert all(item["cluster"] == 0 for item in filtered["items"])


def test_insights_model_and_sweep_endpoints(client: TestClient) -> None:
    upload = _upload(client, synthetic_rows(count=150))
    dataset_id = upload.json()["dataset_id"]
    client.post("/api/clusters", json={"dataset_id": dataset_id, "k": 4})

    insights = client.get("/api/insights", params={"dataset_id": dataset_id}).json()
    assert insights["cluster_based"] is True
    assert insights["insights"]
    for insight in insights["insights"]:
        assert insight["detail"]
        assert insight["metrics"]
        assert all(metric["label"] for metric in insight["metrics"])
    assert any(insight["group"] == "cluster" for insight in insights["insights"])

    sweep = client.get("/api/clusters/sweep", params={"dataset_id": dataset_id}).json()
    assert [entry["k"] for entry in sweep["entries"]] == [2, 3, 4, 5, 6, 7, 8]
    assert sweep["optimal_k"] in range(2, 9)

    model = client.get("/api/model", params={"dataset_id": dataset_id, "k": 3}).json()
    assert model["algorithm"].startswith("K-Means")
    assert "StandardScaler" in model["preprocessing"]
    assert model["selected_k"] == 3
    assert model["optimal_k"] in range(2, 9)
    assert len(model["features"]) == 6
    assert model["metrics"]["k"] == 3
    assert model["hyperparameters"]["random_state"] == "42"
    explanations = {explanation["name"]: explanation for explanation in model["explanations"]}
    assert "Silhouette score" in explanations
    assert "diagnostic" in (explanations["Silhouette score"]["caution"] or "")


def test_analyze_endpoint_returns_everything_at_once(client: TestClient) -> None:
    upload = _upload(client, synthetic_rows(count=120))
    dataset_id = upload.json()["dataset_id"]

    response = client.post("/api/analyze", json={"dataset_id": dataset_id})
    assert response.status_code == 200
    payload = response.json()

    assert payload["summary"]["kpis"]["transaction_count"] == upload.json()["row_count"]
    assert payload["clusters"] is not None
    assert payload["clusters"]["k"] == payload["model"]["selected_k"]
    assert payload["insights"]["cluster_k"] == payload["clusters"]["k"]

    with_k = client.post("/api/analyze", json={"dataset_id": dataset_id, "k": 6}).json()
    assert with_k["clusters"]["k"] == 6


def test_upload_validation_errors_are_actionable(client: TestClient) -> None:
    unsupported = client.post(
        "/api/upload",
        files={"file": ("transactions.exe", b"binary", "application/octet-stream")},
    )
    assert unsupported.status_code == 415
    assert unsupported.json()["error"]["code"] == "unsupported_file_type"

    empty = client.post("/api/upload", files={"file": ("empty.csv", b"", "text/csv")})
    assert empty.status_code == 422
    assert empty.json()["error"]["code"] == "invalid_dataset"

    missing_columns = client.post(
        "/api/upload",
        files={"file": ("weird.csv", b"alpha,beta\n1,2\n3,4\n", "text/csv")},
    )
    assert missing_columns.status_code == 422
    assert "missing required" in missing_columns.json()["error"]["message"].lower()
    assert missing_columns.json()["error"]["context"]["available_columns"] == ["alpha", "beta"]

    one_row = client.post(
        "/api/upload",
        files={"file": ("tiny.csv", csv_bytes([("2024-01-01", "Coffee", "Food", "120.00", "Debit")]), "text/csv")},
    )
    assert one_row.status_code == 422
    assert "not enough" in one_row.json()["error"]["message"].lower()


def test_sample_csv_download_and_dataset_lifecycle(client: TestClient) -> None:
    download = client.get("/api/sample-csv")
    assert download.status_code == 200
    assert "text/csv" in download.headers["content-type"]
    assert "attachment" in download.headers["content-disposition"]
    assert download.text.startswith("date,description")

    upload = _upload(client, synthetic_rows(count=40))
    dataset_id = upload.json()["dataset_id"]

    listing = client.get("/api/datasets").json()
    assert any(entry["dataset_id"] == dataset_id for entry in listing)

    assert client.delete(f"/api/datasets/{dataset_id}").status_code == 204
    assert client.get("/api/summary", params={"dataset_id": dataset_id}).status_code == 404
