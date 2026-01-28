// Counter display component
export function Counter({ count, sessionCount, isDetecting }) {
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

      {isDetecting && (
        <div className="detecting-indicator">
          <span className="pulse"></span>
          Scanning...
        </div>
      )}
    </div>
  )
}
