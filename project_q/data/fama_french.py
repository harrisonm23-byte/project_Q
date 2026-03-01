"""Fetch Fama-French factor data from Kenneth French's data library."""

from __future__ import annotations

import pandas as pd
from io import BytesIO
from zipfile import ZipFile
import urllib.request


def _read_french_csv(name: str, start: str, end: str) -> pd.DataFrame:
    """Download and parse a dataset from Kenneth French's data library."""
    url = f"https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/{name}_CSV.zip"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        raw = resp.read()

    with ZipFile(BytesIO(raw)) as zf:
        csv_name = [n for n in zf.namelist() if n.endswith(".CSV") or n.endswith(".csv")][0]
        with zf.open(csv_name) as f:
            lines = f.read().decode("utf-8", errors="replace").splitlines()

    header_idx = None
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped and stripped[0].isdigit() and len(stripped.split(",")[0].strip()) == 6:
            header_idx = i - 1 if i > 0 else i
            break

    if header_idx is None:
        for i, line in enumerate(lines):
            if "Mkt-RF" in line or "Mkt" in line:
                header_idx = i
                break

    if header_idx is None:
        raise ValueError(f"Could not find data header in {name}")

    data_lines = []
    for line in lines[header_idx + 1:]:
        stripped = line.strip()
        if not stripped:
            break
        parts = stripped.split(",")
        date_str = parts[0].strip()
        if len(date_str) == 6 and date_str.isdigit():
            data_lines.append(stripped)
        else:
            break

    header_line = lines[header_idx].strip()
    cols = [c.strip() for c in header_line.split(",")]

    from io import StringIO
    csv_text = ",".join(cols) + "\n" + "\n".join(data_lines)
    df = pd.read_csv(StringIO(csv_text))

    first_col = df.columns[0]
    df[first_col] = df[first_col].astype(str).str.strip()
    df.index = pd.to_datetime(df[first_col], format="%Y%m")
    df.index = df.index + pd.offsets.MonthEnd(0)
    df.index.name = None
    df = df.drop(columns=[first_col])

    df = df.apply(pd.to_numeric, errors="coerce")
    df.columns = [c.strip() for c in df.columns]

    start_dt = pd.Timestamp(start)
    end_dt = pd.Timestamp(end)
    df = df.loc[(df.index >= start_dt) & (df.index <= end_dt)]

    return df


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
    factors = _read_french_csv("F-F_Research_Data_Factors", start, end)
    factors = factors / 100.0

    if include_momentum:
        mom = _read_french_csv("F-F_Momentum_Factor", start, end)
        mom = mom / 100.0
        mom.columns = ["Mom"]
        factors = factors.join(mom, how="inner")

    return factors
