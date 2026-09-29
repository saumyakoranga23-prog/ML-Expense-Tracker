"""HTTP layer: one router module per resource."""

from app.api import analytics, clusters, datasets, insights, model, transactions

ROUTERS = (
    datasets.router,
    analytics.router,
    clusters.router,
    transactions.router,
    insights.router,
    model.router,
)

__all__ = ["ROUTERS", "analytics", "clusters", "datasets", "insights", "model", "transactions"]
