"""Factor sandbox: provide time-series data for interactive what-if analysis."""

from __future__ import annotations

import numpy as np
import pandas as pd

from project_q.factors.model import FactorModel


def _fetch_spy_returns(dates: pd.DatetimeIndex) -> list[float]:
    """Fetch SPY monthly returns aligned to the model date index."""
    try:
        import yfinance as yf

        start = dates[0] - pd.offsets.MonthBegin(2)
        end = dates[-1] + pd.offsets.MonthEnd(1)
        raw = yf.download("SPY", start=start.strftime("%Y-%m-%d"),
                          end=end.strftime("%Y-%m-%d"), progress=False, auto_adjust=True)
        if raw.empty:
            return [0.0] * len(dates)
        prices = raw["Close"].resample("ME").last()
        rets = prices.pct_change().dropna()
        rets.index = rets.index.to_period("M").to_timestamp("M")
        dates_ts = dates.to_period("M").to_timestamp("M")
        aligned = rets.reindex(dates_ts).fillna(0.0)
        return [round(float(v), 8) for v in aligned.values]
    except Exception:
        return [0.0] * len(dates)


def sandbox_data(model: FactorModel) -> dict:
    """Extract factor return time series and per-ticker residuals for the sandbox.

    Returns
    -------
    dict with:
        dates: list of date strings
        factor_returns: {factor_name: [monthly returns]}
        spy_returns: [monthly SPY returns aligned to dates]
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

    # S&P 500 benchmark returns
    spy_returns = _fetch_spy_returns(ret.index)

    # Per-ticker data: residuals, betas, alpha
    import statsmodels.api as sm

    ticker_data = {}
    for ticker, reg in model.results.items():
        y = ret[ticker] - rf
        X = sm.add_constant(factor_data)
        mask = y.notna() & X.notna().all(axis=1)
        ols = sm.OLS(y[mask], X[mask]).fit()

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
        "spy_returns": spy_returns,
        "tickers": ticker_data,
        "factor_names": model.factor_names,
    }
