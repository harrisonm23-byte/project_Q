"""FastAPI backend for Project Q — serves factor model analysis to the React frontend."""

from __future__ import annotations

import traceback
from pathlib import Path

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from project_q.data import fetch_fama_french_factors, fetch_stock_returns
from project_q.factors import FactorModel
from project_q.factors.analysis import correlation_matrix, variance_attribution
from project_q.factors.backtest import backtest_portfolios
from project_q.factors.portfolio import portfolio_optimize

app = FastAPI(title="Project Q API", version="0.1.0")

# Allow React dev server (Vite) to call the API during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request / Response schemas ───────────────────────────────────────────────


class AnalyzeRequest(BaseModel):
    tickers: list[str]
    start: str = "2019-01-01"
    end: str = "2024-12-31"
    include_momentum: bool = True
    rolling_window: int | None = 36


class AnalyzeResponse(BaseModel):
    summary: dict
    alphas: dict[str, float]
    betas: dict[str, dict[str, float]]
    r_squared: dict[str, dict[str, float]]
    variance_attr: dict[str, dict[str, float]]
    rolling_betas: dict[str, list[dict]] | None = None
    correlations: dict[str, dict[str, dict[str, float]]] | None = None
    portfolio: dict | None = None
    backtest: dict | None = None
    factor_names: list[str]
    tickers: list[str]


# ── Endpoints ────────────────────────────────────────────────────────────────


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest):
    """Run the full factor model pipeline and return all results as JSON."""
    if not req.tickers:
        raise HTTPException(status_code=400, detail="At least one ticker is required.")
    if len(req.tickers) > 30:
        raise HTTPException(status_code=400, detail="Maximum 30 tickers at a time.")

    try:
        # 1. Fetch data
        returns = fetch_stock_returns(req.tickers, start=req.start, end=req.end, freq="monthly")
        factors = fetch_fama_french_factors(
            start=req.start, end=req.end, include_momentum=req.include_momentum
        )

        # 2. Fit model
        model = FactorModel(returns, factors)
        model.fit()

        if not model.results:
            raise HTTPException(
                status_code=422,
                detail="Model produced no results. Check tickers and date range.",
            )

        # 3. Gather results
        summary_df = model.summary()
        alphas = model.get_alphas()
        betas = model.get_betas()
        r2 = model.get_r_squared()
        var_attr = variance_attribution(model)

        # 4. Rolling factor exposures (optional)
        rolling_json = None
        if req.rolling_window is not None:
            n_months = len(model._align_data()[0])
            roll_window = min(req.rolling_window, max(12, n_months - 1))
            rolling = model.rolling_betas(window=roll_window)
            rolling_json = {}
            for tick, rdf in rolling.items():
                rdf_clean = rdf.copy()
                rdf_clean.index = rdf_clean.index.strftime("%Y-%m-%d")
                rdf_clean = rdf_clean.where(pd.notnull(rdf_clean), None)
                rolling_json[tick] = rdf_clean.reset_index().rename(
                    columns={"date": "date"}
                ).to_dict(orient="records")

        # 5. Convert to JSON-safe dicts (replace NaN with None)
        def clean(df_or_series):
            return df_or_series.where(pd.notnull(df_or_series), None)

        # 6. Correlation matrices (total + factor-implied)
        corr_matrices = correlation_matrix(model)
        corr_json = {
            key: clean(df).to_dict(orient="index")
            for key, df in corr_matrices.items()
        }

        # 7. Portfolio optimization (needs >= 2 assets)
        portfolio_json = None
        backtest_json = None
        if len(model.results) >= 2:
            portfolio_json = portfolio_optimize(model)
            # 8. Portfolio backtesting
            backtest_json = backtest_portfolios(model)

        return AnalyzeResponse(
            summary=clean(summary_df).to_dict(orient="index"),
            alphas=clean(alphas).to_dict(),
            betas=clean(betas).to_dict(orient="index"),
            r_squared=clean(r2).to_dict(orient="index"),
            variance_attr=clean(var_attr).to_dict(orient="index"),
            rolling_betas=rolling_json,
            correlations=corr_json,
            portfolio=portfolio_json,
            backtest=backtest_json,
            factor_names=model.factor_names,
            tickers=list(model.results.keys()),
        )

    except HTTPException:
        raise
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(exc))


# ── Serve React frontend (production build) ──────────────────────────────────

STATIC_DIR = Path(__file__).parent / "static"

if STATIC_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        """Serve the React app for any non-API route (SPA fallback)."""
        file = STATIC_DIR / full_path
        if file.is_file():
            return FileResponse(file)
        return FileResponse(STATIC_DIR / "index.html")
