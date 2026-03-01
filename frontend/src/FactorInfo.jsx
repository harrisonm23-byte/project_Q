import React, { useState, useRef, useEffect, useCallback } from "react";
import ReactDOM from "react-dom";

const FACTOR_DATA = {
  "Mkt-RF": {
    name: "Market Risk Premium",
    short: "Mkt-RF",
    meaning:
      "The excess return of the broad stock market over the risk-free rate. It captures how much of a stock's movement is explained by overall market direction.",
    implications:
      "A beta > 1 means the stock amplifies market moves (more volatile). A beta < 1 means it's more defensive. A beta near 0 means the stock is largely uncorrelated with the market.",
    formula: "Mkt-RF = R_market - R_f",
    formulaDesc:
      "Where R_market is the total market return and R_f is the risk-free rate (typically 1-month T-bill).",
  },
  SMB: {
    name: "Size Factor (Small Minus Big)",
    short: "SMB",
    meaning:
      "Measures the return difference between small-cap and large-cap stocks. Historically, smaller companies have earned higher returns to compensate for greater risk.",
    implications:
      "A positive SMB beta means the stock behaves more like small-cap stocks. A negative beta means it tracks with large-cap behavior. Useful for understanding size-related risk exposure.",
    formula: "SMB = R_small - R_big",
    formulaDesc:
      "Constructed by sorting stocks into size groups and taking the average return of small portfolios minus the average return of large portfolios.",
  },
  HML: {
    name: "Value Factor (High Minus Low)",
    short: "HML",
    meaning:
      "Measures the return difference between value stocks (high book-to-market ratio) and growth stocks (low book-to-market). Captures the historical value premium.",
    implications:
      "A positive HML beta indicates the stock behaves like a value stock. A negative beta means growth-like behavior. Helps distinguish whether returns come from value exposure.",
    formula: "HML = R_value - R_growth",
    formulaDesc:
      "Constructed by sorting stocks on book-to-market equity ratio. Returns of high B/M portfolios minus low B/M portfolios.",
  },
  Mom: {
    name: "Momentum Factor",
    short: "Mom",
    meaning:
      "Measures the tendency of stocks that have performed well recently to continue performing well, and vice versa. Based on the past 12-month return (skipping the most recent month).",
    implications:
      "A positive Mom beta means the stock tends to follow momentum trends. A negative beta suggests contrarian or mean-reverting behavior. Momentum is one of the most robust anomalies in finance.",
    formula: "Mom = R_winners - R_losers",
    formulaDesc:
      "Constructed from portfolios sorted on prior 2-12 month returns. Winners portfolio return minus losers portfolio return.",
  },
  Alpha: {
    name: "Jensen's Alpha (Annualized)",
    short: "Alpha",
    meaning:
      "The portion of a stock's return that cannot be explained by its exposure to the risk factors. Represents the stock's abnormal or excess performance.",
    implications:
      "A positive alpha suggests the stock outperformed what the factor model would predict. A negative alpha means underperformance. Statistically significant alpha may indicate skill or mispricing.",
    formula: "alpha = R_i - R_f - (beta_1 * F_1 + beta_2 * F_2 + ...)",
    formulaDesc:
      "The intercept from the time-series regression, annualized by multiplying the monthly alpha by 12.",
  },
  R_squared: {
    name: "R-Squared (Coefficient of Determination)",
    short: "R\u00B2",
    meaning:
      "The fraction of total return variance explained by the factor model. Ranges from 0 to 1.",
    implications:
      "A high R\u00B2 (e.g., > 0.7) means the factors explain most of the stock's movement. A low R\u00B2 means the stock has significant idiosyncratic risk not captured by the model.",
    formula: "R\u00B2 = 1 - (SS_residual / SS_total)",
    formulaDesc:
      "Where SS_residual is the sum of squared regression residuals and SS_total is the total sum of squares of excess returns.",
  },
  Idio_Vol: {
    name: "Idiosyncratic Volatility (Annualized)",
    short: "Idio Vol",
    meaning:
      "The annualized standard deviation of the regression residuals. Represents the stock-specific risk that is not explained by the common factors.",
    implications:
      "Higher idiosyncratic volatility means more company-specific risk. This risk can be diversified away in a portfolio. Stocks with very high idio vol may have significant event or earnings risk.",
    formula: "Idio Vol = std(residuals) \u00D7 \u221A12",
    formulaDesc:
      "Monthly residual standard deviation scaled to annual by multiplying by the square root of 12.",
  },
};

function getFactorInfo(key) {
  return FACTOR_DATA[key] || null;
}

function FactorInfoPopover({ factorKey, children }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const popoverRef = useRef(null);
  const triggerRef = useRef(null);
  const info = getFactorInfo(factorKey);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popoverWidth = 340;
    let left = rect.left + rect.width / 2 - popoverWidth / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - popoverWidth - 12));
    const spaceBelow = window.innerHeight - rect.bottom;
    let top;
    if (spaceBelow > 380) {
      top = rect.bottom + 8 + window.scrollY;
    } else {
      top = rect.top - 8 + window.scrollY;
    }
    setPosition({ top, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();

    function handleClickOutside(e) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }

    function handleEscape(e) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, updatePosition]);

  if (!info) return <>{children}</>;

  const popoverContent = open
    ? ReactDOM.createPortal(
        <div
          ref={popoverRef}
          className="factor-popover"
          style={{
            position: "absolute",
            top: `${position.top}px`,
            left: `${position.left}px`,
          }}
        >
          <div className="factor-popover-header">
            <span className="factor-popover-badge">{info.short}</span>
            <h3>{info.name}</h3>
            <button
              className="factor-popover-close"
              onClick={() => setOpen(false)}
            >
              &times;
            </button>
          </div>
          <div className="factor-popover-body">
            <div className="factor-popover-section">
              <h4>What it measures</h4>
              <p>{info.meaning}</p>
            </div>
            <div className="factor-popover-section">
              <h4>Implications</h4>
              <p>{info.implications}</p>
            </div>
            {info.formula && (
              <div className="factor-popover-section">
                <h4>Formula</h4>
                <code className="factor-formula">{info.formula}</code>
                <p className="factor-formula-desc">{info.formulaDesc}</p>
              </div>
            )}
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <span className="factor-info-wrap">
      <span
        ref={triggerRef}
        className="factor-info-trigger"
        onClick={() => setOpen(!open)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && setOpen(!open)}
      >
        {children}
        <span className="factor-info-icon">i</span>
      </span>
      {popoverContent}
    </span>
  );
}

export { FactorInfoPopover, getFactorInfo, FACTOR_DATA };
