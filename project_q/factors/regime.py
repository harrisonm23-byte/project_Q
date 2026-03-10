"""Regime analysis: show how factor loadings shift across market environments."""

from __future__ import annotations

import numpy as np
import pandas as pd
import statsmodels.api as sm

from project_q.factors.model import FactorModel


def _classify_regimes(market_returns: pd.Series) -> pd.Series:
    """Classify each month into a market regime.

    Regimes:
        - "bear": cumulative drawdown > 10% from peak
        - "recovery": positive returns but still below prior peak
        - "bull": at or above prior peak with positive trend

    Uses a rolling 12-month return to smooth classification.
    """
    cumul = (1 + market_returns).cumprod()
    running_max = cumul.cummax()
    drawdown = (cumul - running_max) / running_max

    # Rolling 12-month return (or whatever is available)
    window = min(12, len(market_returns) - 1)
    if window < 2:
        return pd.Series("bull", index=market_returns.index)

    rolling_ret = market_returns.rolling(window).mean()

    regimes = pd.Series("bull", index=market_returns.index)
    regimes[drawdown < -0.10] = "bear"
    regimes[(drawdown < 0) & (drawdown >= -0.10) & (rolling_ret < 0)] = "recovery"
    regimes[(drawdown < 0) & (drawdown >= -0.10) & (rolling_ret >= 0)] = "recovery"

    # Simplify: if drawdown < -10% → bear, if below peak → recovery, else bull
    regimes = pd.Series("bull", index=market_returns.index)
    for i in range(len(drawdown)):
        dd = drawdown.iloc[i]
        if dd < -0.10:
            regimes.iloc[i] = "bear"
        elif dd < -0.02:
            regimes.iloc[i] = "recovery"
        else:
            regimes.iloc[i] = "bull"

    return regimes


def regime_analysis(model: FactorModel) -> dict:
    """Analyze factor loadings across market regimes.

    Returns
    -------
    dict with:
        regimes: list of {date, regime} for timeline visualization
        regime_stats: {regime: {count, pct, avg_market_return}}
        ticker_regimes: {ticker: {regime: {alpha, betas, r_squared, n_months}}}
        full_period: {ticker: {alpha, betas, r_squared}} for comparison
    """
    if not model.results:
        raise RuntimeError("Call .fit() first.")

    ret, fac = model._align_data()
    rf = fac[model.rf_column]
    market = fac["Mkt-RF"] if "Mkt-RF" in fac.columns else None

    if market is None:
        return {"error": "No market factor (Mkt-RF) found for regime classification."}

    # Classify regimes
    regimes = _classify_regimes(market)

    # Timeline data
    regime_timeline = [
        {"date": d.strftime("%Y-%m-%d"), "regime": regimes.loc[d]}
        for d in regimes.index
    ]

    # Regime statistics
    regime_stats = {}
    for regime in ["bull", "recovery", "bear"]:
        mask = regimes == regime
        count = int(mask.sum())
        if count == 0:
            continue
        regime_stats[regime] = {
            "count": count,
            "pct": round(count / len(regimes), 4),
            "avg_market_return": round(float(market[mask].mean() * 12), 6),
        }

    # Per-ticker, per-regime factor regressions
    ticker_regimes = {}
    full_period = {}

    for ticker in ret.columns:
        if ticker not in model.results:
            continue

        y = ret[ticker] - rf

        # Full period summary
        reg = model.results[ticker]
        full_period[ticker] = {
            "alpha_annual": round(reg.alpha * 12, 6),
            "betas": {k: round(v, 4) for k, v in reg.betas.items()},
            "r_squared": round(reg.r_squared, 4),
        }

        ticker_regimes[ticker] = {}

        for regime in ["bull", "recovery", "bear"]:
            mask = regimes == regime
            if mask.sum() < len(model.factor_names) + 2:
                continue  # not enough data

            y_regime = y[mask]
            X_regime = sm.add_constant(fac[model.factor_names].loc[mask])

            valid = y_regime.notna() & X_regime.notna().all(axis=1)
            y_clean = y_regime[valid]
            X_clean = X_regime[valid]

            if len(y_clean) < len(model.factor_names) + 2:
                continue

            ols = sm.OLS(y_clean, X_clean).fit()

            betas = {f: round(float(ols.params[f]), 4) for f in model.factor_names}
            ticker_regimes[ticker][regime] = {
                "alpha_annual": round(float(ols.params["const"]) * 12, 6),
                "betas": betas,
                "r_squared": round(float(ols.rsquared), 4),
                "n_months": len(y_clean),
            }

    return {
        "regimes": regime_timeline,
        "regime_stats": regime_stats,
        "ticker_regimes": ticker_regimes,
        "full_period": full_period,
        "factor_names": model.factor_names,
        "tickers": list(full_period.keys()),
    }
