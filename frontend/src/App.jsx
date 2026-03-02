import React, { useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { FactorInfoPopover } from "./FactorInfo";
import { FactorHedgePanel, SummaryHedgePanel } from "./HedgePanel";

const COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6"];

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

            <div className="option-card disabled">
              <span className="option-icon">P</span>
              <span className="option-text">
                <span className="option-title">Portfolio Construction</span>
                <span className="option-desc">Mean-variance optimization</span>
              </span>
              <span className="option-badge">Soon</span>
            </div>

            <div className="option-card disabled">
              <span className="option-icon">B</span>
              <span className="option-text">
                <span className="option-title">Backtesting</span>
                <span className="option-desc">Historical performance</span>
              </span>
              <span className="option-badge">Soon</span>
            </div>

            <div className="option-card active">
              <span className="option-icon">C</span>
              <span className="option-text">
                <span className="option-title">Correlation Heatmap</span>
                <span className="option-desc">Diversification analysis</span>
              </span>
            </div>

            <div className="option-card disabled">
              <span className="option-icon">S</span>
              <span className="option-text">
                <span className="option-title">Stress Testing</span>
                <span className="option-desc">Factor shock scenarios</span>
              </span>
              <span className="option-badge">Soon</span>
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
              ...(data.rolling_betas ? ["rolling"] : [])
            ].map((tab) => (
              <button
                key={tab}
                className={activeTab === tab ? "active" : ""}
                onClick={() => setActiveTab(tab)}
              >
                {tab === "summary" && "Summary"}
                {tab === "betas" && "Factor Loadings"}
                {tab === "r_squared" && "R-Squared"}
                {tab === "variance" && "Variance"}
                {tab === "correlation" && "Correlation"}
                {tab === "rolling" && "Rolling"}
              </button>
            ))}
          </nav>

          <div className="tab-content">
            {activeTab === "summary" && <SummaryTable data={data} />}
            {activeTab === "betas" && <BetasChart data={data} />}
            {activeTab === "r_squared" && <RSquaredChart data={data} />}
            {activeTab === "variance" && <VarianceChart data={data} />}
            {activeTab === "correlation" && <CorrelationHeatmap data={data} />}
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
    .sort((a, b) => a.R2 - b.R2);

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={chartData} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" domain={[0, 1]} />
        <YAxis dataKey="ticker" type="category" width={60} />
        <Tooltip formatter={(v) => v.toFixed(4)} />
        <Bar dataKey="R2" name="R²">
          {chartData.map((_, i) => (
            <Cell key={i} fill={COLORS[0]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
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
