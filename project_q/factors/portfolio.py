"""Mean-variance portfolio optimization using factor model estimates."""

from __future__ import annotations

import numpy as np
import pandas as pd
from scipy.optimize import minimize

from project_q.factors.model import FactorModel


def _expected_returns(model: FactorModel) -> pd.Series:
    """Factor-model-implied expected excess returns (annualized).

    E[R_i - Rf] = alpha_i * 12  +  sum_j(beta_ij * E[F_j]) * 12
    """
    betas = model.get_betas()
    alphas = model.get_alphas()
    _, fac = model._align_data()
    factor_means = fac[model.factor_names].mean()  # monthly

    # Monthly expected excess return, then annualize
    monthly = alphas + betas @ factor_means
    return monthly * 12


def _annual_cov(model: FactorModel) -> pd.DataFrame:
    """Annualized covariance matrix (systematic + idiosyncratic)."""
    sys_cov, idio_cov = model.covariance_decomposition()
    return (sys_cov + idio_cov) * 12


def _portfolio_stats(
    weights: np.ndarray, mu: np.ndarray, cov: np.ndarray, rf: float = 0.0
) -> dict:
    """Return, volatility, and Sharpe for a given weight vector."""
    ret = weights @ mu
    vol = np.sqrt(weights @ cov @ weights)
    sharpe = (ret - rf) / vol if vol > 0 else 0.0
    return {"return": float(ret), "volatility": float(vol), "sharpe": float(sharpe)}


def _min_variance(
    mu: np.ndarray, cov: np.ndarray, n: int, long_only: bool = True
) -> np.ndarray:
    """Minimum variance portfolio weights."""
    w0 = np.ones(n) / n
    bounds = [(0.0, 1.0)] * n if long_only else [(-1.0, 1.0)] * n
    constraints = [{"type": "eq", "fun": lambda w: np.sum(w) - 1.0}]

    res = minimize(
        lambda w: w @ cov @ w,
        w0,
        method="SLSQP",
        bounds=bounds,
        constraints=constraints,
        options={"maxiter": 1000, "ftol": 1e-12},
    )
    return res.x


def _max_sharpe(
    mu: np.ndarray, cov: np.ndarray, n: int, rf: float = 0.0, long_only: bool = True
) -> np.ndarray:
    """Maximum Sharpe ratio (tangency) portfolio weights."""
    w0 = np.ones(n) / n
    bounds = [(0.0, 1.0)] * n if long_only else [(-1.0, 1.0)] * n
    constraints = [{"type": "eq", "fun": lambda w: np.sum(w) - 1.0}]

    def neg_sharpe(w):
        ret = w @ mu
        vol = np.sqrt(w @ cov @ w)
        return -(ret - rf) / vol if vol > 1e-10 else 0.0

    res = minimize(
        neg_sharpe,
        w0,
        method="SLSQP",
        bounds=bounds,
        constraints=constraints,
        options={"maxiter": 1000, "ftol": 1e-12},
    )
    return res.x


def _target_return(
    mu: np.ndarray,
    cov: np.ndarray,
    n: int,
    target: float,
    long_only: bool = True,
) -> np.ndarray | None:
    """Minimum variance portfolio at a given target return."""
    w0 = np.ones(n) / n
    bounds = [(0.0, 1.0)] * n if long_only else [(-1.0, 1.0)] * n
    constraints = [
        {"type": "eq", "fun": lambda w: np.sum(w) - 1.0},
        {"type": "eq", "fun": lambda w: w @ mu - target},
    ]

    res = minimize(
        lambda w: w @ cov @ w,
        w0,
        method="SLSQP",
        bounds=bounds,
        constraints=constraints,
        options={"maxiter": 1000, "ftol": 1e-12},
    )
    if res.success:
        return res.x
    return None


def portfolio_optimize(model: FactorModel, long_only: bool = True) -> dict:
    """Run full portfolio optimization suite.

    Returns a dict with:
        tickers: list of asset names
        expected_returns: per-asset annualized expected excess returns
        min_variance: {weights, return, volatility, sharpe}
        max_sharpe:   {weights, return, volatility, sharpe}
        equal_weight: {weights, return, volatility, sharpe}
        efficient_frontier: list of {return, volatility, sharpe} points
    """
    mu_series = _expected_returns(model)
    cov_df = _annual_cov(model)
    tickers = list(mu_series.index)
    n = len(tickers)

    mu = mu_series.values
    cov = cov_df.values

    # Risk-free rate (annualized)
    _, fac = model._align_data()
    rf_annual = fac[model.rf_column].mean() * 12

    # ── Key portfolios ──────────────────────────────────────────────────
    w_eq = np.ones(n) / n
    w_minvar = _min_variance(mu, cov, n, long_only=long_only)
    w_maxsharpe = _max_sharpe(mu, cov, n, rf=rf_annual, long_only=long_only)

    def build_portfolio(name, weights):
        stats = _portfolio_stats(weights, mu, cov, rf=rf_annual)
        return {
            "weights": {t: float(round(w, 6)) for t, w in zip(tickers, weights)},
            **stats,
        }

    # ── Efficient frontier ──────────────────────────────────────────────
    # Generate 25 points between min-var return and max feasible return
    min_ret = w_minvar @ mu
    max_ret = float(np.max(mu)) if long_only else float(np.max(mu)) * 1.5
    # Ensure we have a range
    if max_ret <= min_ret:
        max_ret = min_ret + 0.01

    targets = np.linspace(min_ret, max_ret, 25)
    frontier = []
    for t in targets:
        w = _target_return(mu, cov, n, target=t, long_only=long_only)
        if w is not None:
            stats = _portfolio_stats(w, mu, cov, rf=rf_annual)
            frontier.append(stats)

    return {
        "tickers": tickers,
        "expected_returns": {t: float(round(v, 6)) for t, v in zip(tickers, mu)},
        "rf_annual": float(round(rf_annual, 6)),
        "min_variance": build_portfolio("min_variance", w_minvar),
        "max_sharpe": build_portfolio("max_sharpe", w_maxsharpe),
        "equal_weight": build_portfolio("equal_weight", w_eq),
        "efficient_frontier": frontier,
    }
