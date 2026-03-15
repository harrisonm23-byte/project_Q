"""Factor sandbox: provide time-series data for interactive what-if analysis."""

from __future__ import annotations

import numpy as np
import pandas as pd

from project_q.factors.model import FactorModel


def sandbox_data(model: FactorModel) -> dict:
    """Extract factor return time series and per-ticker residuals for the sandbox.

    The sandbox lets users adjust betas interactively and see how
    cumulative returns change. This function provides the raw ingredients:
    factor returns, residuals, and dates.

    Returns
    -------
    dict with:
        dates: list of date strings
        factor_returns: {factor_name: [monthly returns]}
        tickers: {ticker: {residuals: [...], betas: {...}, alpha_monthly: float}}
    """
    if not model.results:
        raise RuntimeError("Call .fit() first.")

    ret, fac = model._align_data()
    rf = fac[model.rf_column]
    factor_data = fac[model.factor_names]

    dates = [d.strftime("%Y-%m-%d") for d in ret.index]

    # Factor return series
    factor_returns = {}
    for f in model.factor_names:
        factor_returns[f] = [round(float(v), 8) for v in factor_data[f].values]

    # Per-ticker data: residuals, betas, alpha
    import statsmodels.api as sm

    ticker_data = {}
    for ticker, reg in model.results.items():
        y = ret[ticker] - rf
        X = sm.add_constant(factor_data)
        mask = y.notna() & X.notna().all(axis=1)
        ols = sm.OLS(y[mask], X[mask]).fit()

        # Reconstruct residuals aligned to full date index
        residuals = [0.0] * len(dates)
        for i, date in enumerate(ret.index):
            if date in ols.resid.index:
                residuals[i] = round(float(ols.resid.loc[date]), 8)

        ticker_data[ticker] = {
            "residuals": residuals,
            "betas": {k: round(v, 6) for k, v in reg.betas.items()},
            "alpha_monthly": round(reg.alpha, 8),
        }

    return {
        "dates": dates,
        "factor_returns": factor_returns,
        "tickers": ticker_data,
        "factor_names": model.factor_names,
    }
