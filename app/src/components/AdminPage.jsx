import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useAdminStats } from '../hooks/useAdminStats'

// Admin dashboard — full visibility into all users
export function AdminPage() {
  const { user } = useAuth()
  const { stats, loading, error, refresh } = useAdminStats(user?.email)
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
            <span className="history-stat-label">ACCOUNTS</span>
          </div>
          <div className="history-stat">
            <span className="history-stat-value">{stats.premiumUsers}</span>
            <span className="history-stat-label">PRO</span>
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
        </div>

        <div className="history-summary">
          <div className="history-stat">
            <span className="history-stat-value">{stats.waitlistCount}</span>
            <span className="history-stat-label">WAITLIST</span>
          </div>
          <div className="history-stat">
            <span className="history-stat-value">{stats.visitorCount}</span>
            <span className="history-stat-label">VISITORS</span>
          </div>
          <div className="history-stat">
            <span className="history-stat-value">{(stats.authUsers || []).length}</span>
            <span className="history-stat-label">GOOGLE</span>
          </div>
        </div>

        {/* Refresh button */}
        <div className="settings-section">
          <button className="settings-upgrade-btn" onClick={refresh}>
            REFRESH
          </button>
        </div>

        {/* Google Auth Users (paid path) */}
        <div className="settings-section">
          <h2 className="settings-section-title">GOOGLE USERS</h2>
          <div className="admin-table-scroll">
            {(stats.authUsers || []).length === 0 ? (
              <div className="history-empty"><p>No Google signups yet.</p></div>
            ) : (
              <div className="history-list">
                {stats.authUsers.map((u) => {
                  const date = new Date(u.created_at)
                  const isPro = stats.recentSignups.find(s => s.user_id === u.id)?.is_premium
                  const isOpen = expandedId === `auth-${u.id}`
                  return (
                    <div key={u.id} className="history-item" onClick={() => toggle(`auth-${u.id}`)} style={{ cursor: 'pointer' }}>
                      <div className="history-item-row">
                        <span className="history-item-date">
                          {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                        <span className={`history-item-count admin-name${isOpen ? ' admin-expanded' : ''}`}>{u.email}</span>
                        <span className="history-item-value">
                          {isPro ? 'PRO' : 'FREE'}
                        </span>
                      </div>
                      {isOpen ? (
                        <div className="admin-user-detail">
                          <div>{u.email}</div>
                          <div>ID: {u.id}</div>
                          <div>Provider: {u.provider}</div>
                          <div>Created: {new Date(u.created_at).toLocaleString()}</div>
                          <div>Last sign-in: {u.last_sign_in ? new Date(u.last_sign_in).toLocaleString() : 'never'}</div>
                        </div>
                      ) : (
                        <div className="admin-user-detail">
                          {u.provider} · last: {u.last_sign_in ? new Date(u.last_sign_in).toLocaleDateString() : 'never'}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Waitlist Users (free name+email signups) */}
        <div className="settings-section">
          <h2 className="settings-section-title">WAITLIST SIGNUPS</h2>
          <div className="admin-table-scroll">
            {(stats.recentWaitlist || []).length === 0 ? (
              <div className="history-empty"><p>No waitlist signups yet.</p></div>
            ) : (
              <div className="history-list">
                {stats.recentWaitlist.map((u, i) => {
                  const date = new Date(u.created_at)
                  const isOpen = expandedId === `wait-${i}`
                  return (
                    <div key={i} className="history-item" onClick={() => toggle(`wait-${i}`)} style={{ cursor: 'pointer' }}>
                      <div className="history-item-row">
                        <span className="history-item-date">
                          {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                        <span className={`history-item-count admin-name${isOpen ? ' admin-expanded' : ''}`}>{u.name || '—'}</span>
                        <span className={`history-item-value admin-name${isOpen ? ' admin-expanded' : ''}`}>{u.email}</span>
                      </div>
                      {isOpen ? (
                        <div className="admin-user-detail">
                          <div>Name: {u.name || '—'}</div>
                          <div>Email: {u.email}</div>
                          <div>Source: {u.source || 'landing'}</div>
                          <div>Created: {new Date(u.created_at).toLocaleString()}</div>
                        </div>
                      ) : (
                        <div className="admin-user-detail">
                          {u.source || 'landing'}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Profile Users (Supabase profiles) */}
        <div className="settings-section">
          <h2 className="settings-section-title">ALL PROFILES</h2>
          <div className="admin-table-scroll">
            {stats.recentSignups.length === 0 ? (
              <div className="history-empty"><p>No profiles yet.</p></div>
            ) : (
              <div className="history-list">
                {stats.recentSignups.map((u) => {
                  const date = new Date(u.created_at)
                  const name = u.full_name || u.display_name || 'Unknown'
                  const isOpen = expandedId === `prof-${u.user_id}`
                  return (
                    <div key={u.user_id} className="history-item" onClick={() => toggle(`prof-${u.user_id}`)} style={{ cursor: 'pointer' }}>
                      <div className="history-item-row">
                        <span className="history-item-date">
                          {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                        <span className={`history-item-count admin-name${isOpen ? ' admin-expanded' : ''}`}>{name}</span>
                        <span className="history-item-value">
                          {u.is_premium ? 'PRO' : 'FREE'}
                        </span>
                      </div>
                      {isOpen ? (
                        <div className="admin-user-detail">
                          <div>Name: {name}</div>
                          <div>ID: {u.user_id}</div>
                          <div>State: {u.state_code || '—'}</div>
                          <div>Status: {u.subscription_status || 'none'}</div>
                          <div>Premium: {u.is_premium ? 'YES' : 'NO'}</div>
                          <div>Created: {new Date(u.created_at).toLocaleString()}</div>
                        </div>
                      ) : (
                        <div className="admin-user-detail">
                          {u.state_code || '—'} · {u.subscription_status || 'none'}
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
