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

const COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6"];

const DEFAULT_TICKERS = "AAPL, MSFT, GOOGL, AMZN, JPM";

const WINDOW_OPTIONS = [12, 24, 36, 48, 60];

export default function App() {
  const [tickers, setTickers] = useState(DEFAULT_TICKERS);
  const [start, setStart] = useState("2019-01-01");
  const [end, setEnd] = useState("2024-12-31");
  const [momentum, setMomentum] = useState(true);
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
          include_momentum: momentum,
          rolling_window: rollingWindow,
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
            <button
              type="button"
              className={`option-card ${momentum ? "active" : ""}`}
              onClick={() => setMomentum(!momentum)}
            >
              <span className="option-icon">M</span>
              <span className="option-text">
                <span className="option-title">Momentum Factor</span>
                <span className="option-desc">Add Carhart MOM to regression</span>
              </span>
            </button>

            <div className="option-card active option-card-select">
              <span className="option-icon">R</span>
              <span className="option-text">
                <span className="option-title">Rolling Window</span>
                <span className="option-desc">
                  <select
                    value={rollingWindow}
                    onChange={(e) => setRollingWindow(Number(e.target.value))}
                  >
                    {WINDOW_OPTIONS.map((w) => (
                      <option key={w} value={w}>{w} months</option>
                    ))}
                  </select>
                </span>
              </span>
            </div>

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

            <div className="option-card disabled">
              <span className="option-icon">C</span>
              <span className="option-text">
                <span className="option-title">Correlation Heatmap</span>
                <span className="option-desc">Diversification analysis</span>
              </span>
              <span className="option-badge">Soon</span>
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
            {["summary", "betas", "r_squared", "variance", "rolling"].map((tab) => (
              <button
                key={tab}
                className={activeTab === tab ? "active" : ""}
                onClick={() => setActiveTab(tab)}
              >
                {tab === "summary" && "Summary"}
                {tab === "betas" && "Factor Loadings"}
                {tab === "r_squared" && "R-Squared"}
                {tab === "variance" && "Variance Attribution"}
                {tab === "rolling" && "Rolling Exposures"}
              </button>
            ))}
          </nav>

          <div className="tab-content">
            {activeTab === "summary" && <SummaryTable data={data} />}
            {activeTab === "betas" && <BetasChart data={data} />}
            {activeTab === "r_squared" && <RSquaredChart data={data} />}
            {activeTab === "variance" && <VarianceChart data={data} />}
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
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Ticker</th>
            <th>
              <FactorInfoPopover factorKey="Alpha">
                Alpha (ann.)
              </FactorInfoPopover>
            </th>
            {factor_names.map((f) => (
              <th key={f}>
                <FactorInfoPopover factorKey={f}>Beta {f}</FactorInfoPopover>
              </th>
            ))}
            <th>
              <FactorInfoPopover factorKey="R_squared">R²</FactorInfoPopover>
            </th>
            <th>
              <FactorInfoPopover factorKey="Idio_Vol">
                Idio Vol
              </FactorInfoPopover>
            </th>
          </tr>
        </thead>
        <tbody>
          {tickers.map((t) => {
            const row = summary[t];
            return (
              <tr key={t}>
                <td className="ticker">{t}</td>
                <td className={row.alpha_annualized >= 0 ? "pos" : "neg"}>
                  {fmt(row.alpha_annualized)}
                </td>
                {factor_names.map((f) => (
                  <td key={f}>{fmt(row[`beta_${f}`])}</td>
                ))}
                <td>{fmt(row.R_squared)}</td>
                <td>{fmt(row.idio_vol_annual)}</td>
              </tr>
            );
          })}
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
  const { variance_attr, tickers, factor_names } = data;
  const chartData = tickers.map((t) => {
    const row = { ticker: t };
    factor_names.forEach((f) => {
      row[f] = variance_attr[t][`pct_${f}`] * 100;
    });
    row["Idiosyncratic"] = variance_attr[t].pct_idiosyncratic * 100;
    return row;
  });

  const allKeys = [...factor_names, "Idiosyncratic"];

  return (
    <div>
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
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
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
