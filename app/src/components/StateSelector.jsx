import { US_STATES, DEPOSIT_STATES } from '../data/stateRules'

// State dropdown with deposit-law indicators
export function StateSelector({ value, onChange, label = 'Your State' }) {
  return (
    <div className="state-selector">
      <label className="state-selector-label">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="state-selector-select"
      >
        <option value="" disabled>Select your state</option>
        {US_STATES.map(state => (
          <option key={state.code} value={state.code}>
            {state.name} {DEPOSIT_STATES.has(state.code) ? '(Deposit)' : ''}
          </option>
        ))}
      </select>
      {value && !DEPOSIT_STATES.has(value) && (
        <p className="state-no-deposit">
          Your state doesn't have a bottle deposit law.
        </p>
      )}
    </div>
  )
}
