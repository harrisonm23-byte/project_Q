import React from "react";

/* ── Hedge strategy knowledge base ──────────────────────────────────────── */

const HEDGE_KB = {
  "Mkt-RF": {
    name: "Market Risk Premium",
    positive: {
      exposure: "Long market beta — your stock rises and falls with the broad market.",
      instruments: [
        { name: "SPY / SPX put options", desc: "Direct downside protection against market drops" },
        { name: "Short SPY futures (ES)", desc: "Offset dollar-for-dollar market exposure" },
        { name: "SH (ProShares Short S&P)", desc: "Inverse ETF for a simpler, no-margin hedge" },
      ],
      sizing: "Scale hedge notional by: position_size × beta × hedge_ratio",
    },
    negative: {
      exposure: "Negative market beta — unusual. Stock moves opposite to the market, providing natural diversification.",
      instruments: [
        { name: "Long SPY / SPX call options", desc: "Protect against a rally if you need symmetric coverage" },
        { name: "Long SPY futures (ES)", desc: "Offset the inverse relationship" },
      ],
      sizing: "Negative beta acts as a built-in hedge. Additional hedging may increase total portfolio risk.",
    },
  },
  SMB: {
    name: "Size Factor (Small Minus Big)",
    positive: {
      exposure: "Behaves like a small-cap stock — more volatile, with small-cap risk premium embedded.",
      instruments: [
        { name: "Short IWM (Russell 2000)", desc: "Directly hedge small-cap factor exposure" },
        { name: "Long IWB or SPY", desc: "Tilt toward large-cap to offset size risk" },
        { name: "IWM put options", desc: "Asymmetric protection against small-cap underperformance" },
      ],
      sizing: "Scale by: position_size × SMB_beta × (IWM_SMB_loading)⁻¹",
    },
    negative: {
      exposure: "Behaves like a large-cap stock — the size premium works against this position when small-caps rally.",
      instruments: [
        { name: "Long IWM (Russell 2000)", desc: "Add small-cap exposure to neutralize the negative loading" },
        { name: "Short IWB / SPY", desc: "Reduce the large-cap tilt" },
      ],
      sizing: "Negative SMB beta is typical for mega-caps. Hedging is only needed if you want size-neutral exposure.",
    },
  },
  HML: {
    name: "Value Factor (High Minus Low)",
    positive: {
      exposure: "Value-stock behavior — returns co-move with cheap, high book-to-market companies.",
      instruments: [
        { name: "Short IWD (iShares Value ETF)", desc: "Directly offset value factor exposure" },
        { name: "Long IWF (iShares Growth ETF)", desc: "Growth tilt to neutralize value loading" },
        { name: "IWD/IWF pair trade", desc: "Short value, long growth in a ratio matching the beta" },
      ],
      sizing: "For banks/financials with high HML: hedge ratio ≈ beta_HML × position_value / ETF_HML_loading",
    },
    negative: {
      exposure: "Growth-stock behavior — returns co-move with expensive, high-growth companies.",
      instruments: [
        { name: "Short IWF (iShares Growth ETF)", desc: "Offset the growth tilt" },
        { name: "Long IWD (iShares Value ETF)", desc: "Add value exposure to neutralize growth loading" },
        { name: "VLUE (MSCI Value Factor ETF)", desc: "Direct value factor exposure as a hedge overlay" },
      ],
      sizing: "For tech/growth with negative HML: hedge if value rotation risk is a concern for your horizon",
    },
  },
  Mom: {
    name: "Momentum Factor",
    positive: {
      exposure: "Momentum-following stock — tends to continue its recent trend. Vulnerable to momentum crashes.",
      instruments: [
        { name: "MTUM put options", desc: "Protect against momentum crash events" },
        { name: "Short MTUM (iShares Momentum ETF)", desc: "Direct momentum factor hedge" },
        { name: "Straddles on the stock", desc: "Protect against sharp reversals in either direction" },
      ],
      sizing: "Momentum crashes are rare but severe. Consider tail-risk hedges (puts) rather than full neutralization.",
    },
    negative: {
      exposure: "Contrarian / mean-reverting behavior — the stock tends to reverse recent trends.",
      instruments: [
        { name: "Long MTUM (iShares Momentum ETF)", desc: "Offset the contrarian tendency" },
        { name: "Reduce position during trend extremes", desc: "Tactical sizing when momentum is running strongly" },
      ],
      sizing: "Negative momentum beta can be beneficial in momentum-crash scenarios. Hedging removes this natural protection.",
    },
  },
};

/* ── Threshold logic ────────────────────────────────────────────────────── */

function getUrgency(pctVariance) {
  if (pctVariance < 3) return { level: "negligible", label: "Negligible", color: "var(--muted)" };
  if (pctVariance < 8) return { level: "minimal", label: "Minimal", color: "var(--text)" };
  if (pctVariance < 18) return { level: "moderate", label: "Moderate", color: "#f59e0b" };
  if (pctVariance < 30) return { level: "significant", label: "Significant", color: "#f97316" };
  return { level: "dominant", label: "Dominant", color: "#ef4444" };
}

function getUrgencyMessage(urgency, factorName) {
  switch (urgency.level) {
    case "negligible":
      return `${factorName} contributes negligibly to this stock's variance. Hedging is not warranted — the cost would exceed the risk reduction.`;
    case "minimal":
      return `${factorName} is a minor risk contributor. Hedging is generally unnecessary unless you are running a highly concentrated position.`;
    case "moderate":
      return `${factorName} is a meaningful risk source. Consider hedging if this factor exposure is unintended or if your portfolio is concentrated.`;
    case "significant":
      return `${factorName} is a significant driver of this stock's risk. Hedging is recommended if you want to isolate alpha from factor exposure.`;
    case "dominant":
      return `${factorName} dominates this stock's risk profile. Active hedging is strongly recommended to manage this concentration.`;
    default:
      return "";
  }
}

/* ── Single-factor hedge panel ──────────────────────────────────────────── */

function FactorHedgePanel({ ticker, factor, beta, pctVariance, onClose, onShowSummary }) {
  const kb = HEDGE_KB[factor];
  if (!kb) return null;

  const direction = beta >= 0 ? "positive" : "negative";
  const strategy = kb[direction];
  const urgency = getUrgency(pctVariance);
  const showInstruments = urgency.level !== "negligible";

  return (
    <div className="hedge-panel">
      <div className="hedge-panel-header">
        <div className="hedge-panel-title">
          <span className="hedge-panel-ticker">{ticker}</span>
          <span className="hedge-panel-dot">·</span>
          <span className="hedge-panel-factor">{kb.name}</span>
        </div>
        <div className="hedge-panel-actions">
          <button className="hedge-summary-btn" onClick={onShowSummary} title="View combined hedge strategy">
            Summary
          </button>
          <button className="hedge-close-btn" onClick={onClose}>&times;</button>
        </div>
      </div>

      <div className="hedge-panel-body">
        {/* Stats row */}
        <div className="hedge-stats">
          <div className="hedge-stat">
            <span className="hedge-stat-label">Factor Beta</span>
            <span className={`hedge-stat-value ${beta >= 0 ? "pos" : "neg"}`}>
              {beta >= 0 ? "+" : ""}{beta.toFixed(3)}
            </span>
          </div>
          <div className="hedge-stat">
            <span className="hedge-stat-label">Variance Contribution</span>
            <span className="hedge-stat-value">{pctVariance.toFixed(1)}%</span>
          </div>
          <div className="hedge-stat">
            <span className="hedge-stat-label">Hedge Urgency</span>
            <span className="hedge-stat-value" style={{ color: urgency.color }}>
              {urgency.label}
            </span>
          </div>
        </div>

        {/* Exposure description */}
        <div className="hedge-section">
          <h4>Exposure</h4>
          <p>{strategy.exposure}</p>
        </div>

        {/* Urgency assessment */}
        <div className="hedge-section">
          <h4>Assessment</h4>
          <p>{getUrgencyMessage(urgency, factor)}</p>
        </div>

        {/* Instruments */}
        {showInstruments && (
          <div className="hedge-section">
            <h4>Hedging Instruments</h4>
            <div className="hedge-instruments">
              {strategy.instruments.map((inst, i) => (
                <div key={i} className="hedge-instrument">
                  <span className="hedge-instrument-name">{inst.name}</span>
                  <span className="hedge-instrument-desc">{inst.desc}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sizing note */}
        {showInstruments && (
          <div className="hedge-section">
            <h4>Sizing Guidance</h4>
            <p className="hedge-sizing">{strategy.sizing}</p>
          </div>
        )}
      </div>
    </div>
  );
}

const FACTOR_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6"];

/* ── Summary hedge for all factors combined ─────────────────────────────── */

function SummaryHedgePanel({ ticker, betas, varianceAttr, factorNames, colors, onClose }) {
  const [activeFactor, setActiveFactor] = React.useState(null);

  const factorColors = colors || FACTOR_COLORS;

  // Build per-factor data sorted by variance contribution
  const factors = factorNames
    .map((f) => ({
      name: f,
      beta: betas[ticker]?.[f] ?? 0,
      pctVariance: (varianceAttr[ticker]?.[`pct_${f}`] ?? 0) * 100,
    }))
    .sort((a, b) => b.pctVariance - a.pctVariance);

  const materialFactors = factors.filter((f) => f.pctVariance >= 3);
  const pctIdio = (varianceAttr[ticker]?.pct_idiosyncratic ?? 0) * 100;
  const pctSystematic = (varianceAttr[ticker]?.pct_systematic ?? 0) * 100;

  return (
    <div className="hedge-panel hedge-panel-summary">
      <div className="hedge-panel-header">
        {activeFactor && (
          <button
            className="hedge-summary-btn"
            onClick={() => setActiveFactor(null)}
          >
            ← Summary
          </button>
        )}
        <div className="hedge-panel-title">
          <span className="hedge-panel-ticker">{ticker}</span>
          <span className="hedge-panel-dot">·</span>
          <span className="hedge-panel-factor">
            {activeFactor ? activeFactor : "Combined Hedge Strategy"}
          </span>
          {!activeFactor && (
            <div className="hedge-factor-pills">
              {factorNames.map((f, i) => (
                <button
                  key={f}
                  className="hedge-factor-pill"
                  onClick={() => setActiveFactor(f)}
                >
                  <span
                    className="hedge-factor-pill-swatch"
                    style={{ background: factorColors[i % factorColors.length] }}
                  />
                  {f}
                </button>
              ))}
            </div>
          )}
        </div>
        <button className="hedge-close-btn" onClick={onClose}>&times;</button>
      </div>

      {activeFactor ? (
        /* ── Factor detail view ── */
        <FactorDetailBody
          ticker={ticker}
          factor={activeFactor}
          beta={betas[ticker]?.[activeFactor] ?? 0}
          pctVariance={(varianceAttr[ticker]?.[`pct_${activeFactor}`] ?? 0) * 100}
        />
      ) : (
        /* ── Full summary view ── */
        <div className="hedge-panel-body">
          <div className="hedge-section">
            <h4>Risk Profile</h4>
            <p>
              {pctSystematic.toFixed(0)}% of {ticker}'s variance is systematic (factor-driven)
              and {pctIdio.toFixed(0)}% is idiosyncratic (stock-specific).
              {pctIdio > 50
                ? " Most risk is stock-specific and cannot be hedged with factor instruments — only diversification helps."
                : " Factor hedging can meaningfully reduce this stock's risk."}
            </p>
          </div>

          <div className="hedge-section">
            <h4>Factor Priorities</h4>
            <div className="hedge-factor-list">
              {factors.map((f) => {
                const urgency = getUrgency(f.pctVariance);
                const kb = HEDGE_KB[f.name];
                const direction = f.beta >= 0 ? "positive" : "negative";
                const topInstrument = kb?.[direction]?.instruments[0];
                return (
                  <div key={f.name} className="hedge-factor-row">
                    <div className="hedge-factor-row-header">
                      <span className="hedge-factor-name">{f.name}</span>
                      <span className="hedge-factor-pct">{f.pctVariance.toFixed(1)}%</span>
                      <span className="hedge-factor-urgency" style={{ color: urgency.color }}>
                        {urgency.label}
                      </span>
                    </div>
                    <div className="hedge-factor-row-detail">
                      <span className={`hedge-factor-beta ${f.beta >= 0 ? "pos" : "neg"}`}>
                        beta: {f.beta >= 0 ? "+" : ""}{f.beta.toFixed(3)}
                      </span>
                      {f.pctVariance >= 3 && topInstrument && (
                        <span className="hedge-factor-rec">→ {topInstrument.name}</span>
                      )}
                      {f.pctVariance < 3 && (
                        <span className="hedge-factor-skip">No hedge needed</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {materialFactors.length > 0 ? (
            <div className="hedge-section">
              <h4>Combined Recommendation</h4>
              <p>{buildCombinedRec(ticker, materialFactors, pctIdio)}</p>
            </div>
          ) : (
            <div className="hedge-section">
              <h4>Combined Recommendation</h4>
              <p>
                No individual factor contributes materially to {ticker}'s variance.
                The risk is primarily idiosyncratic — diversification across multiple
                stocks is the most effective risk management approach.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Inline factor detail body (reused inside SummaryHedgePanel) ─────────── */

function FactorDetailBody({ ticker, factor, beta, pctVariance }) {
  const kb = HEDGE_KB[factor];
  if (!kb) return null;

  const direction = beta >= 0 ? "positive" : "negative";
  const strategy = kb[direction];
  const urgency = getUrgency(pctVariance);
  const showInstruments = urgency.level !== "negligible";

  return (
    <div className="hedge-panel-body">
      <div className="hedge-stats">
        <div className="hedge-stat">
          <span className="hedge-stat-label">Factor Beta</span>
          <span className={`hedge-stat-value ${beta >= 0 ? "pos" : "neg"}`}>
            {beta >= 0 ? "+" : ""}{beta.toFixed(3)}
          </span>
        </div>
        <div className="hedge-stat">
          <span className="hedge-stat-label">Variance Contribution</span>
          <span className="hedge-stat-value">{pctVariance.toFixed(1)}%</span>
        </div>
        <div className="hedge-stat">
          <span className="hedge-stat-label">Hedge Urgency</span>
          <span className="hedge-stat-value" style={{ color: urgency.color }}>
            {urgency.label}
          </span>
        </div>
      </div>

      <div className="hedge-section">
        <h4>Exposure</h4>
        <p>{strategy.exposure}</p>
      </div>

      <div className="hedge-section">
        <h4>Assessment</h4>
        <p>{getUrgencyMessage(urgency, factor)}</p>
      </div>

      {showInstruments && (
        <div className="hedge-section">
          <h4>Hedging Instruments</h4>
          <div className="hedge-instruments">
            {strategy.instruments.map((inst, i) => (
              <div key={i} className="hedge-instrument">
                <span className="hedge-instrument-name">{inst.name}</span>
                <span className="hedge-instrument-desc">{inst.desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showInstruments && (
        <div className="hedge-section">
          <h4>Sizing Guidance</h4>
          <p className="hedge-sizing">{strategy.sizing}</p>
        </div>
      )}
    </div>
  );
}

function buildCombinedRec(ticker, materialFactors, pctIdio) {
  const dominant = materialFactors[0];
  const parts = [];

  if (materialFactors.length === 1) {
    parts.push(
      `${ticker}'s factor risk is concentrated in ${dominant.name} (${dominant.pctVariance.toFixed(0)}% of variance). ` +
      `Focus your hedge on this single factor.`
    );
  } else {
    const names = materialFactors.map((f) => `${f.name} (${f.pctVariance.toFixed(0)}%)`).join(", ");
    parts.push(
      `${ticker} has material exposure to ${materialFactors.length} factors: ${names}. ` +
      `Prioritize hedging ${dominant.name} first, as it's the largest risk contributor.`
    );
  }

  if (pctIdio > 40) {
    parts.push(
      ` Note: ${pctIdio.toFixed(0)}% of risk is idiosyncratic and won't be reduced by factor hedges. ` +
      `Consider position sizing and diversification for the remaining risk.`
    );
  }

  // Check for natural offsets
  const hasPositiveMkt = materialFactors.find((f) => f.name === "Mkt-RF" && f.beta > 0);
  const hasNegativeSmb = materialFactors.find((f) => f.name === "SMB" && f.beta < 0);
  if (hasPositiveMkt && hasNegativeSmb) {
    parts.push(
      ` The combination of positive market beta and negative size beta is typical of large-cap stocks — ` +
      `a broad market hedge (short SPY) partially covers both exposures.`
    );
  }

  return parts.join("");
}

export { FactorHedgePanel, SummaryHedgePanel };
