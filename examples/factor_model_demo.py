#!/usr/bin/env python3
"""
Factor Model Demo
=================
Pulls historical returns for a universe of stocks, fetches Fama-French
factor data, fits a 4-factor model (Market, Size, Value, Momentum),
and prints diagnostics.

Usage:
    python examples/factor_model_demo.py
"""

from project_q.data import fetch_stock_returns, fetch_fama_french_factors
from project_q.factors.model import FactorModel
from project_q.factors.analysis import (
    plot_factor_loadings,
    plot_factor_correlation,
    plot_r_squared,
    variance_attribution,
)

# ── Configuration ──────────────────────────────────────────────
UNIVERSE = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "META",   # mega-cap tech
    "JPM", "BAC", "GS",                          # financials
    "XOM", "CVX",                                 # energy
    "JNJ", "PFE",                                 # healthcare
    "WMT", "PG",                                  # consumer staples
]
START = "2019-01-01"
END = "2024-12-31"


def main() -> None:
    # 1. Fetch data
    print("Fetching stock returns...")
    returns = fetch_stock_returns(UNIVERSE, start=START, end=END, freq="monthly")
    print(f"  → {returns.shape[0]} months, {returns.shape[1]} assets\n")

    print("Fetching Fama-French factors...")
    factors = fetch_fama_french_factors(start=START, end=END, include_momentum=True)
    print(f"  → Factors: {list(factors.columns)}\n")

    # 2. Fit factor model
    model = FactorModel(returns, factors)
    model.fit()

    # 3. Results
    print("=" * 70)
    print("FACTOR MODEL SUMMARY")
    print("=" * 70)
    summary = model.summary()
    print(summary.to_string(float_format="{:.4f}".format))
    print()

    # 4. Alphas
    print("─" * 70)
    print("ANNUALIZED ALPHAS")
    print("─" * 70)
    alphas = model.get_alphas()
    print(alphas.to_string(float_format="{:.4f}".format))
    print()

    # 5. Variance decomposition
    print("─" * 70)
    print("VARIANCE ATTRIBUTION (fraction of total variance)")
    print("─" * 70)
    var_attr = variance_attribution(model)
    print(var_attr.to_string(float_format="{:.2%}".format))
    print()

    # 6. Covariance decomposition
    sys_cov, idio_cov = model.covariance_decomposition()
    print("─" * 70)
    print("SYSTEMATIC COVARIANCE MATRIX (annualized, top-left 5×5)")
    print("─" * 70)
    print((sys_cov.iloc[:5, :5] * 12).to_string(float_format="{:.4f}".format))
    print()

    # 7. Plots (saved to files)
    print("Generating plots...")
    fig1 = plot_factor_loadings(model)
    fig1.savefig("examples/factor_loadings.png", dpi=150)
    print("  → examples/factor_loadings.png")

    fig2 = plot_factor_correlation(model)
    fig2.savefig("examples/factor_correlation.png", dpi=150)
    print("  → examples/factor_correlation.png")

    fig3 = plot_r_squared(model)
    fig3.savefig("examples/r_squared.png", dpi=150)
    print("  → examples/r_squared.png")

    print("\nDone.")


if __name__ == "__main__":
    main()
