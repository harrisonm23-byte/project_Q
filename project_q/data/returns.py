"""Fetch historical stock returns from Yahoo Finance."""

from __future__ import annotations

import os
import pandas as pd
import yfinance as yf

# Redirect yfinance SQLite caches to /tmp so they are always writable,
# including in read-only production deployments where the default
# user-cache directory (e.g. ~/.cache) triggers OSError(5, I/O error).
_yf_cache_dir = os.path.join("/tmp", "py-yfinance-cache")
os.makedirs(_yf_cache_dir, exist_ok=True)
yf.set_tz_cache_location(_yf_cache_dir)


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
    raw = yf.download(tickers, start=start, end=end, auto_adjust=True, progress=False)

    if raw.empty:
        raise ValueError(
            f"No price data returned for tickers {tickers} over {start} to {end}. "
            "Check that the ticker symbols are valid and the date range is correct."
        )

    # yfinance returns MultiIndex columns when multiple tickers are passed
    if isinstance(raw.columns, pd.MultiIndex):
        prices = raw["Close"]
    else:
        prices = raw[["Close"]]
        prices.columns = tickers

    # Drop any tickers that came back entirely empty
    prices = prices.dropna(axis=1, how="all")
    if prices.empty:
        raise ValueError(
            f"Price data for {tickers} was empty after download. "
            "Verify ticker symbols are correct."
        )

    if freq == "monthly":
        prices = prices.resample("ME").last()

    returns = prices.pct_change().dropna(how="all")

    # Normalize index to plain month-end timestamps (no freq metadata, no tz)
    returns.index = returns.index.normalize()
    if returns.index.tz is not None:
        returns.index = returns.index.tz_localize(None)

    return returns
