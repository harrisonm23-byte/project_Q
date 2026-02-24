"""Fetch historical stock returns from Yahoo Finance."""

from __future__ import annotations

import pandas as pd
import yfinance as yf


def fetch_stock_returns(
    tickers: list[str],
    start: str = "2019-01-01",
    end: str = "2024-12-31",
    freq: str = "monthly",
) -> pd.DataFrame:
    """Download adjusted close prices and compute periodic returns.

    Parameters
    ----------
    tickers : list[str]
        Stock ticker symbols (e.g. ["AAPL", "MSFT", "JPM"]).
    start, end : str
        Date range in YYYY-MM-DD format.
    freq : str
        "daily" or "monthly". Monthly returns are computed by resampling
        daily prices to month-end and taking pct_change.

    Returns
    -------
    pd.DataFrame
        Returns indexed by date with one column per ticker.
        Values are simple (not log) returns expressed as decimals.
    """
    raw = yf.download(tickers, start=start, end=end, auto_adjust=True)

    # yfinance returns MultiIndex columns when multiple tickers are passed
    if isinstance(raw.columns, pd.MultiIndex):
        prices = raw["Close"]
    else:
        prices = raw[["Close"]]
        prices.columns = tickers

    if freq == "monthly":
        prices = prices.resample("ME").last()

    returns = prices.pct_change().dropna()
    return returns
