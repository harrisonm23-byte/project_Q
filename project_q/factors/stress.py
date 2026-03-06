"""Stress testing: estimate portfolio impact under factor shock scenarios."""

from __future__ import annotations

import numpy as np
import pandas as pd

from project_q.factors.model import FactorModel


# Predefined scenarios (shocks expressed in units of monthly factor std-devs)
_PRESETS: dict[str, dict[str, dict[str, float]]] = {
    "market_crash": {
        "label": "Market Crash",
        "description": "Broad equity sell-off (-2σ market, flight to quality)",
        "shocks": {"Mkt-RF": -2.0, "SMB": -1.0, "HML": 0.5},
    },
    "growth_rotation": {
        "label": "Growth → Value Rotation",
        "description": "Sharp rotation from growth into value stocks",
        "shocks": {"Mkt-RF": -0.5, "HML": 2.0, "SMB": 0.5},
    },
    "small_cap_squeeze": {
        "label": "Small-Cap Squeeze",
        "description": "Small caps underperform large caps significantly",
        "shocks": {"Mkt-RF": 0.0, "SMB": -2.0, "HML": 0.0},
    },
    "momentum_crash": {
        "label": "Momentum Crash",
        "description": "Sudden reversal punishes momentum strategies",
        "shocks": {"Mom": -2.5, "Mkt-RF": -0.5},
    },
    "risk_on_rally": {
        "label": "Risk-On Rally",
        "description": "Strong market rally favouring small-cap growth",
        "shocks": {"Mkt-RF": 2.0, "SMB": 1.0, "HML": -1.0},
    },
}


def stress_test(model: FactorModel) -> dict:
    """Run predefined + custom-ready stress scenarios.

    For each scenario, multiply factor shocks (in σ-units) by the historical
    monthly factor standard deviations to get absolute shocks, then use each
    asset's betas to estimate the return impact.

    Returns
    -------
    dict with:
        factor_stats: {factor: {mean, std}} — historical monthly stats
        scenarios: list of scenario dicts, each containing:
            id, label, description, shocks (σ-units),
            abs_shocks (decimal), stock_impacts, portfolio_impacts
    """
    _, fac = model._align_data()
    factor_data = fac[model.factor_names]
    factor_means = factor_data.mean()
    factor_stds = factor_data.std()

    betas_df = model.get_betas()  # rows = tickers, cols = factors
    tickers = list(betas_df.index)

    # Portfolio weights (if available)
    from project_q.factors.portfolio import portfolio_optimize

    port = portfolio_optimize(model) if len(model.results) >= 2 else None
    portfolios = {}
    if port:
        portfolios = {
            "max_sharpe": np.array([port["max_sharpe"]["weights"][t] for t in tickers]),
            "min_variance": np.array([port["min_variance"]["weights"][t] for t in tickers]),
            "equal_weight": np.array([port["equal_weight"]["weights"][t] for t in tickers]),
        }

    # Filter presets to only include factors the model actually has
    active_factors = set(model.factor_names)

    factor_stats = {}
    for f in model.factor_names:
        factor_stats[f] = {
            "mean": round(float(factor_means[f]), 6),
            "std": round(float(factor_stds[f]), 6),
        }

    scenarios = []
    for sid, preset in _PRESETS.items():
        # Skip scenarios that reference factors not in the model
        shock_factors = set(preset["shocks"].keys())
        if not shock_factors.intersection(active_factors):
            continue

        # Build sigma-unit shocks (only for factors in the model)
        sigma_shocks = {}
        abs_shocks = {}
        for f in model.factor_names:
            s = preset["shocks"].get(f, 0.0)
            sigma_shocks[f] = s
            abs_shocks[f] = round(float(s * factor_stds[f]), 6)

        # Stock-level impacts: sum(beta_j * abs_shock_j) for each stock
        abs_shock_arr = np.array([abs_shocks[f] for f in model.factor_names])
        stock_impacts = {}
        for i, t in enumerate(tickers):
            impact = float(betas_df.iloc[i].values @ abs_shock_arr)
            stock_impacts[t] = round(impact, 6)

        # Portfolio-level impacts
        port_impacts = {}
        if portfolios:
            stock_impact_arr = np.array([stock_impacts[t] for t in tickers])
            for pname, weights in portfolios.items():
                port_impacts[pname] = round(float(weights @ stock_impact_arr), 6)

        scenarios.append({
            "id": sid,
            "label": preset["label"],
            "description": preset["description"],
            "shocks": sigma_shocks,
            "abs_shocks": abs_shocks,
            "stock_impacts": stock_impacts,
            "portfolio_impacts": port_impacts,
        })

    return {
        "factor_stats": factor_stats,
        "scenarios": scenarios,
        "factor_names": model.factor_names,
        "tickers": tickers,
    }
