import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAdminStats } from '../hooks/useAdminStats'

// Admin dashboard — full visibility into all users
export function AdminPage() {
  const { stats, loading, error, refresh } = useAdminStats()
  const [expandedId, setExpandedId] = useState(null)

  const toggle = (id) => setExpandedId(prev => prev === id ? null : id)

  if (loading) {
    return (
      <div className="settings-page">
        <div className="settings-scanlines" />
        <header className="settings-header">
          <Link to="/settings" className="settings-back">&larr; BACK</Link>
          <h1 className="settings-title">ADMIN</h1>
        </header>
        <main className="settings-main">
          <div className="history-loading">LOADING STATS...</div>
        </main>
      </div>
    )
  }

  if (error) {
    return (
      <div className="settings-page">
        <div className="settings-scanlines" />
        <header className="settings-header">
          <Link to="/settings" className="settings-back">&larr; BACK</Link>
          <h1 className="settings-title">ADMIN</h1>
        </header>
        <main className="settings-main">
          <div className="history-error">ERROR: {error}</div>
        </main>
      </div>
    )
  }

  return (
    <div className="settings-page">
      <div className="settings-scanlines" />

      <header className="settings-header">
        <Link to="/settings" className="settings-back">&larr; BACK</Link>
        <h1 className="settings-title">ADMIN</h1>
      </header>

      <main className="settings-main">
        {/* Stat cards */}
        <div className="history-summary">
          <div className="history-stat">
            <span className="history-stat-value">{stats.totalUsers}</span>
            <span className="history-stat-label">TOTAL</span>
          </div>
          <div className="history-stat">
            <span className="history-stat-value">{stats.premiumUsers}</span>
            <span className="history-stat-label">PRO</span>
          </div>
          <div className="history-stat">
            <span className="history-stat-value">{stats.googleUsers || 0}</span>
            <span className="history-stat-label">GOOGLE</span>
          </div>
          <div className="history-stat">
            <span className="history-stat-value">{stats.freeUsers}</span>
            <span className="history-stat-label">FREE</span>
          </div>
        </div>

        <div className="history-summary">
          <div className="history-stat">
            <span className="history-stat-value">{stats.signupsWeek}</span>
            <span className="history-stat-label">THIS WEEK</span>
          </div>
          <div className="history-stat">
            <span className="history-stat-value">{stats.signupsMonth}</span>
            <span className="history-stat-label">THIS MONTH</span>
          </div>
          <div className="history-stat">
            <span className="history-stat-value">{stats.totalSessions}</span>
            <span className="history-stat-label">SESSIONS</span>
          </div>
          <div className="history-stat">
            <span className="history-stat-value">{stats.visitorCount}</span>
            <span className="history-stat-label">VISITORS</span>
          </div>
        </div>

        {/* Refresh button */}
        <div className="settings-section">
          <button className="settings-upgrade-btn" onClick={refresh}>
            REFRESH
          </button>
        </div>

        {/* Verification Queue */}
        {(stats.pendingVerifications || []).length > 0 && (
          <div className="settings-section">
            <h2 className="settings-section-title">VERIFICATION QUEUE</h2>
            <div className="admin-table-scroll">
              <div className="history-list">
                {stats.pendingVerifications.map((v) => {
                  const date = new Date(v.created_at)
                  const isOpen = expandedId === `verify-${v.id}`
                  return (
                    <div key={v.id} className="history-item" onClick={() => toggle(`verify-${v.id}`)} style={{ cursor: 'pointer' }}>
                      <div className="history-item-row">
                        <span className="history-item-date">
                          {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                        <span className="history-item-count">{v.display_name}</span>
                        <span className="history-item-value">{v.count} items</span>
                      </div>
                      {isOpen && (
                        <div className="admin-user-detail">
                          <div>Count: {v.count} ({v.state_code})</div>
                          <div>Deposit: ${Number(v.deposit_value || 0).toFixed(2)}</div>
                          <div>
                            <a href={v.image_url} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa' }}>
                              View Slip Photo
                            </a>
                          </div>
                          <div>Session: {v.session_id}</div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Flagged Sessions */}
        {(stats.flaggedSessions || []).length > 0 && (
          <div className="settings-section">
            <h2 className="settings-section-title">FLAGGED SESSIONS</h2>
            <div className="admin-table-scroll">
              <div className="history-list">
                {stats.flaggedSessions.map((s) => {
                  const date = new Date(s.created_at)
                  const isOpen = expandedId === `flag-${s.id}`
                  return (
                    <div key={s.id} className="history-item flagged-item" onClick={() => toggle(`flag-${s.id}`)} style={{ cursor: 'pointer' }}>
                      <div className="history-item-row">
                        <span className="history-item-date">
                          {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                        <span className="history-item-count">{s.display_name}</span>
                        <span className="history-item-value" style={{ color: '#ef4444' }}>
                          {s.count} @ {s.rate}/s
                        </span>
                      </div>
                      {isOpen && (
                        <div className="admin-user-detail">
                          <div>Count: {s.count}</div>
                          <div>Duration: {s.duration_seconds}s</div>
                          <div>Rate: {s.rate} items/sec</div>
                          <div>Reason: {s.flag_reason}</div>
                          <div>Session: {s.id}</div>
                          <div>User: {s.user_id}</div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ALL USERS — unified list */}
        <div className="settings-section">
          <h2 className="settings-section-title">ALL USERS</h2>
          <div className="admin-table-scroll">
            {(stats.allUsers || []).length === 0 ? (
              <div className="history-empty"><p>No users yet.</p></div>
            ) : (
              <div className="history-list">
                {stats.allUsers.map((u) => {
                  const date = new Date(u.created_at)
                  const isOpen = expandedId === u.id
                  const badgeColors = { PRO: '#22c55e', GOOGLE: '#60a5fa' }
                  const badgeColor = badgeColors[u.type] || 'var(--gb-text-dim)'
                  return (
                    <div key={u.id} className="history-item" onClick={() => toggle(u.id)} style={{ cursor: 'pointer' }}>
                      <div className="history-item-row">
                        <span className="history-item-date">
                          {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                        <span className={`history-item-count admin-name${isOpen ? ' admin-expanded' : ''}`}>
                          {u.name}
                        </span>
                        <span className="history-item-value" style={{ color: badgeColor }}>
                          {u.type}
                        </span>
                      </div>
                      {isOpen ? (
                        <div className="admin-user-detail">
                          <div>Name: {u.name}</div>
                          <div>Email: {u.email}</div>
                          <div>Type: {u.type}</div>
                          {u.state_code && <div>State: {u.state_code}</div>}
                          <div>Source: {u.source}</div>
                          {u.subscription_status && <div>Sub: {u.subscription_status}</div>}
                          <div>Created: {new Date(u.created_at).toLocaleString()}</div>
                          {u.last_sign_in && <div>Last login: {new Date(u.last_sign_in).toLocaleString()}</div>}
                          {u.id && !u.id.startsWith('waitlist-') && <div>ID: {u.id}</div>}
                        </div>
                      ) : (
                        <div className="admin-user-detail">
                          {u.email}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="settings-footer">
        <p>ADMIN PANEL · CNTEM'UP</p>
      </footer>
    </div>
  )
}
