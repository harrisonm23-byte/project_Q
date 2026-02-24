"""Fetch Fama-French factor data from Kenneth French's data library."""

from __future__ import annotations

import pandas as pd
import pandas_datareader.data as web


def fetch_fama_french_factors(
    start: str = "2019-01-01",
    end: str = "2024-12-31",
    include_momentum: bool = True,
) -> pd.DataFrame:
    """Download Fama-French 3 factors + optional momentum (MOM) factor.

    The four factors returned:
        Mkt-RF : excess market return (market minus risk-free rate)
        SMB    : small minus big (size factor)
        HML    : high minus low (value factor)
        Mom    : momentum factor (winners minus losers) — optional
        RF     : risk-free rate

    All values are converted from percentages to decimals (e.g. 1.2% → 0.012).

    Parameters
    ----------
    start, end : str
        Date range in YYYY-MM-DD format.
    include_momentum : bool
        If True, also fetch the momentum factor and merge it in.

    Returns
    -------
    pd.DataFrame
        Monthly factor returns indexed by date.
    """
    ff3 = web.DataReader("F-F_Research_Data_Factors", "famafrench", start=start, end=end)
    factors = ff3[0]  # monthly data is the first table

    # Convert from percentage to decimal
    factors = factors / 100.0

    if include_momentum:
        mom_data = web.DataReader("F-F_Momentum_Factor", "famafrench", start=start, end=end)
        mom = mom_data[0] / 100.0
        mom.columns = ["Mom"]
        factors = factors.join(mom, how="inner")

    # Normalize the index to month-end Timestamps for easy joining
    factors.index = factors.index.to_timestamp("M")

    return factors
