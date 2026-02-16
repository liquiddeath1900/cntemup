import { useAuth } from '../hooks/useAuth'
import { useDepositRules } from '../hooks/useDepositRules'
import { StateSelector } from './StateSelector'
import { supabaseEnabled } from '../lib/supabase'

// Settings page — change state, view rules, sign out
export function Settings() {
  const { user, profile, signOut, isLocal } = useAuth()
  const { rules, depositRate, hasDeposit } = useDepositRules(profile?.state_code)

  const { updateState } = useAuth()

  return (
    <div className="app">
      <header className="header">
        <div className="header-row">
          <a href="/" className="back-link">Back</a>
          <h1>Settings</h1>
          <span></span>
        </div>
      </header>

      <main className="main">
        {/* Profile */}
        <div className="settings-card">
          <h3>Profile</h3>
          <p className="settings-name">{profile?.display_name || 'Counter'}</p>
          {!isLocal && <p className="settings-email">{user?.email}</p>}
          {isLocal && (
            <p className="settings-mode">Local mode — data stored on this device</p>
          )}
        </div>

        {/* State selection */}
        <div className="settings-card">
          <h3>Deposit State</h3>
          <StateSelector
            value={profile?.state_code || ''}
            onChange={updateState}
            label="Change your state"
          />
        </div>

        {/* Rules display */}
        {hasDeposit && rules && (
          <div className="settings-card">
            <h3>{rules.state_name} Deposit Rules</h3>
            <div className="rules-info">
              <div className="rules-rate">
                <span className="rules-rate-label">Standard Rate</span>
                <span className="rules-rate-value">
                  {Math.round(depositRate * 100)}¢
                </span>
              </div>

              {rules.special_rates && (
                <div className="rules-special">
                  <span className="rules-rate-label">Special Rates</span>
                  {rules.deposit_rates.large && (
                    <p>{Math.round(rules.deposit_rates.large * 100)}¢ for containers 24oz+</p>
                  )}
                  {rules.deposit_rates.wine_liquor && (
                    <p>{Math.round(rules.deposit_rates.wine_liquor * 100)}¢ for wine/liquor</p>
                  )}
                  {rules.deposit_rates.liquor && (
                    <p>{Math.round(rules.deposit_rates.liquor * 100)}¢ for liquor</p>
                  )}
                  {rules.deposit_rates.wine_pouch && (
                    <p>{Math.round(rules.deposit_rates.wine_pouch * 100)}¢ for wine pouches</p>
                  )}
                </div>
              )}

              <div className="rules-beverages">
                <span className="rules-rate-label">Eligible Beverages</span>
                <p>{rules.eligible_beverages.join(', ')}</p>
              </div>

              {rules.notes && (
                <div className="rules-notes">
                  <span className="rules-rate-label">Notes</span>
                  <p>{rules.notes}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Supabase upgrade hint */}
        {isLocal && !supabaseEnabled && (
          <div className="settings-card">
            <h3>Cloud Sync</h3>
            <p className="settings-mode">
              Connect Supabase to sync data across devices and save session history to the cloud.
            </p>
          </div>
        )}

        <button className="btn btn-danger" onClick={signOut}>
          {isLocal ? 'Reset Profile' : 'Sign Out'}
        </button>
      </main>
    </div>
  )
}
