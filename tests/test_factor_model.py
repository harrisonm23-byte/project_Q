"""Unit tests for the factor model using synthetic data (no network calls)."""

import numpy as np
import pandas as pd
import pytest

from project_q.factors.model import FactorModel


@pytest.fixture()
def synthetic_data():
    """Create synthetic returns and factors with known betas."""
    np.random.seed(42)
    n_periods = 60
    dates = pd.date_range("2019-01-31", periods=n_periods, freq="ME")

    # Simulate two factors
    f1 = np.random.normal(0.005, 0.04, n_periods)
    f2 = np.random.normal(0.002, 0.03, n_periods)
    rf = np.full(n_periods, 0.002 / 12)

    factors = pd.DataFrame(
        {"Mkt-RF": f1, "SMB": f2, "RF": rf},
        index=dates,
    )

    # Stock A: beta_mkt=1.2, beta_smb=0.5, alpha=0.001
    noise_a = np.random.normal(0, 0.02, n_periods)
    ret_a = rf + 0.001 + 1.2 * f1 + 0.5 * f2 + noise_a

    # Stock B: beta_mkt=0.8, beta_smb=-0.3, alpha=0
    noise_b = np.random.normal(0, 0.015, n_periods)
    ret_b = rf + 0.0 + 0.8 * f1 - 0.3 * f2 + noise_b

    returns = pd.DataFrame({"A": ret_a, "B": ret_b}, index=dates)

    return returns, factors


def test_fit_produces_results(synthetic_data):
    returns, factors = synthetic_data
    model = FactorModel(returns, factors)
    model.fit()
    assert "A" in model.results
    assert "B" in model.results


def test_betas_close_to_true_values(synthetic_data):
    returns, factors = synthetic_data
    model = FactorModel(returns, factors)
    model.fit()
    betas = model.get_betas()

    # With 60 data points and moderate noise, betas should be within ~0.2
    assert abs(betas.loc["A", "Mkt-RF"] - 1.2) < 0.2
    assert abs(betas.loc["A", "SMB"] - 0.5) < 0.2
    assert abs(betas.loc["B", "Mkt-RF"] - 0.8) < 0.2
    assert abs(betas.loc["B", "SMB"] - (-0.3)) < 0.2


def test_r_squared_reasonable(synthetic_data):
    returns, factors = synthetic_data
    model = FactorModel(returns, factors)
    model.fit()
    r2 = model.get_r_squared()

    # Synthetic data has a strong signal; R² should be well above 0.3
    assert r2.loc["A", "R_squared"] > 0.3
    assert r2.loc["B", "R_squared"] > 0.3


def test_covariance_decomposition_shapes(synthetic_data):
    returns, factors = synthetic_data
    model = FactorModel(returns, factors)
    model.fit()
    sys_cov, idio_cov = model.covariance_decomposition()

    n = len(model.results)
    assert sys_cov.shape == (n, n)
    assert idio_cov.shape == (n, n)
    # Idiosyncratic cov should be diagonal
    off_diag = idio_cov.values[~np.eye(n, dtype=bool)]
    assert np.allclose(off_diag, 0)


def test_summary_columns(synthetic_data):
    returns, factors = synthetic_data
    model = FactorModel(returns, factors)
    model.fit()
    summary = model.summary()
    assert "alpha_annualized" in summary.columns
    assert "beta_Mkt-RF" in summary.columns
    assert "R_squared" in summary.columns
