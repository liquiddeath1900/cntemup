import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { StateSelector } from './StateSelector'
import { supabase, supabaseEnabled } from '../lib/supabase'

const WAITLIST_KEY = 'cntemup_waitlist'
const USER_KEY = 'cntemup_user'

// Save signup to waitlist table + localStorage (same as landing page)
async function saveSignup({ name, email, stateCode }) {
  const list = JSON.parse(localStorage.getItem(WAITLIST_KEY) || '[]')
  list.push({ name, email, created_at: new Date().toISOString() })
  localStorage.setItem(WAITLIST_KEY, JSON.stringify(list))

  if (supabaseEnabled && supabase) {
    try {
      await supabase.from('waitlist').upsert({
        name: name || null,
        email,
        source: 'auth-page',
      }, { onConflict: 'email' })
    } catch {}
  }

  const user = { name, email, loggedIn: true, created_at: new Date().toISOString() }
  localStorage.setItem(USER_KEY, JSON.stringify(user))
  return user
}

// Auth page — simple name+email for free, Google for Pro
export function Auth() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [stateCode, setStateCode] = useState('NY')
  const [status, setStatus] = useState(null)
  const { setupLocal, signInWithGoogle, error } = useAuth()

  // Simple signup — name + email, no password, straight to app
  const handleSimpleSignup = async (e) => {
    e.preventDefault()
    if (!displayName.trim()) return setStatus('name_required')
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setStatus('email_invalid')

    setStatus('saving')
    try {
      await saveSignup({ name: displayName.trim(), email: email.trim().toLowerCase(), stateCode })
      setupLocal(stateCode, displayName.trim())
      navigate('/app')
    } catch {
      setStatus('error')
    }
  }

  // Google sign-in — real Supabase account (needed for Pro)
  const handleGoogle = async () => {
    await signInWithGoogle()
  }

  return (
    <div className="auth-page">
      <div className="settings-scanlines" />

      <header className="auth-header">
        <Link to="/" className="settings-back">&larr; HOME</Link>
        <h1 className="auth-title">CNTEM'UP</h1>
        <p className="auth-tagline">Bottle & Can Counter</p>
      </header>

      <main className="auth-main">
        <div className="auth-card">
          <h2>GET STARTED</h2>
          <p className="auth-subtitle">Start counting in seconds</p>

          {/* Google — fastest path, also required for Pro */}
          {supabaseEnabled && (
            <>
              <button className="auth-google-btn" onClick={handleGoogle}>
                SIGN IN WITH GOOGLE
              </button>
              <p className="auth-hint">Required for Pro features</p>
              <div className="auth-divider"><span>or</span></div>
            </>
          )}

          {/* Simple name + email — no password */}
          <form onSubmit={handleSimpleSignup} className="auth-form">
            <input
              type="text"
              placeholder="Your Name"
              value={displayName}
              onChange={(e) => { setDisplayName(e.target.value); setStatus(null) }}
              className="auth-input"
              required
              minLength={2}
            />

            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setStatus(null) }}
              className="auth-input"
              required
            />

            <StateSelector
              value={stateCode}
              onChange={setStateCode}
            />

            {status === 'name_required' && <div className="auth-error">Enter your name.</div>}
            {status === 'email_invalid' && <div className="auth-error">Enter a valid email.</div>}
            {status === 'error' && <div className="auth-error">Something went wrong. Try again.</div>}
            {error && <div className="auth-error">{error}</div>}

            <button type="submit" className="auth-submit-btn" disabled={status === 'saving'}>
              {status === 'saving' ? 'SAVING...' : 'START COUNTING FREE'}
            </button>
          </form>
        </div>
      </main>

      <footer className="settings-footer">
        <p>CNTEM'UP &copy; 2026</p>
      </footer>
    </div>
  )
}
