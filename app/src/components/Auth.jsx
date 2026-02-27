import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { StateSelector } from './StateSelector'
import { supabaseEnabled } from '../lib/supabase'

// Auth/onboarding screen — state picker (local) or full auth (Supabase)
export function Auth() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [stateCode, setStateCode] = useState('NY')
  const { setupLocal, signUp, signIn, signInWithGoogle, error } = useAuth()

  // Local mode — just pick state and go
  const handleLocalStart = (e) => {
    e.preventDefault()
    setupLocal(stateCode, displayName || 'Counter')
  }

  // Supabase mode — full auth
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!supabaseEnabled) return handleLocalStart(e)
    if (isSignUp) {
      await signUp(email, password, stateCode, displayName)
    } else {
      await signIn(email, password)
    }
  }

  return (
    <div className="auth-page">
      <div className="settings-scanlines" />

      <header className="auth-header">
        <h1 className="auth-title">CNTEM'UP</h1>
        <p className="auth-tagline">Bottle & Can Counter</p>
      </header>

      <main className="auth-main">
        <div className="auth-card">
          <h2>{supabaseEnabled ? (isSignUp ? 'CREATE ACCOUNT' : 'SIGN IN') : 'GET STARTED'}</h2>
          <p className="auth-subtitle">
            {supabaseEnabled
              ? (isSignUp ? 'Enter your info to sign up' : 'Welcome back')
              : 'Pick your name and state to start counting'
            }
          </p>

          <form onSubmit={supabaseEnabled ? handleSubmit : handleLocalStart} className="auth-form">
            <input
              type="text"
              placeholder="Full Name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="auth-input"
              required
              minLength={2}
            />

            <StateSelector
              value={stateCode}
              onChange={setStateCode}
            />

            {supabaseEnabled && (
              <>
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="auth-input"
                  required
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="auth-input"
                  required
                  minLength={6}
                />
              </>
            )}

            {error && <div className="auth-error">{error}</div>}

            <button type="submit" className="auth-submit-btn">
              {supabaseEnabled
                ? (isSignUp ? 'SIGN UP' : 'SIGN IN')
                : 'START COUNTING'
              }
            </button>
          </form>

          {supabaseEnabled && (
            <>
              <div className="auth-divider"><span>or</span></div>
              <button className="auth-google-btn" onClick={signInWithGoogle}>
                CONTINUE WITH GOOGLE
              </button>
              <button
                className="auth-toggle"
                onClick={() => setIsSignUp(!isSignUp)}
              >
                {isSignUp
                  ? 'Already have an account? Sign in'
                  : "Don't have an account? Sign up"
                }
              </button>
            </>
          )}
        </div>
      </main>

      <footer className="settings-footer">
        <p>CNTEM'UP &copy; 2026</p>
      </footer>
    </div>
  )
}
