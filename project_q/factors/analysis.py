"""Visualization and analysis utilities for factor model results."""

from __future__ import annotations

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns

from project_q.factors.model import FactorModel


def plot_factor_loadings(model: FactorModel, figsize: tuple = (12, 6)) -> plt.Figure:
    """Bar chart of factor betas for each asset."""
    betas = model.get_betas()
    fig, ax = plt.subplots(figsize=figsize)
    betas.plot(kind="bar", ax=ax)
    ax.set_title("Factor Loadings (Betas)")
    ax.set_ylabel("Beta")
    ax.axhline(0, color="black", linewidth=0.5)
    ax.legend(title="Factor")
    plt.tight_layout()
    return fig


def plot_factor_correlation(model: FactorModel, figsize: tuple = (8, 6)) -> plt.Figure:
    """Heatmap of factor return correlations."""
    _, fac = model._align_data()
    factor_corr = fac[model.factor_names].corr()

    fig, ax = plt.subplots(figsize=figsize)
    sns.heatmap(
        factor_corr,
        annot=True,
        fmt=".2f",
        cmap="RdBu_r",
        center=0,
        vmin=-1,
        vmax=1,
        ax=ax,
    )
    ax.set_title("Factor Return Correlation Matrix")
    plt.tight_layout()
    return fig


def plot_r_squared(model: FactorModel, figsize: tuple = (10, 5)) -> plt.Figure:
    """Horizontal bar chart showing R² for each asset."""
    r2 = model.get_r_squared()
    fig, ax = plt.subplots(figsize=figsize)
    r2["R_squared"].sort_values().plot(kind="barh", ax=ax, color="steelblue")
    ax.set_title("Model Fit: R² by Asset")
    ax.set_xlabel("R²")
    ax.set_xlim(0, 1)
    plt.tight_layout()
    return fig


def variance_attribution(model: FactorModel) -> pd.DataFrame:
    """Show what fraction of each asset's variance is explained by each factor.

    Returns a DataFrame where each row is an asset and columns are:
    - One column per factor showing its contribution to systematic variance
    - 'systematic' total systematic fraction
    - 'idiosyncratic' residual fraction
    """
    sys_cov, idio_cov = model.covariance_decomposition()
    betas = model.get_betas()
    _, fac = model._align_data()
    factor_var = fac[model.factor_names].var()

    rows = []
    for ticker in betas.index:
        total_var = sys_cov.loc[ticker, ticker] + idio_cov.loc[ticker, ticker]
        row = {}
        for f in model.factor_names:
            # Marginal variance contribution from factor f (ignoring cross-factor covariance)
            row[f"pct_{f}"] = (betas.loc[ticker, f] ** 2 * factor_var[f]) / total_var
        row["pct_systematic"] = sys_cov.loc[ticker, ticker] / total_var
        row["pct_idiosyncratic"] = idio_cov.loc[ticker, ticker] / total_var
        rows.append(row)

    return pd.DataFrame(rows, index=betas.index)


def alpha_significance(model: FactorModel) -> dict:
    """Detailed alpha / intercept analysis per ticker.

    For each asset, returns annualized alpha, t-statistic, p-value,
    95% confidence interval, and a plain-English verdict on whether
    the alpha is statistically significant.

    Returns
    -------
    dict
        Mapping of ticker → dict with keys:
        alpha_monthly, alpha_annual, t_stat, p_value,
        ci_lower, ci_upper, significant (bool), verdict (str),
        r_squared, factor_return_annual (return explained by factors).
    """
    if not model.results:
        raise RuntimeError("Call .fit() first.")

    ret, fac = model._align_data()
    rf = fac[model.rf_column]
    betas_df = model.get_betas()
    factor_means = fac[model.factor_names].mean()

    result = {}
    for ticker, reg in model.results.items():
        alpha_m = reg.alpha  # monthly
        alpha_a = alpha_m * 12  # annualized

        # t-stat and p-value for the intercept (const)
        t_stat = reg.t_stats.get("const", 0.0) if "const" in reg.t_stats else 0.0
        p_val = reg.p_values.get("const", 1.0) if "const" in reg.p_values else 1.0

        # We need to re-run OLS briefly to get the confidence interval for const
        import statsmodels.api as sm

        y = ret[ticker] - rf
        X = sm.add_constant(fac[model.factor_names])
        mask = y.notna() & X.notna().all(axis=1)
        ols = sm.OLS(y[mask], X[mask]).fit()

        t_stat = float(ols.tvalues["const"])
        p_val = float(ols.pvalues["const"])
        ci = ols.conf_int(alpha=0.05).loc["const"]
        ci_lower = float(ci.iloc[0]) * 12  # annualize
        ci_upper = float(ci.iloc[1]) * 12

        # Factor-explained return (annualized)
        factor_ret = float((betas_df.loc[ticker] @ factor_means) * 12)

        significant = p_val < 0.05
        if significant:
            direction = "positive" if alpha_a > 0 else "negative"
            verdict = (
                f"Statistically significant {direction} alpha of "
                f"{alpha_a * 100:.2f}% annualized (p={p_val:.3f}). "
                f"This suggests genuine skill or mispricing beyond factor exposure."
            )
        else:
            verdict = (
                f"Alpha of {alpha_a * 100:.2f}% annualized is NOT statistically "
                f"significant (p={p_val:.3f}). The return is largely explained by "
                f"factor exposures — no convincing evidence of edge."
            )

        result[ticker] = {
            "alpha_monthly": round(alpha_m, 8),
            "alpha_annual": round(alpha_a, 6),
            "t_stat": round(t_stat, 4),
            "p_value": round(p_val, 6),
            "ci_lower": round(ci_lower, 6),
            "ci_upper": round(ci_upper, 6),
            "significant": significant,
            "verdict": verdict,
            "r_squared": round(reg.r_squared, 6),
            "factor_return_annual": round(factor_ret, 6),
        }

    return result


def correlation_matrix(model: FactorModel) -> dict[str, pd.DataFrame]:
    """Compute total and factor-implied correlation matrices.

    Returns
    -------
    dict with keys:
        "total" : Correlation of actual excess returns (what you observe).
        "factor_implied" : Correlation implied by the factor model only
            (B * Sigma_F * B' normalized to correlation). Shows what the
            model *predicts* correlations should be.
    """
    ret, fac = model._align_data()
    rf = fac[model.rf_column]
    excess = ret.sub(rf, axis=0).dropna()

    # Total (observed) correlation
    total_corr = excess.corr()

    # Factor-implied correlation from systematic covariance
    sys_cov, idio_cov = model.covariance_decomposition()
    total_cov = sys_cov + idio_cov
    std = np.sqrt(np.diag(total_cov))
    std_outer = np.outer(std, std)
    # Avoid division by zero
    std_outer[std_outer == 0] = 1.0
    implied_corr = pd.DataFrame(
        sys_cov.values / std_outer,
        index=sys_cov.index,
        columns=sys_cov.columns,
    )
    # Diagonal should be the systematic fraction, but for a correlation
    # heatmap it's more intuitive to show 1.0 on the diagonal
    diag_vals = implied_corr.values.copy()
    np.fill_diagonal(diag_vals, 1.0)
    implied_corr = pd.DataFrame(diag_vals, index=implied_corr.index, columns=implied_corr.columns)

    return {"total": total_corr, "factor_implied": implied_corr}
