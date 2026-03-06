"""Portfolio backtesting: apply optimized weights to historical returns."""

from __future__ import annotations

import numpy as np
import pandas as pd

from project_q.factors.model import FactorModel
from project_q.factors.portfolio import portfolio_optimize


def backtest_portfolios(model: FactorModel) -> dict:
    """Backtest min-variance, max-Sharpe, and equal-weight portfolios.

    Uses fixed weights (from full-period optimization) applied month-by-month
    to actual excess returns, with monthly rebalancing to target weights.

    Returns a dict with:
        dates: list of date strings
        cumulative: {strategy: [growth-of-$1 values]}
        drawdown: {strategy: [drawdown values]}
        metrics: {strategy: {total_return, cagr, volatility, sharpe, max_drawdown, sortino}}
    """
    opt = portfolio_optimize(model)
    ret_df, fac_df = model._align_data()
    rf = fac_df[model.rf_column]

    tickers = list(opt["tickers"])
    # Align return columns with optimization order
    excess_returns = ret_df[tickers].sub(rf, axis=0)

    strategies = {
        "max_sharpe": np.array([opt["max_sharpe"]["weights"][t] for t in tickers]),
        "min_variance": np.array([opt["min_variance"]["weights"][t] for t in tickers]),
        "equal_weight": np.array([opt["equal_weight"]["weights"][t] for t in tickers]),
    }

    dates = excess_returns.index
    rf_annual = fac_df[model.rf_column].mean() * 12
    n_years = len(dates) / 12

    result = {
        "dates": [d.strftime("%Y-%m-%d") for d in dates],
        "cumulative": {},
        "drawdown": {},
        "monthly_returns": {},
        "metrics": {},
    }

    for name, weights in strategies.items():
        # Monthly portfolio excess returns
        port_excess = excess_returns.values @ weights
        # Add back risk-free to get total returns
        port_total = port_excess + rf.values

        # Growth of $1
        cumul = np.cumprod(1 + port_total)
        # Drawdown from running max
        running_max = np.maximum.accumulate(cumul)
        dd = (cumul - running_max) / running_max

        # Performance metrics
        total_ret = float(cumul[-1] / cumul[0] - 1) if len(cumul) > 0 else 0.0
        cagr = float((cumul[-1]) ** (1 / n_years) - 1) if n_years > 0 else 0.0
        vol = float(np.std(port_total, ddof=1) * np.sqrt(12))
        mean_excess = float(np.mean(port_excess) * 12)
        sharpe = mean_excess / vol if vol > 0 else 0.0
        max_dd = float(np.min(dd))
        # Sortino: downside deviation using only negative excess returns
        downside = port_excess[port_excess < 0]
        downside_std = float(np.std(downside, ddof=1) * np.sqrt(12)) if len(downside) > 1 else vol
        sortino = mean_excess / downside_std if downside_std > 0 else 0.0

        result["cumulative"][name] = [round(float(v), 6) for v in cumul]
        result["drawdown"][name] = [round(float(v), 6) for v in dd]
        result["monthly_returns"][name] = [round(float(v), 6) for v in port_total]
        result["metrics"][name] = {
            "total_return": round(total_ret, 6),
            "cagr": round(cagr, 6),
            "volatility": round(vol, 6),
            "sharpe": round(sharpe, 4),
            "max_drawdown": round(max_dd, 6),
            "sortino": round(sortino, 4),
        }

    return result
