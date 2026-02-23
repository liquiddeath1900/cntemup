import { hasDepositLaw } from '../data/stateRules'

// LCD-style zero-padded count display
function padCount(n) {
  return String(n).padStart(3, '0')
}

// Counter — Game Boy LCD style
export function Counter({
  count,
  sessionCount,
  isDetecting,
  depositRate = 0,
  stateCode,
  calculateDeposit,
  rules,
  topDetection,
}) {
  const hasDeposit = stateCode && hasDepositLaw(stateCode)
  const sessionValue = calculateDeposit ? calculateDeposit(sessionCount) : 0

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)

  return (
    <>
      {/* Main LCD count row */}
      <div className="gb-lcd-count">
        <span className="gb-lcd-label">COUNT</span>
        <span className="gb-lcd-value">{padCount(count)}</span>

        {sessionCount !== count && (
          <div className="gb-lcd-session">
            <span className="gb-lcd-session-label">SES</span>
            <span className="gb-lcd-session-value">{padCount(sessionCount)}</span>
          </div>
        )}
      </div>

      {/* Deposit value */}
      {hasDeposit && sessionCount > 0 && (
        <div className="gb-lcd-deposit">
          <span className="gb-lcd-deposit-value">{formatCurrency(sessionValue)}</span>
          <span className="gb-lcd-deposit-label">
            {stateCode} @ {Math.round(depositRate * 100)}¢
          </span>
        </div>
      )}

      {/* State badge */}
      {stateCode && (
        <div className={`state-badge ${hasDeposit ? 'has-deposit' : 'no-deposit'}`}>
          {stateCode}
          {!hasDeposit && <span className="state-badge-note">No deposit law</span>}
        </div>
      )}

      {/* Special rates hint */}
      {rules?.special_rates && (
        <div className="counter-special-hint">Special rates — see Settings</div>
      )}

      {/* Scanning indicator */}
      {isDetecting && (
        <div className="gb-detecting">
          <span className="gb-pulse" />
          SCANNING
        </div>
      )}

      {/* Detection confidence badge */}
      {topDetection && (
        <div className="gb-detection-badge">
          <span className="gb-badge-dot" />
          {Math.round(topDetection.score * 100)}% {topDetection.displayClass || topDetection.class}
        </div>
      )}
    </>
  )
}
