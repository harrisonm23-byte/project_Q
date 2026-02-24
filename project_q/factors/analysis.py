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
