import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { usePremium } from '../hooks/usePremium'
import { useHistory } from '../hooks/useHistory'
import { PremiumGate } from './PremiumGate'

// History page — 45-day session history (paid users only)
export function History() {
  const { user, profile, isLocal } = useAuth()
  const { isPremium } = usePremium(profile)
  const { sessions, stats, loading, error } = useHistory(user?.id, isLocal)
  const [expandedId, setExpandedId] = useState(null)

  return (
    <div className="settings-page">
      <div className="settings-scanlines" />

      <header className="settings-header">
        <Link to="/settings" className="settings-back">&larr; BACK</Link>
        <h1 className="settings-title">HISTORY</h1>
      </header>

      <main className="settings-main">
        {!isPremium ? (
          <PremiumGate feature="session history">
            <div />
          </PremiumGate>
        ) : loading ? (
          <div className="history-loading">LOADING...</div>
        ) : error ? (
          <div className="history-error">{error}</div>
        ) : (
          <>
            {/* Summary bar */}
            <div className="history-summary">
              <div className="history-stat">
                <span className="history-stat-value">{stats.totalSessions}</span>
                <span className="history-stat-label">SESSIONS</span>
              </div>
              <div className="history-stat">
                <span className="history-stat-value">{stats.totalBottles}</span>
                <span className="history-stat-label">ITEMS</span>
              </div>
              <div className="history-stat">
                <span className="history-stat-value">${stats.totalEarnings.toFixed(2)}</span>
                <span className="history-stat-label">EARNED</span>
              </div>
            </div>

            {/* Session list */}
            {sessions.length === 0 ? (
              <div className="history-empty">
                <p>No sessions yet.</p>
                <p>Start counting to build your history!</p>
              </div>
            ) : (
              <div className="history-list">
                {sessions.map((session) => {
                  const date = new Date(session.created_at)
                  const isExpanded = expandedId === session.id
                  return (
                    <div
                      key={session.id}
                      className={`history-item ${isExpanded ? 'history-item-expanded' : ''}`}
                      onClick={() => setExpandedId(isExpanded ? null : session.id)}
                    >
                      <div className="history-item-row">
                        <span className="history-item-date">
                          {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                        <span className="history-item-count">{session.count} items</span>
                        <span className="history-item-value">
                          ${parseFloat(session.deposit_value || 0).toFixed(2)}
                        </span>
                      </div>
                      {isExpanded && (
                        <div className="history-item-details">
                          <div>State: {session.state_code || 'N/A'}</div>
                          <div>Time: {date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </main>

      <footer className="settings-footer">
        <p>Last 45 days</p>
      </footer>
    </div>
  )
}
