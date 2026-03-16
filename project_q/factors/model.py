"""Factor model: decompose stock returns into systematic risk factors."""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd
import statsmodels.api as sm


@dataclass
class RegressionResult:
    """Stores per-asset regression output."""

    ticker: str
    alpha: float
    betas: dict[str, float]
    t_stats: dict[str, float]
    p_values: dict[str, float]
    r_squared: float
    adj_r_squared: float
    residual_vol: float  # annualized std of residuals (idiosyncratic risk)


class FactorModel:
    """Fama-French style factor model for a universe of stocks.

    Runs time-series regressions of each stock's excess returns on a set of
    common factors to estimate factor loadings (betas), alphas, and
    idiosyncratic risk.

    Typical usage
    -------------
    >>> from project_q.data import fetch_stock_returns, fetch_fama_french_factors
    >>> returns = fetch_stock_returns(["AAPL", "MSFT", "JPM"])
    >>> factors = fetch_fama_french_factors()
    >>> model = FactorModel(returns, factors)
    >>> model.fit()
    >>> model.summary()
    """

    def __init__(
        self,
        returns: pd.DataFrame,
        factors: pd.DataFrame,
        rf_column: str = "RF",
    ) -> None:
        """
        Parameters
        ----------
        returns : pd.DataFrame
            Asset returns (columns = tickers, index = dates).
        factors : pd.DataFrame
            Factor returns plus risk-free rate column.
            Expected columns: Mkt-RF, SMB, HML, [Mom], RF.
        rf_column : str
            Name of the risk-free rate column in ``factors``.
        """
        self.returns = returns
        self.factors = factors
        self.rf_column = rf_column

        # Identify factor columns (everything except RF)
        self.factor_names = [c for c in factors.columns if c != rf_column]

        self.results: dict[str, RegressionResult] = {}

    def _align_data(self) -> tuple[pd.DataFrame, pd.DataFrame]:
        """Align returns and factors on their common date index."""
        # Normalize both indices to plain month-end timestamps so subtle
        # differences in dtype (datetime64[s] vs [ns]) or tz-awareness
        # cannot produce a spurious empty intersection.
        def _norm(idx: pd.DatetimeIndex) -> pd.DatetimeIndex:
            idx = idx.normalize()
            if idx.tz is not None:
                idx = idx.tz_localize(None)
            return idx.astype("datetime64[us]")

        ret = self.returns.copy()
        ret.index = _norm(ret.index)
        fac = self.factors.copy()
        fac.index = _norm(fac.index)

        common_idx = ret.index.intersection(fac.index)
        if len(common_idx) == 0:
            ret_range = f"{ret.index.min().date()} – {ret.index.max().date()}" if len(ret.index) else "empty"
            fac_range = f"{fac.index.min().date()} – {fac.index.max().date()}" if len(fac.index) else "empty"
            raise ValueError(
                f"No overlapping dates between returns ({ret_range}) "
                f"and factors ({fac_range}). "
                "Check that both cover the same date range and use monthly frequency."
            )
        ret = ret.loc[common_idx]
        fac = fac.loc[common_idx]
        return ret, fac

    def fit(self) -> None:
        """Run OLS regression for each asset: R_i - RF = alpha + beta * F + epsilon."""
        ret, fac = self._align_data()
        rf = fac[self.rf_column]
        X = sm.add_constant(fac[self.factor_names])

        for ticker in ret.columns:
            y = ret[ticker] - rf  # excess returns

            # Drop any rows where either side has NaN
            mask = y.notna() & X.notna().all(axis=1)
            y_clean = y[mask]
            X_clean = X[mask]

            if len(y_clean) < len(self.factor_names) + 2:
                continue  # not enough data points

            ols = sm.OLS(y_clean, X_clean).fit()

            betas = {name: ols.params[name] for name in self.factor_names}
            t_stats = {name: ols.tvalues[name] for name in self.factor_names}
            p_values = {name: ols.pvalues[name] for name in self.factor_names}

            # Annualize residual volatility (monthly → annual)
            resid_vol = float(np.std(ols.resid, ddof=1) * np.sqrt(12))

            self.results[ticker] = RegressionResult(
                ticker=ticker,
                alpha=float(ols.params["const"]),
                betas=betas,
                t_stats=t_stats,
                p_values=p_values,
                r_squared=float(ols.rsquared),
                adj_r_squared=float(ols.rsquared_adj),
                residual_vol=resid_vol,
            )

    def get_betas(self) -> pd.DataFrame:
        """Return a DataFrame of factor loadings (betas) for all fitted assets."""
        if not self.results:
            raise RuntimeError("Call .fit() first.")
        rows = {t: r.betas for t, r in self.results.items()}
        return pd.DataFrame(rows).T

    def get_alphas(self) -> pd.Series:
        """Return annualized alphas (monthly alpha * 12) for all fitted assets."""
        if not self.results:
            raise RuntimeError("Call .fit() first.")
        return pd.Series(
            {t: r.alpha * 12 for t, r in self.results.items()},
            name="annualized_alpha",
        )

    def get_r_squared(self) -> pd.DataFrame:
        """Return R² and adjusted R² for each asset."""
        if not self.results:
            raise RuntimeError("Call .fit() first.")
        rows = {
            t: {"R_squared": r.r_squared, "Adj_R_squared": r.adj_r_squared}
            for t, r in self.results.items()
        }
        return pd.DataFrame(rows).T

    def covariance_decomposition(self) -> tuple[pd.DataFrame, pd.DataFrame]:
        """Decompose the return covariance matrix into systematic + idiosyncratic.

        Returns
        -------
        systematic_cov : pd.DataFrame
            B * Sigma_F * B', where B is the beta matrix and Sigma_F is the
            factor covariance matrix.
        idiosyncratic_cov : pd.DataFrame
            Diagonal matrix of asset-specific (residual) variances.
        """
        if not self.results:
            raise RuntimeError("Call .fit() first.")

        _, fac = self._align_data()
        factor_cov = fac[self.factor_names].cov()

        B = self.get_betas()
        systematic_cov = B @ factor_cov @ B.T

        idio_var = pd.Series(
            {t: (r.residual_vol / np.sqrt(12)) ** 2 for t, r in self.results.items()}
        )
        idiosyncratic_cov = pd.DataFrame(
            np.diag(idio_var),
            index=idio_var.index,
            columns=idio_var.index,
        )

        return systematic_cov, idiosyncratic_cov

    def rolling_betas(
        self, window: int = 36
    ) -> dict[str, pd.DataFrame]:
        """Compute factor betas over a rolling window for each asset.

        Parameters
        ----------
        window : int
            Number of periods (months) in each rolling window.

        Returns
        -------
        dict[str, pd.DataFrame]
            Mapping of ticker → DataFrame with columns = factor names + "alpha",
            indexed by the end-date of each rolling window.
        """
        ret, fac = self._align_data()
        rf = fac[self.rf_column]
        factor_data = fac[self.factor_names]

        result: dict[str, pd.DataFrame] = {}

        for ticker in ret.columns:
            excess = ret[ticker] - rf
            records = []

            for i in range(window, len(excess) + 1):
                y_win = excess.iloc[i - window : i]
                X_win = sm.add_constant(factor_data.iloc[i - window : i])

                mask = y_win.notna() & X_win.notna().all(axis=1)
                y_clean = y_win[mask]
                X_clean = X_win[mask]

                if len(y_clean) < len(self.factor_names) + 2:
                    continue

                ols = sm.OLS(y_clean, X_clean).fit()
                row = {name: ols.params[name] for name in self.factor_names}
                row["alpha"] = ols.params["const"] * 12  # annualize
                row["r_squared"] = ols.rsquared
                row["date"] = excess.index[i - 1]
                records.append(row)

            if records:
                df = pd.DataFrame(records).set_index("date")
                result[ticker] = df

        return result

    def summary(self) -> pd.DataFrame:
        """Print a consolidated summary table of the factor model results."""
        if not self.results:
            raise RuntimeError("Call .fit() first.")

        rows = []
        for t, r in self.results.items():
            row = {
                "ticker": t,
                "alpha_annualized": r.alpha * 12,
                **{f"beta_{k}": v for k, v in r.betas.items()},
                "R_squared": r.r_squared,
                "idio_vol_annual": r.residual_vol,
            }
            rows.append(row)
        df = pd.DataFrame(rows).set_index("ticker")
        return df
