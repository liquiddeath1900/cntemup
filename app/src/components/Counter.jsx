import { hasDepositLaw } from '../data/stateRules'

// Counter display with deposit value
export function Counter({
  count,
  sessionCount,
  isDetecting,
  depositRate = 0,
  stateCode,
  calculateDeposit,
  rules,
}) {
  const hasDeposit = stateCode && hasDepositLaw(stateCode)
  const sessionValue = calculateDeposit ? calculateDeposit(sessionCount) : 0

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)

  return (
    <div className="counter-container">
      <div className="counter-main">
        <span className="counter-label">Current Count</span>
        <span className="counter-value">{count}</span>
      </div>

      <div className="counter-session">
        <span className="counter-label">Session Total</span>
        <span className="counter-session-value">{sessionCount}</span>
      </div>

      {/* Deposit value display */}
      {hasDeposit && sessionCount > 0 && (
        <div className="counter-deposit">
          <span className="counter-deposit-value">
            {formatCurrency(sessionValue)}
          </span>
          <span className="counter-deposit-label">
            {stateCode} @ {Math.round(depositRate * 100)}¢ each
          </span>
        </div>
      )}

      {/* State badge */}
      {stateCode && (
        <div className={`state-badge ${hasDeposit ? 'has-deposit' : 'no-deposit'}`}>
          {stateCode}
          {!hasDeposit && (
            <span className="state-badge-note">No deposit law</span>
          )}
        </div>
      )}

      {/* Special rates hint */}
      {rules?.special_rates && (
        <div className="counter-special-hint">
          Special rates available — see Settings
        </div>
      )}

      {isDetecting && (
        <div className="detecting-indicator">
          <span className="pulse"></span>
          Scanning...
        </div>
      )}
    </div>
  )
}
