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
    <div className="app">
      <header className="header">
        <h1>CNTEM'UP</h1>
        <p>Bottle & Can Counter</p>
      </header>

      <main className="main">
        <div className="auth-card">
          <h2>Get Started</h2>
          <p className="auth-subtitle">Select your state to see deposit rates</p>

          <form onSubmit={supabaseEnabled ? handleSubmit : handleLocalStart} className="auth-form">
            <input
              type="text"
              placeholder="Your Name (optional)"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="auth-input"
            />

            <StateSelector
              value={stateCode}
              onChange={setStateCode}
            />

            {/* Only show email/password if Supabase is connected */}
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

            <button type="submit" className="btn btn-primary">
              {supabaseEnabled
                ? (isSignUp ? 'Sign Up' : 'Sign In')
                : 'Start Counting'
              }
            </button>
          </form>

          {supabaseEnabled && (
            <>
              <div className="auth-divider"><span>or</span></div>
              <button className="btn btn-google" onClick={signInWithGoogle}>
                Continue with Google
              </button>
              <button
                className="btn btn-ghost auth-toggle"
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
    </div>
  )
}
