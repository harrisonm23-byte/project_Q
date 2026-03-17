import React, { useState, useCallback, useMemo } from "react";
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
import { SummaryHedgePanel } from "./HedgePanel";

const COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6"];

const DEFAULT_TICKERS = "AAPL, MSFT, GOOGL, AMZN, JPM";

const WINDOW_OPTIONS = [12, 24, 36, 48, 60];

export default function App() {
  const [tickers, setTickers] = useState(DEFAULT_TICKERS);
  const [start, setStart] = useState("2019-01-01");
  const [end, setEnd] = useState("2025-12-31");
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
              ...(data.rolling_betas ? ["rolling"] : []),
              ...(data.alpha_analysis ? ["alpha"] : []),
              ...(data.regime ? ["regime"] : []),
              ...(data.pairs ? ["pairs"] : []),
              ...(data.sandbox ? ["sandbox"] : []),
            ].map((tab) => {
              const tabLabel = {
                summary: "Summary", betas: "Factor Loadings", r_squared: "R-Squared",
                variance: "Variance", correlation: "Correlation", portfolio: "Portfolio",
                backtest: "Backtest", stress: "Stress Test", rolling: "Rolling",
                alpha: "Alpha", regime: "Regimes", pairs: "Pairs", sandbox: "Sandbox",
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
            {activeTab === "alpha" && <AlphaTab data={data} />}
            {activeTab === "regime" && <RegimeTab data={data} />}
            {activeTab === "pairs" && <PairsTab data={data} />}
            {activeTab === "sandbox" && <SandboxTab data={data} />}
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

const HBAR_PALETTE = ["#7c8574", "#c4965a", "#6b8cae", "#b8764e", "#8e7cc3"];

function RSquaredChart({ data }) {
  const { r_squared, tickers } = data;
  const [hovered, setHovered] = useState(null);
  const sorted = tickers
    .map((t) => ({ ticker: t, R2: r_squared[t].R_squared }))
    .sort((a, b) => b.R2 - a.R2);

  const axisTicks = [0, 0.2, 0.4, 0.6, 0.8, 1.0];

  return (
    <div className="hbar-chart-wrap">
      <div className="hbar-list">
        {sorted.map(({ ticker, R2 }, i) => (
          <div
            key={ticker}
            className="hbar-row"
            onMouseEnter={() => setHovered(ticker)}
            onMouseLeave={() => setHovered(null)}
          >
            <div className="hbar-track">
              <div
                className="hbar-fill"
                style={{ width: `${R2 * 100}%`, background: HBAR_PALETTE[i % HBAR_PALETTE.length] }}
              >
                <span className="hbar-label">{ticker}</span>
              </div>
              {hovered === ticker && (
                <span className="hbar-tooltip">{R2.toFixed(4)}</span>
              )}
            </div>
            <div className="hbar-value">{R2.toFixed(4)}</div>
          </div>
        ))}
      </div>
      <div className="hbar-axis">
        {axisTicks.map((t) => (
          <div key={t} className="hbar-axis-tick" style={{ left: `${t * 100}%` }}>
            <div className="hbar-axis-line" />
            <span className="hbar-axis-label">{t.toFixed(1)}</span>
          </div>
        ))}
      </div>
    </div>
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
    if (!entry) return;
    const ticker = entry.ticker;
    if (hedgeSelection?.ticker === ticker) {
      setHedgeSelection(null);
    } else {
      setHedgeSelection({ ticker, summary: true });
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
        <span className="variance-click-hint">Click any stock bar to see its hedge strategy</span>
      </div>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={chartData} barCategoryGap="25%" barSize={72}>
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
      {hedgeSelection?.summary && (
        <SummaryHedgePanel
          ticker={hedgeSelection.ticker}
          betas={betas}
          varianceAttr={variance_attr}
          factorNames={factor_names}
          colors={COLORS}
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
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={weightsData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={(v) => `${v}%`} domain={[0, "auto"]} />
              <YAxis dataKey="ticker" type="category" width={55} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(v) => `${v.toFixed(2)}%`}
                contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "6px" }}
                itemStyle={{ color: "var(--text)" }}
                labelStyle={{ color: "var(--muted)", fontSize: "0.75rem" }}
              />
              <Bar dataKey="weight" name="Weight" radius={[0, 4, 4, 0]}>
                {weightsData.map((_, i) => (
                  <Cell key={i} fill={PORTFOLIO_COLORS[selected]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

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
    .map(([ticker, impact]) => ({ ticker, impact: +(impact * 100).toFixed(2) }))
    .sort((a, b) => a.impact - b.impact);

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
        <ResponsiveContainer width="100%" height={Math.max(220, stockData.length * 36)}>
          <BarChart data={stockData} layout="vertical" margin={{ left: 50, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => `${v}%`}
            />
            <YAxis
              type="category"
              dataKey="ticker"
              tick={{ fontSize: 12, fontWeight: 600 }}
              width={50}
            />
            <Tooltip
              formatter={(v) => [`${Number(v).toFixed(2)}%`, "Impact"]}
              contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "6px" }}
              itemStyle={{ color: "var(--text)" }}
              labelStyle={{ color: "var(--muted)", fontSize: "0.75rem" }}
            />
            <Bar dataKey="impact" radius={[0, 4, 4, 0]}>
              {stockData.map((d, i) => (
                <Cell key={i} fill={d.impact >= 0 ? "#10b981" : "#ef4444"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
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

/* ── Alpha Significance Tab ────────────────────────────────────────────── */

function AlphaTab({ data }) {
  const { alpha_analysis, tickers } = data;
  if (!alpha_analysis) {
    return (
      <p style={{ color: "var(--muted)", textAlign: "center", padding: "2rem" }}>
        No alpha analysis available.
      </p>
    );
  }

  const sorted = [...tickers]
    .filter((t) => alpha_analysis[t])
    .sort((a, b) => Math.abs(alpha_analysis[b].alpha_annual) - Math.abs(alpha_analysis[a].alpha_annual));

  return (
    <div className="alpha-tab">
      <p className="alpha-intro">
        Is there actually edge here, or is it all factor exposure? Alpha represents
        returns not explained by market, size, value, and momentum factors.
      </p>

      <div className="alpha-cards">
        {sorted.map((ticker) => {
          const a = alpha_analysis[ticker];
          const sig = a.significant;
          return (
            <div key={ticker} className={`alpha-card ${sig ? "alpha-card-sig" : ""}`}>
              <div className="alpha-card-header">
                <span className="alpha-card-ticker">{ticker}</span>
                <span className={`alpha-card-badge ${sig ? "alpha-badge-sig" : "alpha-badge-insig"}`}>
                  {sig ? "Significant" : "Not Significant"}
                </span>
              </div>

              <div className="alpha-card-stats">
                <div className="alpha-stat">
                  <span className="alpha-stat-label">Annualized Alpha</span>
                  <span className={`alpha-stat-value ${a.alpha_annual >= 0 ? "pos" : "neg"}`}>
                    {(a.alpha_annual * 100).toFixed(2)}%
                  </span>
                </div>
                <div className="alpha-stat">
                  <span className="alpha-stat-label">t-Statistic</span>
                  <span className="alpha-stat-value">{a.t_stat.toFixed(2)}</span>
                </div>
                <div className="alpha-stat">
                  <span className="alpha-stat-label">p-Value</span>
                  <span className={`alpha-stat-value ${a.p_value < 0.05 ? "pos" : ""}`}>
                    {a.p_value < 0.001 ? "<0.001" : a.p_value.toFixed(3)}
                  </span>
                </div>
                <div className="alpha-stat">
                  <span className="alpha-stat-label">95% CI (ann.)</span>
                  <span className="alpha-stat-value" style={{ fontSize: "0.78rem" }}>
                    [{(a.ci_lower * 100).toFixed(1)}%, {(a.ci_upper * 100).toFixed(1)}%]
                  </span>
                </div>
              </div>

              <div className="alpha-card-breakdown">
                <div className="alpha-bar-row">
                  <span className="alpha-bar-label">Factor Return</span>
                  <div className="alpha-bar-track">
                    <div
                      className="alpha-bar-fill alpha-bar-factor"
                      style={{ width: `${Math.min(Math.abs(a.factor_return_annual) / (Math.abs(a.factor_return_annual) + Math.abs(a.alpha_annual) + 0.001) * 100, 100)}%` }}
                    />
                  </div>
                  <span className={a.factor_return_annual >= 0 ? "pos" : "neg"}>
                    {(a.factor_return_annual * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="alpha-bar-row">
                  <span className="alpha-bar-label">Alpha</span>
                  <div className="alpha-bar-track">
                    <div
                      className={`alpha-bar-fill ${sig ? "alpha-bar-sig" : "alpha-bar-insig"}`}
                      style={{ width: `${Math.min(Math.abs(a.alpha_annual) / (Math.abs(a.factor_return_annual) + Math.abs(a.alpha_annual) + 0.001) * 100, 100)}%` }}
                    />
                  </div>
                  <span className={a.alpha_annual >= 0 ? "pos" : "neg"}>
                    {(a.alpha_annual * 100).toFixed(1)}%
                  </span>
                </div>
              </div>

              <div className="alpha-card-r2">
                R² = {(a.r_squared * 100).toFixed(1)}% of variance explained by factors
              </div>

              <p className="alpha-card-verdict">{a.verdict}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Regime Analysis Tab ──────────────────────────────────────────────── */

const REGIME_COLORS = { bull: "#10b981", recovery: "#f59e0b", bear: "#ef4444" };
const REGIME_LABELS = { bull: "Bull", recovery: "Recovery", bear: "Bear" };

function RegimeTab({ data }) {
  const { regime } = data;
  const [selectedTicker, setSelectedTicker] = useState(null);

  if (!regime || regime.error) {
    return (
      <p style={{ color: "var(--muted)", textAlign: "center", padding: "2rem" }}>
        {regime?.error || "No regime analysis available."}
      </p>
    );
  }

  const { regimes, regime_stats, ticker_regimes, full_period, factor_names, tickers } = regime;
  const activeTicker = selectedTicker || tickers[0];

  // Build timeline chart data
  const timelineData = regimes.map((r) => ({
    date: r.date.slice(0, 7),
    value: r.regime === "bull" ? 1 : r.regime === "recovery" ? 0 : -1,
    regime: r.regime,
  }));

  // Build comparison data for selected ticker
  const tickerData = ticker_regimes[activeTicker] || {};
  const fullData = full_period[activeTicker] || {};

  return (
    <div className="regime-tab">
      <p className="alpha-intro">
        How do factor loadings shift across market environments? The same stock can
        behave very differently in bull markets vs. drawdowns.
      </p>

      {/* Regime overview stats */}
      <div className="regime-overview">
        {["bull", "recovery", "bear"].map((r) => {
          const s = regime_stats[r];
          if (!s) return null;
          return (
            <div key={r} className="regime-stat-card" style={{ borderTopColor: REGIME_COLORS[r] }}>
              <div className="regime-stat-title" style={{ color: REGIME_COLORS[r] }}>
                {REGIME_LABELS[r]}
              </div>
              <div className="regime-stat-body">
                <div className="backtest-metric-row">
                  <span className="backtest-metric-label">Months</span>
                  <span className="backtest-metric-value">{s.count}</span>
                </div>
                <div className="backtest-metric-row">
                  <span className="backtest-metric-label">% of Period</span>
                  <span className="backtest-metric-value">{(s.pct * 100).toFixed(0)}%</span>
                </div>
                <div className="backtest-metric-row">
                  <span className="backtest-metric-label">Avg Mkt Return (ann.)</span>
                  <span className={`backtest-metric-value ${s.avg_market_return >= 0 ? "pos" : "neg"}`}>
                    {(s.avg_market_return * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Regime timeline */}
      <div className="regime-timeline-section">
        <h3 className="portfolio-chart-title">Market Regime Timeline</h3>
        <ResponsiveContainer width="100%" height={80}>
          <BarChart data={timelineData} barCategoryGap={0} barGap={0}>
            <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
            <Tooltip
              formatter={(v, name, props) => [REGIME_LABELS[props.payload.regime], "Regime"]}
              labelFormatter={(label) => `Date: ${label}`}
              contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "6px" }}
              itemStyle={{ color: "var(--text)" }}
              labelStyle={{ color: "var(--muted)", fontSize: "0.75rem" }}
            />
            <Bar dataKey="value" radius={0}>
              {timelineData.map((d, i) => (
                <Cell key={i} fill={REGIME_COLORS[d.regime]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Ticker selector */}
      <div className="rolling-controls">
        <label className="rolling-label">Ticker</label>
        <div className="rolling-ticker-pills">
          {tickers.map((t) => (
            <button
              key={t}
              className={`rolling-pill ${t === activeTicker ? "active" : ""}`}
              onClick={() => setSelectedTicker(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Factor loadings comparison table */}
      <div className="regime-comparison">
        <h3 className="portfolio-chart-title">{activeTicker} — Factor Loadings by Regime</h3>
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              <th>Full Period</th>
              {["bull", "recovery", "bear"].map((r) =>
                tickerData[r] ? (
                  <th key={r} style={{ color: REGIME_COLORS[r] }}>
                    {REGIME_LABELS[r]} ({tickerData[r].n_months}mo)
                  </th>
                ) : null
              )}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="row-label">Alpha (ann.)</td>
              <td className={fullData.alpha_annual >= 0 ? "pos" : "neg"}>
                {(fullData.alpha_annual * 100).toFixed(2)}%
              </td>
              {["bull", "recovery", "bear"].map((r) =>
                tickerData[r] ? (
                  <td key={r} className={tickerData[r].alpha_annual >= 0 ? "pos" : "neg"}>
                    {(tickerData[r].alpha_annual * 100).toFixed(2)}%
                  </td>
                ) : null
              )}
            </tr>
            {factor_names.map((f) => (
              <tr key={f}>
                <td className="row-label">Beta {f}</td>
                <td>{fullData.betas?.[f]?.toFixed(3) ?? "—"}</td>
                {["bull", "recovery", "bear"].map((r) =>
                  tickerData[r] ? (
                    <td key={r}>{tickerData[r].betas[f]?.toFixed(3) ?? "—"}</td>
                  ) : null
                )}
              </tr>
            ))}
            <tr>
              <td className="row-label">R²</td>
              <td>{fullData.r_squared?.toFixed(3) ?? "—"}</td>
              {["bull", "recovery", "bear"].map((r) =>
                tickerData[r] ? (
                  <td key={r}>{tickerData[r].r_squared?.toFixed(3) ?? "—"}</td>
                ) : null
              )}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Beta shift chart */}
      {factor_names.length > 0 && (
        <div className="regime-beta-chart">
          <h3 className="portfolio-chart-title">{activeTicker} — Beta Shift Across Regimes</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={factor_names.map((f) => {
                const row = { factor: f };
                if (fullData.betas) row["Full Period"] = fullData.betas[f] || 0;
                ["bull", "recovery", "bear"].forEach((r) => {
                  if (tickerData[r]) row[REGIME_LABELS[r]] = tickerData[r].betas[f] || 0;
                });
                return row;
              })}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="factor" />
              <YAxis />
              <Tooltip formatter={(v) => v.toFixed(3)} />
              <Bar dataKey="Full Period" fill="var(--muted)" />
              {["bull", "recovery", "bear"].map((r) =>
                tickerData[r] ? (
                  <Bar key={r} dataKey={REGIME_LABELS[r]} fill={REGIME_COLORS[r]} />
                ) : null
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

/* ── Pairs / Spread Decomposition Tab ─────────────────────────────────── */

const EDGE_COLORS = { alpha: "#10b981", factor_bet: "#f59e0b", neutral: "#64748b" };
const EDGE_LABELS = { alpha: "Alpha Edge", factor_bet: "Factor Bet", neutral: "Neutral" };

function PairsTab({ data }) {
  const { pairs } = data;

  if (!pairs || !pairs.pairs || pairs.pairs.length === 0) {
    return (
      <p style={{ color: "var(--muted)", textAlign: "center", padding: "2rem" }}>
        Pair analysis requires at least 2 stocks.
      </p>
    );
  }

  const { pairs: pairList, factor_names } = pairs;
  const [expandedPair, setExpandedPair] = useState(null);

  return (
    <div className="pairs-tab">
      <p className="alpha-intro">
        Long/short pair analysis: decompose each pair into factor exposure vs. genuine alpha.
        Sorted by absolute spread Sharpe ratio.
      </p>

      <div className="pairs-list">
        {pairList.map((p, idx) => {
          const key = `${p.long}-${p.short}`;
          const expanded = expandedPair === key;
          return (
            <div key={key} className="pair-card">
              <div
                className="pair-card-header"
                onClick={() => setExpandedPair(expanded ? null : key)}
                style={{ cursor: "pointer" }}
              >
                <div className="pair-card-top">
                  <div className="pair-card-names">
                    <span className="pair-long">Long</span>
                    <span>{p.long}</span>
                    <span className="pair-separator">/</span>
                    <span className="pair-short">Short</span>
                    <span>{p.short}</span>
                  </div>
                  <span className="pair-sharpe">
                    Sharpe <span className={p.spread_sharpe >= 0 ? "pos" : "neg"}>{p.spread_sharpe.toFixed(2)}</span>
                  </span>
                </div>
                <div className="pair-card-sub">
                  <span
                    className="pair-edge-badge"
                    style={{ background: EDGE_COLORS[p.edge_type] + "22", color: EDGE_COLORS[p.edge_type], borderColor: EDGE_COLORS[p.edge_type] }}
                  >
                    {EDGE_LABELS[p.edge_type]}
                  </span>
                </div>
              </div>

              <div className="pair-card-stats">
                <div className="alpha-stat">
                  <span className="alpha-stat-label">Spread Alpha</span>
                  <span className={`alpha-stat-value ${p.spread_alpha_annual >= 0 ? "pos" : "neg"}`}>
                    {(p.spread_alpha_annual * 100).toFixed(2)}%
                  </span>
                </div>
                <div className="alpha-stat">
                  <span className="alpha-stat-label">Spread Vol</span>
                  <span className="alpha-stat-value">
                    {(p.spread_vol_annual * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="alpha-stat">
                  <span className="alpha-stat-label">Residual Corr</span>
                  <span className="alpha-stat-value">
                    {p.residual_correlation.toFixed(3)}
                  </span>
                </div>
              </div>

              {expanded && (
                <div className="pair-card-detail">
                  <p className="pair-edge-desc">{p.edge_description}</p>

                  <h4 className="portfolio-chart-title" style={{ marginTop: "0.75rem" }}>
                    Spread Factor Betas (Long {p.long} − Short {p.short})
                  </h4>
                  <div className="pair-betas">
                    {factor_names.map((f, i) => (
                      <div key={f} className="pair-beta-row">
                        <span className="pair-beta-factor">
                          <span
                            className="factor-legend-swatch"
                            style={{ background: COLORS[i % COLORS.length] }}
                          />
                          {f}
                        </span>
                        <div className="pair-beta-bar-wrap">
                          <div
                            className="pair-beta-bar"
                            style={{
                              width: `${Math.min(Math.abs(p.spread_betas[f]) * 50, 100)}%`,
                              marginLeft: p.spread_betas[f] < 0 ? "auto" : undefined,
                              marginRight: p.spread_betas[f] >= 0 ? "auto" : undefined,
                              background: p.spread_betas[f] >= 0 ? "var(--green)" : "var(--red)",
                            }}
                          />
                        </div>
                        <span className={p.spread_betas[f] >= 0 ? "pos" : "neg"} style={{ minWidth: 50, textAlign: "right" }}>
                          {p.spread_betas[f] >= 0 ? "+" : ""}{p.spread_betas[f].toFixed(3)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Factor Sandbox Tab ────────────────────────────────────────────────── */

function computeSandboxReturns(factorReturns, factorNames, residuals, betas, alphaMonthly) {
  const n = residuals.length;
  const returns = [];
  for (let t = 0; t < n; t++) {
    let r = alphaMonthly;
    for (const f of factorNames) {
      r += (betas[f] || 0) * (factorReturns[f]?.[t] || 0);
    }
    r += residuals[t] || 0;
    returns.push(r);
  }
  return returns;
}

function cumulativeFromReturns(returns) {
  const cum = [1];
  for (let i = 0; i < returns.length; i++) {
    cum.push(cum[cum.length - 1] * (1 + returns[i]));
  }
  return cum;
}

const PORTFOLIO_KEY = "__portfolio__";

function HoldButton({ onStep, className, children }) {
  const timerRef = React.useRef(null);
  const onStepRef = React.useRef(onStep);
  React.useEffect(() => { onStepRef.current = onStep; }, [onStep]);

  const stop = React.useCallback(() => {
    clearTimeout(timerRef.current);
    clearInterval(timerRef.current);
  }, []);

  const start = React.useCallback(() => {
    onStepRef.current();
    timerRef.current = setTimeout(() => {
      timerRef.current = setInterval(() => onStepRef.current(), 60);
    }, 350);
  }, []);

  return (
    <button
      className={className}
      onMouseDown={start}
      onMouseUp={stop}
      onMouseLeave={stop}
      onTouchStart={(e) => { e.preventDefault(); start(); }}
      onTouchEnd={stop}
    >
      {children}
    </button>
  );
}

function StepperInput({ value, onChange, format, parse, className }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState("");

  const handleFocus = () => {
    setRaw(String(parse ? parse(value, "toRaw") : value));
    setEditing(true);
  };

  const commit = () => {
    const num = parseFloat(raw);
    if (!isNaN(num)) onChange(parse ? parse(num, "fromRaw") : num);
    setEditing(false);
  };

  return (
    <input
      className={`sandbox-beta-input ${className || ""}`}
      value={editing ? raw : format(value)}
      onFocus={handleFocus}
      onChange={(e) => setRaw(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") { e.target.blur(); } else if (e.key === "Escape") { setEditing(false); } }}
    />
  );
}

function buildPortfolioInfo(tickersData, factor_names, effectiveWeights) {
  const tickerKeys = Object.keys(tickersData);
  if (tickerKeys.length === 0) return { betas: {}, residuals: [], alpha_monthly: 0 };
  const avgBetas = {};
  for (const f of factor_names) {
    avgBetas[f] = tickerKeys.reduce((sum, t) => sum + (effectiveWeights[t] || 0) * (tickersData[t]?.betas?.[f] || 0), 0);
  }
  const resLen = tickersData[tickerKeys[0]]?.residuals?.length || 0;
  const avgResiduals = Array.from({ length: resLen }, (_, i) =>
    tickerKeys.reduce((sum, t) => sum + (effectiveWeights[t] || 0) * (tickersData[t]?.residuals?.[i] || 0), 0)
  );
  const avgAlpha = tickerKeys.reduce((sum, t) => sum + (effectiveWeights[t] || 0) * (tickersData[t]?.alpha_monthly || 0), 0);
  return { betas: avgBetas, residuals: avgResiduals, alpha_monthly: avgAlpha };
}

function normalizeWeights(rawWeights) {
  const total = Object.values(rawWeights).reduce((s, v) => s + Math.max(0, v), 0);
  if (total === 0) return Object.fromEntries(Object.keys(rawWeights).map(k => [k, 0]));
  return Object.fromEntries(Object.entries(rawWeights).map(([k, v]) => [k, Math.max(0, v) / total]));
}

function SandboxTab({ data }) {
  const { sandbox, factor_names, r_squared, tickers: allTickers } = data;

  // Match the same color assignment as the R-Squared HBar chart (sorted by R² desc)
  const tickerColorMap = useMemo(() => {
    if (!r_squared || !allTickers) return {};
    const sorted = [...allTickers].sort((a, b) => (r_squared[b]?.R_squared || 0) - (r_squared[a]?.R_squared || 0));
    return Object.fromEntries(sorted.map((t, i) => [t, HBAR_PALETTE[i % HBAR_PALETTE.length]]));
  }, [r_squared, allTickers]);
  const [selectedTicker, setSelectedTicker] = useState(PORTFOLIO_KEY);
  const [betas, setBetas] = useState(null);
  const [alpha, setAlpha] = useState(0);
  const [snapshotDeltas, setSnapshotDeltas] = useState(null);
  const [showSpy, setShowSpy] = useState(true);

  const tickers = useMemo(() => sandbox ? Object.keys(sandbox.tickers) : [], [sandbox]);

  const initWeights = useMemo(
    () => Object.fromEntries(tickers.map(t => [t, 1])),
    [tickers]
  );
  const [weights, setWeights] = useState(() => Object.fromEntries(tickers.map(t => [t, 1])));
  const effectiveWeights = useMemo(() => normalizeWeights(weights), [weights]);

  if (!sandbox) {
    return (
      <p style={{ color: "var(--muted)", textAlign: "center", padding: "2rem" }}>
        Sandbox data not available.
      </p>
    );
  }

  const activeTicker = selectedTicker || PORTFOLIO_KEY;
  const isPortfolio = activeTicker === PORTFOLIO_KEY;

  const tickerInfo = useMemo(() =>
    isPortfolio
      ? buildPortfolioInfo(sandbox.tickers, factor_names, effectiveWeights)
      : sandbox.tickers[activeTicker],
    [isPortfolio, sandbox.tickers, factor_names, effectiveWeights, activeTicker]
  );

  const defaultBetas = tickerInfo?.betas || {};
  const activeBetas = betas ? betas : defaultBetas;

  const setActiveBetas = useCallback((newBetas) => {
    setBetas(newBetas);
    setSnapshotDeltas(null);
  }, []);

  const handleTickerChange = useCallback((t) => {
    setSelectedTicker(t);
    setBetas(null);
    setAlpha(0);
    setSnapshotDeltas(null);
  }, []);

  const updateBeta = useCallback((factor, value) => {
    setActiveBetas({ ...activeBetas, [factor]: value });
  }, [activeBetas, setActiveBetas]);

  const updateWeight = useCallback((ticker, value) => {
    setWeights(prev => ({ ...prev, [ticker]: Math.max(0, value) }));
    setBetas(null);
    setSnapshotDeltas(null);
  }, []);

  const resetAll = () => {
    setBetas(null);
    setAlpha(0);
    setSnapshotDeltas(null);
    if (isPortfolio) setWeights(initWeights);
  };

  const handleSnapshot = () => {
    const deltas = {};
    for (const f of factor_names) {
      const delta = (activeBetas[f] || 0) - (defaultBetas[f] || 0);
      if (Math.abs(delta) > 0.001) deltas[f] = delta;
    }
    if (alpha !== 0) deltas.alpha = alpha;
    setSnapshotDeltas(deltas);
  };

  const step = 0.05;
  const wStep = 0.05;

  const spyCum = useMemo(() => {
    const raw = sandbox.spy_returns || [];
    if (raw.every(v => v === 0)) return null;
    return cumulativeFromReturns(raw);
  }, [sandbox.spy_returns]);

  const originalReturns = useMemo(() =>
    computeSandboxReturns(sandbox.factor_returns, factor_names, tickerInfo?.residuals || [], defaultBetas, tickerInfo?.alpha_monthly || 0),
    [sandbox, factor_names, tickerInfo, defaultBetas]
  );
  const originalCum = useMemo(() => cumulativeFromReturns(originalReturns), [originalReturns]);

  const sandboxReturns = useMemo(() =>
    computeSandboxReturns(sandbox.factor_returns, factor_names, tickerInfo?.residuals || [], activeBetas, (tickerInfo?.alpha_monthly || 0) + alpha / 12),
    [sandbox, factor_names, tickerInfo, activeBetas, alpha]
  );
  const sandboxCum = useMemo(() => cumulativeFromReturns(sandboxReturns), [sandboxReturns]);

  const isModified = JSON.stringify(activeBetas) !== JSON.stringify(defaultBetas) || alpha !== 0 ||
    (isPortfolio && JSON.stringify(weights) !== JSON.stringify(initWeights));

  const chartW = 680, chartH = 260;
  const marginL = 50, marginR = 16, marginT = 16, marginB = 30;
  const plotW = chartW - marginL - marginR;
  const plotH = chartH - marginT - marginB;

  const allValues = [...originalCum, ...sandboxCum, ...(showSpy && spyCum ? spyCum : [])];
  const yMinRaw = Math.min(...allValues);
  const yMaxRaw = Math.max(...allValues);
  const yRange = yMaxRaw - yMinRaw || 0.1;
  const yMin = yMinRaw - yRange * 0.1;
  const yMax = yMaxRaw + yRange * 0.1;

  const toX = (i) => marginL + (i / (originalCum.length - 1)) * plotW;
  const toY = (v) => marginT + (1 - (v - yMin) / (yMax - yMin)) * plotH;

  const pathFromData = (vals) =>
    vals.map((v, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(" ");

  const originalPath = pathFromData(originalCum);
  const sandboxPath = pathFromData(sandboxCum);
  const spyPath = spyCum ? pathFromData(spyCum) : null;

  const yTicks = [];
  for (let i = 0; i <= 5; i++) yTicks.push(yMin + (i / 5) * (yMax - yMin));

  const dates = sandbox.dates || [];
  const xLabels = [];
  for (let i = 0; i < dates.length; i += 12) {
    xLabels.push({ idx: i + 1, label: dates[i]?.slice(0, 7) || "" });
  }

  return (
    <div className="sandbox-tab">
      {/* Ticker selector */}
      <div className="rolling-controls">
        <label className="rolling-label">View</label>
        <div className="rolling-ticker-pills">
          <button
            className={`rolling-pill ${activeTicker === PORTFOLIO_KEY ? "active" : ""}`}
            onClick={() => handleTickerChange(PORTFOLIO_KEY)}
          >
            Portfolio
          </button>
          {tickers.map((t) => (
            <button
              key={t}
              className={`rolling-pill ${t === activeTicker ? "active" : ""}`}
              onClick={() => handleTickerChange(t)}
            >
              {t}
            </button>
          ))}
        </div>
        {isModified && (
          <button className="sandbox-reset-btn" onClick={resetAll}>
            Reset All
          </button>
        )}
      </div>

      {/* SVG Chart */}
      <div className="sandbox-chart-wrap">
        {isModified && (
          <div className="sandbox-modified-badge">Modified</div>
        )}
        <svg width="100%" viewBox={`0 0 ${chartW} ${chartH}`} className="sandbox-svg">
          {yTicks.map((val, i) => (
            <g key={i}>
              <line x1={marginL} y1={toY(val)} x2={chartW - marginR} y2={toY(val)}
                stroke="var(--border)" strokeWidth={0.5} strokeDasharray="3,3" />
              <text x={marginL - 8} y={toY(val) + 3} fill="var(--muted)" fontSize={9}
                fontFamily="monospace" textAnchor="end">
                {((val - 1) * 100).toFixed(0)}%
              </text>
            </g>
          ))}
          {xLabels.map(({ idx, label }) => (
            <text key={idx} x={toX(idx)} y={chartH - 4} fill="var(--muted)" fontSize={9}
              fontFamily="monospace" textAnchor="middle">
              {label}
            </text>
          ))}
          {/* S&P 500 benchmark */}
          {showSpy && spyPath && (
            <>
              <path d={spyPath} fill="none" stroke="#6b7280" strokeWidth={1.2}
                strokeDasharray="5,3" opacity={0.65} />
              <text x={toX(spyCum.length - 1) + 4} y={toY(spyCum[spyCum.length - 1]) + 4}
                fill="#6b7280" fontSize={9} fontFamily="monospace" opacity={0.8}>
                S&P {((spyCum[spyCum.length - 1] - 1) * 100).toFixed(1)}%
              </text>
            </>
          )}
          {/* Original (ghost when modified) */}
          {isModified && (
            <path d={originalPath} fill="none" stroke="var(--muted)" strokeWidth={1.2}
              strokeDasharray="4,4" opacity={0.4} />
          )}
          {/* Main / sandbox line */}
          <path d={sandboxPath} fill="none"
            stroke={isModified ? "var(--accent)" : "var(--muted)"}
            strokeWidth={2} />
          <text x={toX(sandboxCum.length - 1) + 4} y={toY(sandboxCum[sandboxCum.length - 1]) - 6}
            fill={isModified ? "var(--accent)" : "var(--muted)"} fontSize={10}
            fontFamily="monospace" fontWeight={600}>
            {((sandboxCum[sandboxCum.length - 1] - 1) * 100).toFixed(1)}%
          </text>
          {isModified && (
            <text x={toX(originalCum.length - 1) + 4} y={toY(originalCum[originalCum.length - 1]) + 12}
              fill="var(--muted)" fontSize={9} fontFamily="monospace">
              {((originalCum[originalCum.length - 1] - 1) * 100).toFixed(1)}% (original)
            </text>
          )}
        </svg>
        <div className="sandbox-chart-legend">
          {isModified && (
            <>
              <span className="sandbox-legend-item">
                <span className="sandbox-legend-line sandbox-legend-dashed" /> Original
              </span>
              <span className="sandbox-legend-item sandbox-legend-modified">
                <span className="sandbox-legend-line sandbox-legend-solid" /> Modified
              </span>
            </>
          )}
          {spyPath && (
            <button
              className={`sandbox-spy-toggle ${showSpy ? "active" : ""}`}
              onClick={() => setShowSpy(s => !s)}
            >
              <span className="sandbox-legend-line sandbox-legend-spy" />
              S&P 500
            </button>
          )}
        </div>
      </div>

      {/* Factor Exposures */}
      <div className="sandbox-controls-header">
        <span className="sandbox-controls-title">Factor Exposures</span>
      </div>

      <div className="sandbox-steppers">
        {factor_names.map((f, i) => {
          const val = activeBetas[f] || 0;
          const def = defaultBetas[f] || 0;
          const isZero = val === 0;
          return (
            <div key={f} className={`sandbox-stepper ${isZero ? "sandbox-stepper-zero" : ""}`}>
              <div className="sandbox-stepper-label">
                <span className="factor-legend-swatch" style={{ background: COLORS[i % COLORS.length] }} />
                <span>{f}</span>
              </div>
              <div className="sandbox-stepper-controls">
                <HoldButton className="sandbox-step-btn" onStep={() => updateBeta(f, Math.round((val - step) * 1000) / 1000)}>-</HoldButton>
                <StepperInput
                  value={val}
                  onChange={(v) => updateBeta(f, Math.round(v * 1000) / 1000)}
                  format={(v) => `${v >= 0 ? "+" : ""}${v.toFixed(3)}`}
                  className={val === 0 ? "" : val > 0 ? "pos" : "neg"}
                />
                <HoldButton className="sandbox-step-btn" onStep={() => updateBeta(f, Math.round((val + step) * 1000) / 1000)}>+</HoldButton>
                <button className={`sandbox-zero-btn ${val === 0 ? "active" : ""}`} onClick={() => updateBeta(f, 0)}>0</button>
                <button className="sandbox-reset-one-btn" onClick={() => updateBeta(f, def)} title="Reset to regression estimate">RST</button>
              </div>
            </div>
          );
        })}

        {/* Alpha control */}
        <div className={`sandbox-stepper ${alpha !== 0 ? "sandbox-stepper-alpha" : ""}`}>
          <div className="sandbox-stepper-label">
            <span className="factor-legend-swatch" style={{ background: "#8b5cf6" }} />
            <span>Alpha (ann.)</span>
          </div>
          <div className="sandbox-stepper-controls">
            <HoldButton className="sandbox-step-btn" onStep={() => setAlpha(Math.round((alpha - 0.01) * 1000) / 1000)}>-</HoldButton>
            <StepperInput
              value={alpha}
              onChange={(v) => setAlpha(Math.round(v / 100 * 1000) / 1000)}
              format={(v) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`}
              parse={(v, dir) => dir === "toRaw" ? +(v * 100).toFixed(3) : v}
              className={alpha === 0 ? "" : "sandbox-alpha-val"}
            />
            <HoldButton className="sandbox-step-btn" onStep={() => setAlpha(Math.round((alpha + 0.01) * 1000) / 1000)}>+</HoldButton>
            <button className={`sandbox-zero-btn ${alpha === 0 ? "active" : ""}`} onClick={() => setAlpha(0)}>0</button>
          </div>
        </div>
      </div>

      {/* Portfolio weights (portfolio mode only) */}
      {isPortfolio && (
        <>
          <div className="sandbox-controls-header" style={{ marginTop: "1rem" }}>
            <span className="sandbox-controls-title">Portfolio Weights</span>
            <span className="sandbox-controls-hint">Adjusting weights updates factor betas proportionally</span>
          </div>
          <div className="sandbox-steppers">
            {tickers.map((t, i) => {
              const raw = weights[t] ?? 1;
              const pct = (effectiveWeights[t] || 0) * 100;
              return (
                <div key={t} className="sandbox-stepper">
                  <div className="sandbox-stepper-label">
                    <span className="factor-legend-swatch" style={{ background: tickerColorMap[t] || HBAR_PALETTE[i % HBAR_PALETTE.length] }} />
                    <span>{t}</span>
                    <span className="sandbox-weight-pct">{pct.toFixed(1)}%</span>
                  </div>
                  <div className="sandbox-stepper-controls">
                    <HoldButton className="sandbox-step-btn" onStep={() => updateWeight(t, Math.round((raw - wStep) * 1000) / 1000)}>-</HoldButton>
                    <StepperInput
                      value={raw}
                      onChange={(v) => updateWeight(t, Math.max(0, Math.round(v * 1000) / 1000))}
                      format={(v) => v.toFixed(2)}
                      className=""
                    />
                    <HoldButton className="sandbox-step-btn" onStep={() => updateWeight(t, Math.round((raw + wStep) * 1000) / 1000)}>+</HoldButton>
                    <button
                      className={`sandbox-zero-btn ${raw === 0 ? "active" : ""}`}
                      onClick={() => updateWeight(t, 0)}
                    >0</button>
                    <button
                      className="sandbox-reset-one-btn"
                      onClick={() => updateWeight(t, 1)}
                      title="Reset to equal weight"
                    >EQL</button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Snapshot */}
      {isModified && (
        <button
          className={`sandbox-snapshot-btn ${snapshotDeltas ? "sandbox-snapshot-taken" : ""}`}
          onClick={handleSnapshot}
          disabled={!!snapshotDeltas}
        >
          {snapshotDeltas ? "Snapshot Captured" : "Take Snapshot — View Deltas"}
        </button>
      )}

      {/* Delta display */}
      {snapshotDeltas && (
        <div className="sandbox-deltas">
          <span className="sandbox-deltas-title">Exposure Deltas</span>
          <div className="sandbox-deltas-grid">
            {Object.entries(snapshotDeltas).map(([key, val]) => (
              <div key={key} className="sandbox-delta-chip">
                <span className="sandbox-delta-label">{key === "alpha" ? "Alpha" : key}</span>
                <span className={`sandbox-delta-value ${val > 0 ? "pos" : "neg"}`}>
                  {val > 0 ? "+" : ""}{key === "alpha" ? (val * 100).toFixed(1) + "%" : val.toFixed(3)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="backtest-disclaimer">
        What-if analysis using actual factor returns and regression residuals.
        Adjust betas or portfolio weights to explore counterfactual return scenarios.
      </p>
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function fmt(val) {
  if (val == null) return "—";
  return val.toFixed(4);
}
