import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

// Settings page — free plan: sign out only
export function Settings() {
  const navigate = useNavigate()
  const { user, profile, signOut, isLocal } = useAuth()

  const handleSignOut = async () => {
    await signOut()
    // Clear landing page login state too
    localStorage.removeItem('cntemup_user')
    navigate('/')
  }

  const displayName = profile?.display_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Player'
  const displayEmail = user?.email && user.email !== 'local' ? user.email : null

  return (
    <div className="settings-page">
      <div className="settings-scanlines" />

      <header className="settings-header">
        <a href="/app" className="settings-back">← BACK</a>
        <h1 className="settings-title">SETTINGS</h1>
      </header>

      <main className="settings-main">
        {/* Profile card */}
        <div className="settings-profile-card">
          <div className="settings-profile-icon">👾</div>
          <div className="settings-profile-info">
            <span className="settings-profile-name">{displayName}</span>
            {displayEmail && (
              <span className="settings-profile-email">{displayEmail}</span>
            )}
          </div>
        </div>

        {/* Sign out */}
        <button className="settings-signout-btn" onClick={handleSignOut}>
          SIGN OUT
        </button>
      </main>

      <footer className="settings-footer">
        <p>CNTEM'UP © 2026</p>
      </footer>
    </div>
  )
}
