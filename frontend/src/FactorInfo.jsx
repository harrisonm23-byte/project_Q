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
  Max_Sharpe: {
    name: "Maximum Sharpe Ratio Portfolio",
    short: "Max Sharpe",
    meaning:
      "The portfolio on the efficient frontier that offers the highest risk-adjusted return. It maximizes the ratio of excess return (above the risk-free rate) per unit of volatility.",
    implications:
      "This is the theoretically optimal risky portfolio for an investor who can also invest in the risk-free asset. It often concentrates in a few assets with high expected returns and low correlations.",
  },
  Min_Variance: {
    name: "Minimum Variance Portfolio",
    short: "Min Var",
    meaning:
      "The portfolio with the lowest possible volatility, regardless of expected return. It sits at the leftmost point on the efficient frontier.",
    implications:
      "Useful for risk-averse investors. It tends to overweight low-volatility, low-correlation assets. It doesn't consider expected returns, so it may sacrifice upside for stability.",
  },
  Equal_Weight: {
    name: "Equal Weight Portfolio",
    short: "1/N",
    meaning:
      "A simple portfolio that allocates the same percentage to every stock. No optimization is used \u2014 each asset gets a weight of 1/N where N is the number of stocks.",
    implications:
      "A robust benchmark that often outperforms optimized portfolios out-of-sample due to its simplicity and lack of estimation error. It provides maximum diversification across the number of holdings.",
  },
  Expected_Return: {
    name: "Expected Return (Annualized)",
    short: "E[R]",
    meaning:
      "The portfolio's projected annual return based on historical average returns of the constituent stocks, weighted by their portfolio allocation.",
    implications:
      "Higher expected return generally comes with higher risk. This is an estimate based on past data and may not predict future performance.",
    formula: "E[R_p] = \u03A3 w_i \u00D7 E[R_i]",
    formulaDesc:
      "The weighted sum of each asset's expected return.",
  },
  Volatility: {
    name: "Portfolio Volatility (Annualized)",
    short: "\u03C3",
    meaning:
      "The standard deviation of the portfolio's returns, annualized. It measures total risk \u2014 how much the portfolio's value is expected to fluctuate.",
    implications:
      "Lower volatility means more stable returns. Diversification across low-correlation assets reduces portfolio volatility below the weighted average of individual volatilities.",
    formula: "\u03C3_p = \u221A(w\u1D40 \u03A3 w)",
    formulaDesc:
      "Where w is the weight vector and \u03A3 is the covariance matrix of asset returns.",
  },
  Sharpe_Ratio: {
    name: "Sharpe Ratio",
    short: "SR",
    meaning:
      "The ratio of a portfolio's excess return (above the risk-free rate) to its volatility. It measures how much return you earn per unit of risk taken.",
    implications:
      "A higher Sharpe ratio means better risk-adjusted performance. Generally, SR > 1 is good, SR > 2 is very good. Negative Sharpe means the portfolio underperforms the risk-free rate.",
    formula: "SR = (E[R_p] - R_f) / \u03C3_p",
    formulaDesc:
      "Excess return divided by portfolio standard deviation.",
  },
  Risk_Free_Rate: {
    name: "Risk-Free Rate",
    short: "R_f",
    meaning:
      "The return on a theoretically riskless investment, typically approximated by the yield on short-term U.S. Treasury bills (1-month T-bill).",
    implications:
      "It serves as the baseline for measuring excess returns. All factor premia and portfolio performance are measured relative to this rate.",
  },
  Efficient_Frontier: {
    name: "Efficient Frontier",
    short: "EF",
    meaning:
      "The set of portfolios that offer the highest expected return for each level of risk. It forms a curve in risk-return space, and any portfolio below the curve is suboptimal.",
    implications:
      "Portfolios on the frontier dominate all others \u2014 you cannot get more return without taking more risk. The curve is derived from mean-variance optimization using historical data.",
  },
  Variance_Attribution: {
    name: "Variance Attribution",
    short: "Var Attr",
    meaning:
      "Decomposes a stock's total return variance into the portion explained by each factor and the remaining idiosyncratic (stock-specific) variance.",
    implications:
      "Shows which factors are the biggest drivers of a stock's risk. Helps identify whether risk comes from market exposure, size, value, momentum, or company-specific events.",
  },
  Correlation: {
    name: "Correlation Matrix",
    short: "Corr",
    meaning:
      "Measures the linear relationship between pairs of stock returns on a scale from -1 to +1. Shows how closely stocks move together.",
    implications:
      "Correlations near +1 mean stocks move in lockstep (less diversification benefit). Near 0 means independence. Near -1 means they move oppositely (strong diversification).",
  },
  Rolling_Exposures: {
    name: "Rolling Factor Exposures",
    short: "Rolling",
    meaning:
      "Factor betas estimated over a moving window of time (e.g., 36 months). Shows how a stock's sensitivity to each factor changes over time.",
    implications:
      "Useful for detecting regime changes \u2014 for example, a tech stock that started behaving more like a value stock. Helps assess whether current factor exposures differ from the full-period average.",
  },
  Stress_Test: {
    name: "Factor Shock Stress Testing",
    short: "Stress",
    meaning:
      "Simulates the impact of extreme factor movements on each stock. Predefined scenarios (e.g., market crash, value rotation) apply shocks to factor returns and estimate portfolio losses.",
    implications:
      "Helps identify which stocks are most vulnerable to specific market regimes. Useful for tail-risk management and understanding worst-case exposures.",
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
      <span ref={triggerRef} className="factor-info-trigger">
        {children}
        <span
          className="factor-info-icon"
          onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && (e.stopPropagation(), setOpen(!open))}
        >i</span>
      </span>
      {popoverContent}
    </span>
  );
}

export { FactorInfoPopover, getFactorInfo, FACTOR_DATA };
