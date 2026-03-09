import React, { useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  ReferenceDot,
  Area,
  AreaChart,
  ComposedChart,
} from "recharts";
import { FactorInfoPopover } from "./FactorInfo";
import { FactorHedgePanel, SummaryHedgePanel } from "./HedgePanel";

const COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6"];


function HBar({ data, valueKey, labelKey, formatValue, colorKey, singleColor, maxValue: maxOverride }) {
  const maxVal = maxOverride != null ? maxOverride : Math.max(...data.map((d) => Math.abs(d[valueKey])));

  return (
    <div className="hbar-chart">
      {data.map((d, i) => {
        const val = d[valueKey];
        const absVal = Math.abs(val);
        const pct = maxVal > 0 ? (absVal / maxVal) * 100 : 0;
        const color = d[colorKey] || singleColor || COLORS[i % COLORS.length];
        const label = d[labelKey];
        const formatted = formatValue ? formatValue(val) : val;

        return (
          <div key={label} className="hbar-row">
            <div className="hbar-bar-wrap">
              <div
                className="hbar-bar"
                style={{ width: `${Math.max(pct, 2)}%`, background: color }}
              >
                <span className="hbar-label">{label}</span>
              </div>
              <span className="hbar-value">{formatted}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const DEFAULT_TICKERS = "AAPL, MSFT, GOOGL, AMZN, JPM";

const WINDOW_OPTIONS = [12, 24, 36, 48, 60];

export default function App() {
  const [tickers, setTickers] = useState(DEFAULT_TICKERS);
  const [start, setStart] = useState("2019-01-01");
  const [end, setEnd] = useState("2024-12-31");
  const [rollingEnabled, setRollingEnabled] = useState(true);
  const [rollingWindow, setRollingWindow] = useState(36);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState("summary");

  async function handleAnalyze(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setData(null);

    const tickerList = tickers
      .split(",")
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean);

    try {
      const resp = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tickers: tickerList,
          start,
          end,
          include_momentum: true,
          rolling_window: rollingEnabled ? rollingWindow : null,
        }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.detail || `Server error ${resp.status}`);
      }
      setData(await resp.json());
      setActiveTab("summary");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <header>
        <h1>Project Q</h1>
        <p className="subtitle">Fama-French Factor Model Analysis</p>
      </header>

      {/* ── Input Form ─────────────────────────────── */}
      <form className="controls" onSubmit={handleAnalyze}>
        <div className="field field-tickers">
          <label>Tickers (comma-separated)</label>
          <input
            type="text"
            value={tickers}
            onChange={(e) => setTickers(e.target.value)}
            placeholder="AAPL, MSFT, GOOGL"
          />
        </div>

        {/* ── Analysis Options ──────────────────────── */}
        <div className="options-section">
          <span className="options-label">Analysis Options</span>
          <div className="options-grid">
            <div className="option-card active">
              <span className="option-icon">F</span>
              <span className="option-text">
                <span className="option-title">Factor Analysis</span>
                <span className="option-desc">Mkt-RF, SMB, HML, Mom</span>
              </span>
            </div>

            <button
              type="button"
              className={`option-card option-card-select ${rollingEnabled ? "active" : ""}`}
              onClick={() => setRollingEnabled(!rollingEnabled)}
            >
              <span className="option-icon">R</span>
              <span className="option-text">
                <span className="option-title">Rolling Window</span>
                <span className="option-desc">
                  {rollingEnabled ? (
                    <select
                      value={rollingWindow}
                      onChange={(e) => {
                        e.stopPropagation();
                        setRollingWindow(Number(e.target.value));
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {WINDOW_OPTIONS.map((w) => (
                        <option key={w} value={w}>{w} months</option>
                      ))}
                    </select>
                  ) : (
                    "Time-varying exposures"
                  )}
                </span>
              </span>
            </button>

            <div className="option-card active">
              <span className="option-icon">P</span>
              <span className="option-text">
                <span className="option-title">Portfolio Construction</span>
                <span className="option-desc">Mean-variance optimization</span>
              </span>
            </div>

            <div className="option-card active">
              <span className="option-icon">B</span>
              <span className="option-text">
                <span className="option-title">Backtesting</span>
                <span className="option-desc">Historical performance</span>
              </span>
            </div>

            <div className="option-card active">
              <span className="option-icon">C</span>
              <span className="option-text">
                <span className="option-title">Correlation Heatmap</span>
                <span className="option-desc">Diversification analysis</span>
              </span>
            </div>

            <div className="option-card active">
              <span className="option-icon">S</span>
              <span className="option-text">
                <span className="option-title">Stress Testing</span>
                <span className="option-desc">Factor shock scenarios</span>
              </span>
            </div>
          </div>
        </div>

        {/* ── Date Range & Submit ─────────────────────── */}
        <div className="controls-bottom">
          <div className="field-row">
            <div className="field">
              <label>Start date</label>
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="field">
              <label>End date</label>
              <input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>
          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? "Analyzing..." : "Run Analysis"}
          </button>
        </div>
      </form>

      {error && <div className="error">{error}</div>}

      {/* ── Results ─────────────────────────────────── */}
      {data && (
        <div className="results">
          <nav className="tabs">
            {["summary", "betas", "r_squared", "variance", "correlation",
              ...(data.portfolio ? ["portfolio"] : []),
              ...(data.backtest ? ["backtest"] : []),
              ...(data.stress ? ["stress"] : []),
              ...(data.rolling_betas ? ["rolling"] : [])
            ].map((tab) => {
              const tabLabel = {
                summary: "Summary", betas: "Factor Loadings", r_squared: "R-Squared",
                variance: "Variance", correlation: "Correlation", portfolio: "Portfolio",
                backtest: "Backtest", stress: "Stress Test", rolling: "Rolling",
              }[tab];
              const tabInfoKey = {
                r_squared: "R_squared", variance: "Variance_Attribution",
                correlation: "Correlation", stress: "Stress_Test", rolling: "Rolling_Exposures",
              }[tab];
              return (
                <button
                  key={tab}
                  className={activeTab === tab ? "active" : ""}
                  onClick={() => setActiveTab(tab)}
                >
                  {tabInfoKey ? (
                    <FactorInfoPopover factorKey={tabInfoKey}>{tabLabel}</FactorInfoPopover>
                  ) : tabLabel}
                </button>
              );
            })}
          </nav>

          <div className="tab-content">
            {activeTab === "summary" && <SummaryTable data={data} />}
            {activeTab === "betas" && <BetasChart data={data} />}
            {activeTab === "r_squared" && <RSquaredChart data={data} />}
            {activeTab === "variance" && <VarianceChart data={data} />}
            {activeTab === "correlation" && <CorrelationHeatmap data={data} />}
            {activeTab === "portfolio" && <PortfolioTab data={data} />}
            {activeTab === "backtest" && <BacktestTab data={data} />}
            {activeTab === "stress" && <StressTestTab data={data} />}
            {activeTab === "rolling" && <RollingChart data={data} />}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Summary Table ──────────────────────────────────────────────────────── */

function SummaryTable({ data }) {
  const { summary, tickers, factor_names } = data;
  const [sortKey, setSortKey] = useState(null);

  const rows = [
    ...factor_names.map((f, i) => ({
      key: f,
      label: `Beta ${f}`,
      factorKey: f,
      color: COLORS[i % COLORS.length],
      getRaw: (t) => summary[t]?.[`beta_${f}`] ?? 0,
      getValue: (t) => fmt(summary[t]?.[`beta_${f}`]),
      getClass: () => "",
    })),
    {
      key: "alpha",
      label: "Alpha (ann.)",
      factorKey: "Alpha",
      color: null,
      getRaw: (t) => summary[t]?.alpha_annualized ?? 0,
      getValue: (t) => fmt(summary[t]?.alpha_annualized),
      getClass: (t) =>
        summary[t]?.alpha_annualized >= 0 ? "pos" : "neg",
    },
    {
      key: "r2",
      label: "R\u00B2",
      factorKey: "R_squared",
      color: null,
      getRaw: (t) => summary[t]?.R_squared ?? 0,
      getValue: (t) => fmt(summary[t]?.R_squared),
      getClass: () => "",
    },
    {
      key: "idio",
      label: "Idio Vol",
      factorKey: "Idio_Vol",
      color: null,
      getRaw: (t) => summary[t]?.idio_vol_annual ?? 0,
      getValue: (t) => fmt(summary[t]?.idio_vol_annual),
      getClass: () => "",
    },
  ];

  const activeRow = rows.find((r) => r.key === sortKey);
  const sortedTickers = activeRow
    ? [...tickers].sort((a, b) => activeRow.getRaw(b) - activeRow.getRaw(a))
    : tickers;

  function handleSort(key) {
    setSortKey(sortKey === key ? null : key);
  }

  return (
    <div className="table-wrap">
      <table className="summary-transposed">
        <thead>
          <tr>
            <th></th>
            {sortedTickers.map((t) => (
              <th key={t} className="ticker-col">{t}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className={sortKey === row.key ? "sort-active-row" : ""}>
              <td className="row-label">
                {row.color && (
                  <span
                    className="row-label-swatch"
                    style={{ background: row.color }}
                  />
                )}
                <FactorInfoPopover factorKey={row.factorKey}>
                  {row.label}
                </FactorInfoPopover>
                <button
                  type="button"
                  className={`sort-btn ${sortKey === row.key ? "sort-btn-active" : ""}`}
                  onClick={() => handleSort(row.key)}
                  title={`Sort tickers by ${row.label}`}
                >
                  &lt;&gt;
                </button>
              </td>
              {sortedTickers.map((t) => (
                <td key={t} className={row.getClass(t)}>
                  {row.getValue(t)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Factor Loadings (Betas) Chart ──────────────────────────────────────── */

function BetasChart({ data }) {
  const { betas, tickers, factor_names } = data;
  const chartData = tickers.map((t) => ({
    ticker: t,
    ...betas[t],
  }));

  return (
    <div>
      <div className="factor-legend">
        {factor_names.map((f, i) => (
          <FactorInfoPopover key={f} factorKey={f}>
            <span className="factor-legend-item">
              <span
                className="factor-legend-swatch"
                style={{ background: COLORS[i % COLORS.length] }}
              />
              {f}
            </span>
          </FactorInfoPopover>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="ticker" />
          <YAxis />
          <Tooltip formatter={(v) => v.toFixed(3)} />
          {factor_names.map((f, i) => (
            <Bar key={f} dataKey={f} fill={COLORS[i % COLORS.length]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── R-Squared Chart ────────────────────────────────────────────────────── */

function RSquaredChart({ data }) {
  const { r_squared, tickers } = data;
  const chartData = tickers
    .map((t) => ({ ticker: t, R2: r_squared[t].R_squared }))
    .sort((a, b) => b.R2 - a.R2);

  return (
    <HBar
      data={chartData}
      valueKey="R2"
      labelKey="ticker"
      formatValue={(v) => v.toFixed(4)}
      maxValue={1}
    />
  );
}

/* ── Variance Attribution Chart ─────────────────────────────────────────── */

function VarianceChart({ data }) {
  const { variance_attr, betas, tickers, factor_names } = data;
  const [hedgeSelection, setHedgeSelection] = useState(null); // { ticker, factor } or { ticker, summary: true }

  const chartData = tickers.map((t) => {
    const row = { ticker: t };
    factor_names.forEach((f) => {
      row[f] = variance_attr[t][`pct_${f}`] * 100;
    });
    row["Idiosyncratic"] = variance_attr[t].pct_idiosyncratic * 100;
    return row;
  });

  const allKeys = [...factor_names, "Idiosyncratic"];

  function handleBarClick(factorKey, entry) {
    if (!entry || factorKey === "Idiosyncratic") return;
    const ticker = entry.ticker;
    // Toggle off if clicking the same segment
    if (hedgeSelection?.ticker === ticker && hedgeSelection?.factor === factorKey) {
      setHedgeSelection(null);
    } else {
      setHedgeSelection({ ticker, factor: factorKey });
    }
  }

  function handleShowSummary() {
    if (hedgeSelection) {
      setHedgeSelection({ ticker: hedgeSelection.ticker, summary: true });
    }
  }

  return (
    <div>
      <div className="variance-header">
        <div className="factor-legend">
          {allKeys.map((k, i) => (
            <FactorInfoPopover key={k} factorKey={k === "Idiosyncratic" ? "Idio_Vol" : k}>
              <span className="factor-legend-item">
                <span
                  className="factor-legend-swatch"
                  style={{ background: COLORS[i % COLORS.length] }}
                />
                {k}
              </span>
            </FactorInfoPopover>
          ))}
        </div>
        <span className="variance-click-hint">Click a factor segment to see hedge strategies</span>
      </div>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="ticker" />
          <YAxis tickFormatter={(v) => `${v.toFixed(0)}%`} />
          <Tooltip formatter={(v) => `${v.toFixed(1)}%`} />
          {allKeys.map((k, i) => (
            <Bar
              key={k}
              dataKey={k}
              stackId="a"
              fill={COLORS[i % COLORS.length]}
              cursor={k !== "Idiosyncratic" ? "pointer" : "default"}
              onClick={(entry) => handleBarClick(k, entry)}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>

      {/* Hedge strategy panel */}
      {hedgeSelection && !hedgeSelection.summary && (
        <FactorHedgePanel
          ticker={hedgeSelection.ticker}
          factor={hedgeSelection.factor}
          beta={betas[hedgeSelection.ticker]?.[hedgeSelection.factor] ?? 0}
          pctVariance={(variance_attr[hedgeSelection.ticker]?.[`pct_${hedgeSelection.factor}`] ?? 0) * 100}
          onClose={() => setHedgeSelection(null)}
          onShowSummary={handleShowSummary}
        />
      )}
      {hedgeSelection?.summary && (
        <SummaryHedgePanel
          ticker={hedgeSelection.ticker}
          betas={betas}
          varianceAttr={variance_attr}
          factorNames={factor_names}
          onClose={() => setHedgeSelection(null)}
        />
      )}
    </div>
  );
}

/* ── Correlation Heatmap ───────────────────────────────────────────────── */

function corrColor(val) {
  if (val == null) return "var(--bg)";
  const clamped = Math.max(-1, Math.min(1, val));
  if (clamped >= 0) {
    const intensity = clamped;
    return `rgba(16, 185, 129, ${intensity * 0.7})`;
  } else {
    const intensity = -clamped;
    return `rgba(99, 102, 241, ${intensity * 0.7})`;
  }
}

function CorrelationHeatmap({ data }) {
  const { correlations, tickers } = data;
  const [mode, setMode] = useState("total");

  if (!correlations) {
    return (
      <p style={{ color: "var(--muted)", textAlign: "center", padding: "2rem" }}>
        Correlation data not available.
      </p>
    );
  }

  const matrix = correlations[mode] || {};
  const size = tickers.length;

  return (
    <div>
      <div className="heatmap-controls">
        <button
          className={`rolling-pill ${mode === "total" ? "active" : ""}`}
          onClick={() => setMode("total")}
        >
          Observed
        </button>
        <button
          className={`rolling-pill ${mode === "factor_implied" ? "active" : ""}`}
          onClick={() => setMode("factor_implied")}
        >
          Factor-Implied
        </button>
        <span className="heatmap-hint">
          {mode === "total"
            ? "Actual return correlations between stocks"
            : "Correlations predicted by the factor model alone"}
        </span>
      </div>

      <div className="heatmap-wrap">
        <div
          className="heatmap-grid"
          style={{
            gridTemplateColumns: `60px repeat(${size}, 1fr) 60px`,
            gridTemplateRows: `32px repeat(${size}, 1fr) 32px`,
          }}
        >
          <div className="heatmap-corner" />
          {tickers.map((t) => (
            <div key={`col-top-${t}`} className="heatmap-col-label">{t}</div>
          ))}
          <div className="heatmap-corner" />

          {tickers.map((rowTicker) => (
            <React.Fragment key={`row-${rowTicker}`}>
              <div className="heatmap-row-label">{rowTicker}</div>
              {tickers.map((colTicker) => {
                const val = matrix[rowTicker]?.[colTicker];
                const isDiag = rowTicker === colTicker;
                return (
                  <div
                    key={`${rowTicker}-${colTicker}`}
                    className={`heatmap-cell ${isDiag ? "heatmap-diag" : ""}`}
                    style={{ background: corrColor(val) }}
                    title={`${rowTicker} / ${colTicker}: ${val != null ? val.toFixed(3) : "N/A"}`}
                  >
                    {val != null ? val.toFixed(2) : "—"}
                  </div>
                );
              })}
              <div className="heatmap-row-label heatmap-row-label-right">{rowTicker}</div>
            </React.Fragment>
          ))}

          <div className="heatmap-corner" />
          {tickers.map((t) => (
            <div key={`col-bot-${t}`} className="heatmap-col-label heatmap-col-label-bottom">{t}</div>
          ))}
          <div className="heatmap-corner" />
        </div>

        <div className="heatmap-legend">
          <span className="heatmap-legend-label">-1.0</span>
          <div className="heatmap-legend-bar" />
          <span className="heatmap-legend-label">0</span>
          <div className="heatmap-legend-bar heatmap-legend-bar-pos" />
          <span className="heatmap-legend-label">+1.0</span>
        </div>
      </div>
    </div>
  );
}

/* ── Portfolio Construction Tab ─────────────────────────────────────────── */

const PORTFOLIO_COLORS = {
  min_variance: "#10b981",
  max_sharpe: "#6366f1",
  equal_weight: "#f59e0b",
};

const PORTFOLIO_LABELS = {
  min_variance: "Min Variance",
  max_sharpe: "Max Sharpe",
  equal_weight: "Equal Weight",
};

function PortfolioTab({ data }) {
  const { portfolio } = data;
  const [selected, setSelected] = useState("max_sharpe");

  if (!portfolio) {
    return (
      <p style={{ color: "var(--muted)", textAlign: "center", padding: "2rem" }}>
        Portfolio optimization requires at least 2 stocks.
      </p>
    );
  }

  const { efficient_frontier, min_variance, max_sharpe, equal_weight, tickers, expected_returns, rf_annual } = portfolio;
  const portfolios = { min_variance, max_sharpe, equal_weight };
  const active = portfolios[selected];

  // Frontier data for scatter chart (vol on X, return on Y)
  const frontierData = efficient_frontier.map((p) => ({
    vol: +(p.volatility * 100).toFixed(2),
    ret: +(p["return"] * 100).toFixed(2),
  }));

  // Individual asset points
  const assetData = tickers.map((t) => {
    const er = expected_returns[t] * 100;
    // Approximate individual vol from the covariance diagonal — we can get it from the
    // equal-weight stats or just show expected return for now. We'll use variance_attr
    // indirectly via the summary. For simplicity, use the full-period vol from summary.
    const summaryVol = data.summary[t]?.idio_vol_annual;
    // Actually, total vol is better. Let's compute from R² and idio_vol:
    // total_vol² = idio_vol² / (1 - R²) → total_vol = idio_vol / sqrt(1 - R²)
    const r2 = data.r_squared[t]?.R_squared ?? 0;
    const idioVol = summaryVol ?? 0;
    const totalVol = r2 < 1 ? idioVol / Math.sqrt(1 - r2) : idioVol;
    return { vol: +(totalVol * 100).toFixed(2), ret: +er.toFixed(2), label: t };
  });

  // Weights chart data
  const weightsData = tickers
    .map((t) => ({
      ticker: t,
      weight: +((active.weights[t] || 0) * 100).toFixed(2),
    }))
    .sort((a, b) => b.weight - a.weight);

  return (
    <div className="portfolio-tab">
      <div className="portfolio-controls">
        {Object.entries(PORTFOLIO_LABELS).map(([key, label]) => {
          const infoKey = key === "max_sharpe" ? "Max_Sharpe" : key === "min_variance" ? "Min_Variance" : "Equal_Weight";
          return (
            <span key={key} className="portfolio-pill-wrap">
              <button
                className={`rolling-pill ${selected === key ? "active" : ""}`}
                style={selected === key ? { background: PORTFOLIO_COLORS[key], borderColor: PORTFOLIO_COLORS[key] } : {}}
                onClick={() => setSelected(key)}
              >
                {label}
              </button>
              <FactorInfoPopover factorKey={infoKey}>
                <span className="pill-info-label">{""}</span>
              </FactorInfoPopover>
            </span>
          );
        })}
      </div>

      <div className="portfolio-stats">
        <div className="portfolio-stat-card">
          <span className="portfolio-stat-label">
            <FactorInfoPopover factorKey="Expected_Return">Expected Return</FactorInfoPopover>
          </span>
          <span className="portfolio-stat-value pos">
            {(active["return"] * 100).toFixed(2)}%
          </span>
        </div>
        <div className="portfolio-stat-card">
          <span className="portfolio-stat-label">
            <FactorInfoPopover factorKey="Volatility">Volatility</FactorInfoPopover>
          </span>
          <span className="portfolio-stat-value">
            {(active.volatility * 100).toFixed(2)}%
          </span>
        </div>
        <div className="portfolio-stat-card">
          <span className="portfolio-stat-label">
            <FactorInfoPopover factorKey="Sharpe_Ratio">Sharpe Ratio</FactorInfoPopover>
          </span>
          <span className="portfolio-stat-value" style={{ color: active.sharpe > 0 ? "var(--green)" : "var(--red)" }}>
            {active.sharpe.toFixed(3)}
          </span>
        </div>
        <div className="portfolio-stat-card">
          <span className="portfolio-stat-label">
            <FactorInfoPopover factorKey="Risk_Free_Rate">Risk-Free Rate</FactorInfoPopover>
          </span>
          <span className="portfolio-stat-value">
            {(rf_annual * 100).toFixed(2)}%
          </span>
        </div>
      </div>

      {/* Two-column: Frontier + Weights */}
      <div className="portfolio-grid">
        {/* Efficient Frontier */}
        <div className="portfolio-chart-section">
          <h3 className="portfolio-chart-title">
            <FactorInfoPopover factorKey="Efficient_Frontier">Efficient Frontier</FactorInfoPopover>
          </h3>
          <ResponsiveContainer width="100%" height={360}>
            <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="vol"
                type="number"
                name="Volatility"
                unit="%"
                tick={{ fontSize: 11 }}
                label={{ value: "Volatility (%)", position: "bottom", offset: 5, style: { fontSize: 11, fill: "var(--muted)" } }}
              />
              <YAxis
                dataKey="ret"
                type="number"
                name="Return"
                unit="%"
                tick={{ fontSize: 11 }}
                label={{ value: "Return (%)", angle: -90, position: "insideLeft", offset: 10, style: { fontSize: 11, fill: "var(--muted)" } }}
              />
              <Tooltip
                formatter={(val, name) => [`${val}%`, name]}
                labelFormatter={() => ""}
              />
              {/* Frontier curve */}
              <Scatter
                data={frontierData}
                fill="var(--accent)"
                fillOpacity={0.4}
                r={3}
                name="Frontier"
                line={{ stroke: "var(--accent)", strokeWidth: 2 }}
                lineType="fitting"
              />
              {/* Individual assets */}
              <Scatter
                data={assetData}
                fill="var(--muted)"
                r={5}
                name="Assets"
                shape="diamond"
              />
              {/* Key portfolio markers */}
              <ReferenceDot
                x={+(min_variance.volatility * 100).toFixed(2)}
                y={+(min_variance["return"] * 100).toFixed(2)}
                r={7}
                fill={PORTFOLIO_COLORS.min_variance}
                stroke="white"
                strokeWidth={2}
              />
              <ReferenceDot
                x={+(max_sharpe.volatility * 100).toFixed(2)}
                y={+(max_sharpe["return"] * 100).toFixed(2)}
                r={7}
                fill={PORTFOLIO_COLORS.max_sharpe}
                stroke="white"
                strokeWidth={2}
              />
              <ReferenceDot
                x={+(equal_weight.volatility * 100).toFixed(2)}
                y={+(equal_weight["return"] * 100).toFixed(2)}
                r={7}
                fill={PORTFOLIO_COLORS.equal_weight}
                stroke="white"
                strokeWidth={2}
              />
            </ScatterChart>
          </ResponsiveContainer>
          {/* Chart legend */}
          <div className="portfolio-frontier-legend">
            {Object.entries(PORTFOLIO_LABELS).map(([key, label]) => (
              <span key={key} className="portfolio-frontier-legend-item">
                <span className="portfolio-frontier-dot" style={{ background: PORTFOLIO_COLORS[key] }} />
                {label}
              </span>
            ))}
            <span className="portfolio-frontier-legend-item">
              <span className="portfolio-frontier-dot" style={{ background: "var(--muted)", clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)" }} />
              Individual Assets
            </span>
          </div>
        </div>

        {/* Weights */}
        <div className="portfolio-chart-section">
          <h3 className="portfolio-chart-title">
            {PORTFOLIO_LABELS[selected]} Weights
          </h3>
          <HBar
            data={weightsData}
            valueKey="weight"
            labelKey="ticker"
            formatValue={(v) => `${v.toFixed(1)}%`}
            singleColor={PORTFOLIO_COLORS[selected]}
          />

          {/* Comparison table */}
          <div className="portfolio-compare">
            <table>
              <thead>
                <tr>
                  <th></th>
                  {Object.entries(PORTFOLIO_LABELS).map(([key, label]) => (
                    <th key={key} style={{ color: PORTFOLIO_COLORS[key] }}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="row-label">
                    <FactorInfoPopover factorKey="Expected_Return">Return</FactorInfoPopover>
                  </td>
                  {Object.keys(PORTFOLIO_LABELS).map((key) => (
                    <td key={key}>{(portfolios[key]["return"] * 100).toFixed(2)}%</td>
                  ))}
                </tr>
                <tr>
                  <td className="row-label">
                    <FactorInfoPopover factorKey="Volatility">Volatility</FactorInfoPopover>
                  </td>
                  {Object.keys(PORTFOLIO_LABELS).map((key) => (
                    <td key={key}>{(portfolios[key].volatility * 100).toFixed(2)}%</td>
                  ))}
                </tr>
                <tr>
                  <td className="row-label">
                    <FactorInfoPopover factorKey="Sharpe_Ratio">Sharpe</FactorInfoPopover>
                  </td>
                  {Object.keys(PORTFOLIO_LABELS).map((key) => (
                    <td key={key}>{portfolios[key].sharpe.toFixed(3)}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Backtest Tab ──────────────────────────────────────────────────────── */

const STRATEGY_COLORS = {
  max_sharpe: "#6366f1",
  min_variance: "#10b981",
  equal_weight: "#f59e0b",
};

const STRATEGY_LABELS = {
  max_sharpe: "Max Sharpe",
  min_variance: "Min Variance",
  equal_weight: "Equal Weight",
};

const METRIC_LABELS = {
  total_return: "Total Return",
  cagr: "CAGR",
  volatility: "Volatility",
  sharpe: "Sharpe Ratio",
  max_drawdown: "Max Drawdown",
  sortino: "Sortino Ratio",
};

function BacktestTab({ data }) {
  const { backtest } = data;
  const [visibleStrategies, setVisibleStrategies] = useState(
    () => new Set(Object.keys(STRATEGY_LABELS))
  );

  if (!backtest) {
    return (
      <p style={{ color: "var(--muted)", textAlign: "center", padding: "2rem" }}>
        Backtesting requires at least 2 stocks.
      </p>
    );
  }

  const { dates, cumulative, drawdown, metrics } = backtest;
  const strategyKeys = Object.keys(STRATEGY_LABELS);

  function toggleStrategy(key) {
    setVisibleStrategies((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key); // keep at least one
      } else {
        next.add(key);
      }
      return next;
    });
  }

  // Build chart data: one row per date with columns for each strategy
  const cumulData = dates.map((d, i) => {
    const row = { date: d.slice(0, 7) };
    strategyKeys.forEach((s) => {
      row[s] = cumulative[s][i];
    });
    return row;
  });

  const ddData = dates.map((d, i) => {
    const row = { date: d.slice(0, 7) };
    strategyKeys.forEach((s) => {
      row[s] = +(drawdown[s][i] * 100).toFixed(2);
    });
    return row;
  });

  function fmtMetric(key, val) {
    if (["total_return", "cagr", "volatility", "max_drawdown"].includes(key)) {
      return `${(val * 100).toFixed(2)}%`;
    }
    return val.toFixed(3);
  }

  return (
    <div className="backtest-tab">
      {/* Strategy toggles */}
      <div className="backtest-controls">
        {strategyKeys.map((key) => (
          <button
            key={key}
            className={`rolling-pill ${visibleStrategies.has(key) ? "active" : ""}`}
            style={visibleStrategies.has(key) ? { background: STRATEGY_COLORS[key], borderColor: STRATEGY_COLORS[key] } : {}}
            onClick={() => toggleStrategy(key)}
          >
            {STRATEGY_LABELS[key]}
          </button>
        ))}
      </div>

      {/* Performance metrics cards */}
      <div className="backtest-metrics-grid">
        {strategyKeys.filter((s) => visibleStrategies.has(s)).map((s) => (
          <div key={s} className="backtest-metric-card" style={{ borderTopColor: STRATEGY_COLORS[s] }}>
            <div className="backtest-metric-card-title" style={{ color: STRATEGY_COLORS[s] }}>
              {STRATEGY_LABELS[s]}
            </div>
            <div className="backtest-metric-card-body">
              {Object.entries(METRIC_LABELS).map(([mk, ml]) => (
                <div key={mk} className="backtest-metric-row">
                  <span className="backtest-metric-label">{ml}</span>
                  <span className={`backtest-metric-value ${mk === "max_drawdown" ? "neg" : mk === "cagr" || mk === "total_return" ? (metrics[s][mk] >= 0 ? "pos" : "neg") : ""}`}>
                    {fmtMetric(mk, metrics[s][mk])}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Cumulative returns chart */}
      <div className="backtest-chart-section">
        <h3 className="portfolio-chart-title">Growth of $1</h3>
        <ResponsiveContainer width="100%" height={340}>
          <LineChart data={cumulData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11 }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => `$${v.toFixed(2)}`}
              domain={["auto", "auto"]}
            />
            <Tooltip
              formatter={(v, name) => [`$${Number(v).toFixed(4)}`, STRATEGY_LABELS[name] || name]}
              labelFormatter={(label) => `Date: ${label}`}
            />
            {strategyKeys
              .filter((s) => visibleStrategies.has(s))
              .map((s) => (
                <Line
                  key={s}
                  type="monotone"
                  dataKey={s}
                  stroke={STRATEGY_COLORS[s]}
                  strokeWidth={2}
                  dot={false}
                  name={s}
                />
              ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Drawdown chart */}
      <div className="backtest-chart-section">
        <h3 className="portfolio-chart-title">Drawdown</h3>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={ddData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11 }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => `${v}%`}
              domain={["auto", 0]}
            />
            <Tooltip
              formatter={(v, name) => [`${Number(v).toFixed(2)}%`, STRATEGY_LABELS[name] || name]}
              labelFormatter={(label) => `Date: ${label}`}
            />
            {strategyKeys
              .filter((s) => visibleStrategies.has(s))
              .map((s) => (
                <Area
                  key={s}
                  type="monotone"
                  dataKey={s}
                  stroke={STRATEGY_COLORS[s]}
                  fill={STRATEGY_COLORS[s]}
                  fillOpacity={0.15}
                  strokeWidth={1.5}
                  dot={false}
                  name={s}
                />
              ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <p className="backtest-disclaimer">
        Fixed-weight backtest with monthly rebalancing. Weights optimized on the full analysis period.
        Past performance does not predict future results.
      </p>
    </div>
  );
}

/* ── Stress Test Tab ───────────────────────────────────────────────────── */

const SCENARIO_COLORS = [
  "#ef4444", "#f59e0b", "#6366f1", "#10b981", "#3b82f6",
];

function StressTestTab({ data }) {
  const { stress } = data;
  const [activeScenario, setActiveScenario] = useState(0);

  if (!stress || !stress.scenarios || stress.scenarios.length === 0) {
    return (
      <p style={{ color: "var(--muted)", textAlign: "center", padding: "2rem" }}>
        No stress test scenarios available.
      </p>
    );
  }

  const { scenarios, factor_names } = stress;
  const scene = scenarios[activeScenario];
  const hasPortfolios = Object.keys(scene.portfolio_impacts || {}).length > 0;

  // Sort stocks by impact for the bar chart
  const stockData = Object.entries(scene.stock_impacts)
    .map(([ticker, impact]) => ({
      ticker,
      impact: +(impact * 100).toFixed(2),
      _color: impact >= 0 ? "#10b981" : "#ef4444",
    }))
    .sort((a, b) => b.impact - a.impact);

  // Factor shocks for display
  const shockData = factor_names.map((f) => ({
    factor: f,
    sigma: scene.shocks[f] || 0,
    abs: scene.abs_shocks[f] || 0,
  }));

  // Portfolio impacts
  const portData = hasPortfolios
    ? Object.entries(scene.portfolio_impacts).map(([name, impact]) => ({
        name: PORTFOLIO_LABELS[name] || name,
        impact: +(impact * 100).toFixed(2),
        key: name,
      }))
    : [];

  return (
    <div className="stress-tab">
      {/* Scenario selector */}
      <div className="stress-scenarios">
        {scenarios.map((s, i) => (
          <button
            key={s.id}
            className={`stress-scenario-btn ${i === activeScenario ? "active" : ""}`}
            style={i === activeScenario ? { borderColor: SCENARIO_COLORS[i % SCENARIO_COLORS.length], background: SCENARIO_COLORS[i % SCENARIO_COLORS.length] + "18" } : {}}
            onClick={() => setActiveScenario(i)}
          >
            <span className="stress-scenario-label">{s.label}</span>
          </button>
        ))}
      </div>

      <p className="stress-description">{scene.description}</p>

      {/* Factor shocks table */}
      <div className="stress-section">
        <h3 className="portfolio-chart-title">Factor Shocks Applied</h3>
        <table className="stress-shocks-table">
          <thead>
            <tr>
              <th>Factor</th>
              <th>Shock (σ)</th>
              <th>Absolute</th>
            </tr>
          </thead>
          <tbody>
            {shockData.map((d) => (
              <tr key={d.factor} className={d.sigma === 0 ? "zero" : ""}>
                <td>{d.factor}</td>
                <td className={d.sigma > 0 ? "pos" : d.sigma < 0 ? "neg" : ""}>
                  {d.sigma > 0 ? "+" : ""}{d.sigma.toFixed(1)}σ
                </td>
                <td className={d.abs > 0 ? "pos" : d.abs < 0 ? "neg" : ""}>
                  {(d.abs * 100).toFixed(2)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Stock impact waterfall */}
      <div className="stress-section">
        <h3 className="portfolio-chart-title">Estimated Stock Impact (monthly)</h3>
        <HBar
          data={stockData}
          valueKey="impact"
          labelKey="ticker"
          formatValue={(v) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`}
          colorKey="_color"
        />
      </div>

      {/* Portfolio-level impacts */}
      {hasPortfolios && (
        <div className="stress-section">
          <h3 className="portfolio-chart-title">Portfolio Impact (monthly)</h3>
          <div className="stress-portfolio-cards">
            {portData.map((p) => (
              <div key={p.key} className="stress-port-card">
                <div className="stress-port-name">{p.name}</div>
                <div className={`stress-port-impact ${p.impact >= 0 ? "pos" : "neg"}`}>
                  {p.impact >= 0 ? "+" : ""}{p.impact.toFixed(2)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="backtest-disclaimer">
        Impacts estimated using factor betas × scenario shocks. Does not account for
        non-linear effects, liquidity, or contagion.
      </p>
    </div>
  );
}

/* ── Rolling Factor Exposures Chart ─────────────────────────────────────── */

function RollingChart({ data }) {
  const { rolling_betas, tickers, factor_names } = data;
  const [selectedTicker, setSelectedTicker] = useState(tickers[0]);

  if (!rolling_betas || Object.keys(rolling_betas).length === 0) {
    return (
      <p style={{ color: "var(--muted)", textAlign: "center", padding: "2rem" }}>
        Not enough data for rolling analysis. Try a longer date range.
      </p>
    );
  }

  const tickerData = rolling_betas[selectedTicker] || [];
  const chartData = tickerData.map((row) => ({
    ...row,
    date: row.date.slice(0, 7), // YYYY-MM
  }));

  return (
    <div>
      <div className="rolling-controls">
        <label className="rolling-label">Ticker</label>
        <div className="rolling-ticker-pills">
          {tickers
            .filter((t) => rolling_betas[t])
            .map((t) => (
              <button
                key={t}
                className={`rolling-pill ${t === selectedTicker ? "active" : ""}`}
                onClick={() => setSelectedTicker(t)}
              >
                {t}
              </button>
            ))}
        </div>
      </div>

      <div className="factor-legend">
        {factor_names.map((f, i) => (
          <FactorInfoPopover key={f} factorKey={f}>
            <span className="factor-legend-item">
              <span
                className="factor-legend-swatch"
                style={{ background: COLORS[i % COLORS.length] }}
              />
              {f}
            </span>
          </FactorInfoPopover>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11 }}
            interval="preserveStartEnd"
          />
          <YAxis />
          <Tooltip
            formatter={(v) => v.toFixed(3)}
            labelFormatter={(label) => `Date: ${label}`}
          />
          {factor_names.map((f, i) => (
            <Line
              key={f}
              type="monotone"
              dataKey={f}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={2}
              dot={false}
              name={f}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function fmt(val) {
  if (val == null) return "—";
  return val.toFixed(4);
}
