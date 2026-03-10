"""Pair/spread decomposition: factor-based analysis for long/short thinking."""

from __future__ import annotations

from itertools import combinations

import numpy as np
import pandas as pd

from project_q.factors.model import FactorModel


def pair_decomposition(model: FactorModel) -> dict:
    """Decompose all stock pairs into factor vs. idiosyncratic components.

    For each pair (A, B), treating the spread as long A / short B:
    - Spread betas: beta_A - beta_B per factor
    - Spread alpha: alpha_A - alpha_B (annualized)
    - Residual correlation: correlation of OLS residuals (after stripping factors)
    - Factor exposure: whether the spread is a factor bet or genuine alpha

    Returns
    -------
    dict with:
        pairs: list of pair dicts
        tickers: list of tickers
        factor_names: list of factor names
    """
    if not model.results:
        raise RuntimeError("Call .fit() first.")

    tickers = list(model.results.keys())
    if len(tickers) < 2:
        return {"pairs": [], "tickers": tickers, "factor_names": model.factor_names}

    # Get residuals for residual correlation
    ret, fac = model._align_data()
    rf = fac[model.rf_column]

    import statsmodels.api as sm

    residuals = {}
    for ticker in tickers:
        y = ret[ticker] - rf
        X = sm.add_constant(fac[model.factor_names])
        mask = y.notna() & X.notna().all(axis=1)
        ols = sm.OLS(y[mask], X[mask]).fit()
        residuals[ticker] = ols.resid

    betas_df = model.get_betas()
    _, fac_data = model._align_data()
    factor_stds = fac_data[model.factor_names].std()

    pairs = []
    for a, b in combinations(tickers, 2):
        reg_a = model.results[a]
        reg_b = model.results[b]

        # Spread betas
        spread_betas = {}
        total_factor_var_contribution = 0.0
        for f in model.factor_names:
            sb = reg_a.betas[f] - reg_b.betas[f]
            spread_betas[f] = round(sb, 4)
            total_factor_var_contribution += abs(sb) * float(factor_stds[f])

        # Spread alpha
        spread_alpha_m = reg_a.alpha - reg_b.alpha
        spread_alpha_a = spread_alpha_m * 12

        # Residual correlation
        common = residuals[a].index.intersection(residuals[b].index)
        if len(common) > 2:
            resid_corr = float(residuals[a].loc[common].corr(residuals[b].loc[common]))
        else:
            resid_corr = 0.0

        # Classify the spread
        dominant_factor = max(
            model.factor_names,
            key=lambda f: abs(spread_betas[f]) * float(factor_stds[f]),
        )
        dominant_exposure = abs(spread_betas[dominant_factor]) * float(factor_stds[dominant_factor])

        # Is this a factor bet or genuine alpha?
        if abs(spread_alpha_a) > 0.02 and abs(spread_alpha_a) > dominant_exposure * 12 * 0.5:
            edge_type = "alpha"
            edge_desc = (
                f"Spread alpha ({spread_alpha_a * 100:.1f}% ann.) dominates factor exposure. "
                f"Potential genuine edge."
            )
        elif dominant_exposure > 0.005:
            edge_type = "factor_bet"
            edge_desc = (
                f"Primarily a {dominant_factor} bet "
                f"(spread beta {spread_betas[dominant_factor]:+.2f}). "
                f"Alpha of {spread_alpha_a * 100:.1f}% is secondary."
            )
        else:
            edge_type = "neutral"
            edge_desc = "Minimal factor tilt and no significant alpha in this pair."

        # Spread volatility (annualized) using factor model covariance
        w = np.zeros(len(tickers))
        w[tickers.index(a)] = 1.0
        w[tickers.index(b)] = -1.0
        sys_cov, idio_cov = model.covariance_decomposition()
        total_cov = sys_cov + idio_cov
        spread_var = float(w @ total_cov.values @ w) * 12
        spread_vol = float(np.sqrt(max(spread_var, 0)))

        # Spread Sharpe
        spread_sharpe = spread_alpha_a / spread_vol if spread_vol > 0 else 0.0

        pairs.append({
            "long": a,
            "short": b,
            "spread_betas": spread_betas,
            "spread_alpha_annual": round(spread_alpha_a, 6),
            "spread_vol_annual": round(spread_vol, 6),
            "spread_sharpe": round(spread_sharpe, 4),
            "residual_correlation": round(resid_corr, 4),
            "edge_type": edge_type,
            "edge_description": edge_desc,
            "dominant_factor": dominant_factor,
        })

    # Sort by absolute spread Sharpe descending
    pairs.sort(key=lambda p: abs(p["spread_sharpe"]), reverse=True)

    return {
        "pairs": pairs,
        "tickers": tickers,
        "factor_names": model.factor_names,
    }
