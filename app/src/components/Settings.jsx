import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { usePremium } from '../hooks/usePremium'
import { StateSelector } from './StateSelector'

// Settings page — plan status, upgrade, alerts, navigation
export function Settings() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, profile, signOut, isLocal, refreshProfile, updateAlertTarget, updateState, signInWithGoogle } = useAuth()
  const { isPremium, alertTarget, subscriptionStatus, premiumSince } = usePremium(profile)
  const [alertInput, setAlertInput] = useState(alertTarget || '')
  const [showUpgradeSuccess, setShowUpgradeSuccess] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)

  // Handle ?upgraded=true from Stripe redirect — poll until webhook fires
  useEffect(() => {
    if (searchParams.get('upgraded') !== 'true') return
    window.history.replaceState({}, '', '/settings')

    let attempts = 0
    const maxAttempts = 8 // ~16s total
    const poll = setInterval(async () => {
      attempts++
      const fresh = await refreshProfile()
      if (fresh?.is_premium) {
        setShowUpgradeSuccess(true)
        clearInterval(poll)
      } else if (attempts >= maxAttempts) {
        // Webhook may be slow — show success anyway, profile will update on next load
        setShowUpgradeSuccess(true)
        clearInterval(poll)
      }
    }, 2000)

    return () => clearInterval(poll)
  }, [searchParams, refreshProfile])

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (err) {
      console.error('Sign out error:', err)
    }
    // Force hard navigation to clear all state
    window.location.href = '/'
  }

  const handleUpgrade = async () => {
    // Local users → sign in with Google first (creates real account for Stripe)
    if (isLocal) {
      await signInWithGoogle()
      return
    }
    setCheckoutLoading(true)
    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
        }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
        return
      }
    } catch {
      // API not available — use payment link fallback
    }
    const fallbackLink = import.meta.env.VITE_STRIPE_PAYMENT_LINK
    if (fallbackLink) {
      window.location.href = fallbackLink
    }
    setCheckoutLoading(false)
  }

  const handleSaveAlert = () => {
    const target = parseInt(alertInput, 10) || 0
    updateAlertTarget(target)
  }

  const displayName = profile?.full_name || profile?.display_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Player'
  const displayEmail = user?.email && user.email !== 'local' ? user.email : null

  return (
    <div className="settings-page">
      <div className="settings-scanlines" />

      <header className="settings-header">
        <Link to="/app" className="settings-back">&larr; BACK</Link>
        <h1 className="settings-title">SETTINGS</h1>
      </header>

      <main className="settings-main">
        {/* Upgrade success banner */}
        {showUpgradeSuccess && (
          <div className="settings-success-banner">
            YOU'RE PRO NOW!
          </div>
        )}

        {/* Profile card */}
        <div className="settings-profile-card">
          <div className="settings-profile-icon">
            {isPremium ? '⭐' : '👾'}
          </div>
          <div className="settings-profile-info">
            <span className="settings-profile-name">
              {displayName}
              {isPremium && <span className="pro-badge-inline">PRO</span>}
            </span>
            {displayEmail && (
              <span className="settings-profile-email">{displayEmail}</span>
            )}
          </div>
        </div>

        {/* State selector */}
        <div className="settings-section">
          <StateSelector
            value={profile?.state_code || 'NY'}
            onChange={(code) => updateState(code)}
            label="YOUR STATE"
          />
        </div>

        {/* Plan status */}
        <div className="settings-section">
          <h2 className="settings-section-title">PLAN</h2>
          {isPremium ? (
            <div className="settings-plan-card settings-plan-pro">
              <div className="settings-plan-name">PRO</div>
              <div className="settings-plan-price">$2/mo</div>
              <div className="settings-plan-status">
                {subscriptionStatus === 'active' ? 'ACTIVE' : subscriptionStatus?.toUpperCase()}
              </div>
              {premiumSince && (
                <div className="settings-plan-since">
                  Since {new Date(premiumSince).toLocaleDateString()}
                </div>
              )}
            </div>
          ) : (
            <div className="settings-plan-card settings-plan-free">
              <div className="settings-plan-name">FREE</div>
              <button
                className="settings-upgrade-btn"
                onClick={handleUpgrade}
                disabled={checkoutLoading}
              >
                {isLocal ? 'SIGN IN WITH GOOGLE TO GO PRO' : checkoutLoading ? 'LOADING...' : 'GO PRO — $2/MO'}
              </button>
              <ul className="settings-pro-perks">
                <li>See your money grow as you count</li>
                <li>Bag alert / target limit</li>
                <li>45-day session history</li>
                <li>All for just $2/mo</li>
              </ul>
            </div>
          )}
        </div>

        {/* Alert target — pro only */}
        {isPremium && (
          <div className="settings-section">
            <h2 className="settings-section-title">BAG ALERT</h2>
            <p className="settings-section-desc">
              Get alerted when you hit your target count
            </p>
            <div className="settings-alert-row">
              <input
                type="number"
                className="settings-alert-input"
                placeholder="e.g. 200"
                value={alertInput}
                onChange={(e) => setAlertInput(e.target.value)}
                min="0"
                max="9999"
              />
              <button className="settings-alert-save" onClick={handleSaveAlert}>
                SAVE
              </button>
            </div>
            {alertTarget > 0 && (
              <p className="settings-alert-current">
                Current target: {alertTarget} items
              </p>
            )}
          </div>
        )}

        {/* Navigation links */}
        <div className="settings-section">
          <h2 className="settings-section-title">MORE</h2>
          <div className="settings-nav-links">
            <Link to="/history" className="settings-nav-link">
              <span>HISTORY</span>
              <span>{isPremium ? '→' : 'PRO'}</span>
            </Link>
            <Link to="/tips" className="settings-nav-link">
              <span>DEPOSIT TIPS</span>
              <span>→</span>
            </Link>
            {user?.email?.toLowerCase() === (import.meta.env.VITE_ADMIN_EMAIL || '').toLowerCase() && (
              <Link to="/admin" className="settings-nav-link">
                <span>ADMIN PANEL</span>
                <span>→</span>
              </Link>
            )}
          </div>
        </div>

        {/* Manage subscription — as a nav link style */}
        {isPremium && profile?.stripe_customer_id && (
          <div className="settings-section">
            <div className="settings-nav-links">
              <button
                className="settings-nav-link"
                onClick={async () => {
                  try {
                    const res = await fetch('/api/create-portal-session', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ customerId: profile.stripe_customer_id }),
                    })
                    const data = await res.json()
                    if (data.url) window.location.href = data.url
                  } catch (err) {
                    console.error('Portal error:', err)
                  }
                }}
              >
                <span>MANAGE SUBSCRIPTION</span>
                <span>→</span>
              </button>
            </div>
          </div>
        )}

        {/* Sign out */}
        <button className="settings-signout-btn" onClick={handleSignOut}>
          SIGN OUT
        </button>
      </main>

      <footer className="settings-footer">
        <p>CNTEM'UP &copy; 2026</p>
      </footer>
    </div>
  )
}
