"""FastAPI application factory.

The app is deliberately small: configuration comes from the environment, routers
are registered under a configurable prefix, and every expected failure is mapped
onto a structured JSON error so the frontend can always show something useful.
"""

from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import ROUTERS
from app.config import Settings, get_settings
from app.services.store import DatasetStore
from app.utils.errors import LedgerLensError

logger = logging.getLogger("ledgerlens")

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Cross-Origin-Resource-Policy": "same-site",
}


def configure_logging(settings: Settings) -> None:
    logging.basicConfig(
        level=logging.DEBUG if settings.debug else logging.INFO,
        format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
    )


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings: Settings = app.state.settings
    configure_logging(settings)
    logger.info(
        "%s %s started (max upload %.1f MB, max rows %d, K range %d-%d)",
        settings.app_name,
        settings.app_version,
        settings.max_upload_bytes / (1024 * 1024),
        settings.max_rows,
        settings.min_k,
        settings.max_k,
    )
    if not settings.sample_csv_path.exists():
        logger.warning("Sample dataset not found at %s", settings.sample_csv_path)
    yield
    app.state.store.clear()
    logger.info("Shutdown complete; in-memory datasets released")


def create_app(settings: Settings | None = None) -> FastAPI:
    """Build the application. Tests call this with an isolated Settings object."""

    active_settings = settings or get_settings()

    app = FastAPI(
        title=active_settings.app_name,
        version=active_settings.app_version,
        description=(
            "REST API for the LedgerLens personal finance dashboard: CSV ingestion, an auditable "
            "cleaning pipeline, financial analytics, K-Means spending clusters, PCA projection, "
            "silhouette scoring and deterministic insights."
        ),
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )

    app.state.settings = active_settings
    app.state.store = DatasetStore(active_settings)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=active_settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Accept", "Authorization"],
        expose_headers=["X-Process-Time"],
        max_age=600,
    )

    @app.middleware("http")
    async def add_security_headers(request: Request, call_next):  # type: ignore[no-untyped-def]
        started = time.perf_counter()
        response = await call_next(request)
        response.headers.update(SECURITY_HEADERS)
        response.headers["X-Process-Time"] = (
            f"{(time.perf_counter() - started) * 1000:.1f}ms"
        )
        return response

    @app.exception_handler(LedgerLensError)
    async def handle_domain_error(_: Request, exc: LedgerLensError) -> JSONResponse:
        if exc.status_code >= 500:
            logger.exception("domain error: %s", exc.message)
        else:
            logger.info("rejected request: %s", exc.message)
        return JSONResponse(status_code=exc.status_code, content=exc.to_payload())

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(
        _: Request, exc: RequestValidationError
    ) -> JSONResponse:
        details = []
        for error in exc.errors():
            location = ".".join(
                str(part) for part in error.get("loc", ()) if part != "body"
            )
            details.append(
                f"{location or 'request'}: {error.get('msg', 'invalid value')}"
            )
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "error": {
                    "code": "invalid_request",
                    "message": "The request could not be validated.",
                    "details": details,
                }
            },
        )

    @app.exception_handler(Exception)
    async def handle_unexpected_error(_: Request, exc: Exception) -> JSONResponse:
        logger.exception("unhandled error: %s", exc)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": {
                    "code": "internal_error",
                    "message": "Something went wrong while processing the request.",
                    "details": [
                        "The server logged the details; retry or re-upload the file."
                    ],
                }
            },
        )

    for router in ROUTERS:
        app.include_router(router, prefix=active_settings.api_prefix)

    @app.get("/", tags=["meta"], summary="Service metadata")
    def root() -> dict[str, object]:
        return {
            "name": active_settings.app_name,
            "version": active_settings.app_version,
            "api_prefix": active_settings.api_prefix,
            "docs": "/docs",
            "health": f"{active_settings.api_prefix}/health",
        }

    return app


app = create_app()


__all__ = ["app", "create_app"]
