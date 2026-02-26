import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, supabaseEnabled } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { trackVisit } from '../lib/tracking'

const WAITLIST_KEY = 'cntemup_waitlist'
const USER_KEY = 'cntemup_user'

// Check if user already signed up
export function getLoggedInUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY))
  } catch {
    return null
  }
}

// Save signup locally or to Supabase
async function saveSignup({ name, email, city, region, country }) {
  // Always save locally first as backup
  const list = JSON.parse(localStorage.getItem(WAITLIST_KEY) || '[]')
  list.push({ name, email, city, region, country, created_at: new Date().toISOString() })
  localStorage.setItem(WAITLIST_KEY, JSON.stringify(list))

  // Also save to Supabase if available (non-blocking)
  if (supabaseEnabled && supabase) {
    try {
      await supabase.from('waitlist').insert({
        name: name || null,
        email,
        city: city || null,
        region: region || null,
        country: country || null,
        source: 'landing',
      })
    } catch (err) {
      console.warn('[Waitlist] Supabase insert failed, saved locally', err)
    }
  }

  const user = { name, email, loggedIn: true, created_at: new Date().toISOString() }
  localStorage.setItem(USER_KEY, JSON.stringify(user))
  return user
}

export function LandingPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [status, setStatus] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const geoRef = useRef({})
  const formRef = useRef(null)
  const { user, signInWithGoogle } = useAuth()

  // If already logged in (email or Google), go straight to app
  useEffect(() => {
    if (user && user.id !== 'local') {
      navigate('/app')
      return
    }
    const localUser = getLoggedInUser()
    if (localUser?.loggedIn) {
      navigate('/app')
    }
  }, [navigate, user])

  // Track visitor on page load
  useEffect(() => {
    trackVisit('/').then(({ geo }) => {
      geoRef.current = geo || {}
    })
  }, [])

  // Scroll to form when it appears
  useEffect(() => {
    if (showForm && formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [showForm])

  const handleGetStarted = () => {
    setShowForm(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return setStatus('name_required')
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setStatus('email_invalid')
    setStatus('saving')
    try {
      const geo = geoRef.current
      await saveSignup({ name: name.trim(), email: email.trim().toLowerCase(), city: geo.city, region: geo.region, country: geo.country })
      setStatus('done')
      setTimeout(() => navigate('/app'), 1200)
    } catch (err) {
      console.error('Signup error:', err)
      setStatus('error')
    }
  }

  return (
    <div className="landing">
      <div className="landing-scanlines" />

      {/* ===== HERO — Title + tagline ===== */}
      <section className="landing-hero landing-hero-compact">
        <div className="landing-console">
          <div className="landing-power">
            <span className="landing-power-dot" />
            <span className="landing-power-label">POWER</span>
          </div>

          <h1 className="landing-title">CNTEM'UP</h1>
          <p className="landing-subtitle">BOTTLE & CAN COUNTER</p>
        </div>
      </section>

      {/* ===== HOW IT WORKS — Main content ===== */}
      <section className="landing-howto">
        <h2 className="landing-section-title">— HOW TO PLAY —</h2>

        <div className="setup-card">
          <div className="setup-card-header">
            <span className="setup-card-num">STEP 1</span>
            <span className="setup-card-title">PROP YOUR PHONE</span>
          </div>
          <div className="setup-diagram">
            <pre className="setup-ascii">{`
     ┌─────────┐
     │ ┌─────┐ │
     │ │ CAM │ │  ← Phone propped up
     │ │ ~~~ │ │     facing the table
     │ │ 047 │ │
     │ └─────┘ │
     └────┬────┘
          │╲
     ═════╧══════  ← Table / surface
            `}</pre>
          </div>
          <p className="setup-tip">Lean your phone against anything — a book, a mug, a wall. Camera facing the surface where items will pass.</p>
        </div>

        <div className="setup-card">
          <div className="setup-card-header">
            <span className="setup-card-num">STEP 2</span>
            <span className="setup-card-title">HIT START</span>
          </div>
          <div className="setup-diagram">
            <div className="setup-phone-screen">
              <div className="setup-phone-cam">
                <div className="setup-tripwire-demo">
                  <span className="setup-tw-label">TRIPWIRE</span>
                </div>
              </div>
              <div className="setup-phone-count">
                <span>COUNT</span>
                <span className="setup-phone-num">000</span>
              </div>
            </div>
          </div>
          <p className="setup-tip">A red line appears on your camera feed. That's the tripwire. Anything that crosses it gets counted.</p>
        </div>

        <div className="setup-card setup-card-highlight">
          <div className="setup-card-header">
            <span className="setup-card-num">STEP 3</span>
            <span className="setup-card-title">TOSS 'EM</span>
          </div>
          <div className="setup-diagram">
            <div className="setup-conveyor">
              <div className="setup-bottle setup-bottle-1">🍾</div>
              <div className="setup-bottle setup-bottle-2">🥫</div>
              <div className="setup-bottle setup-bottle-3">🍺</div>
              <div className="setup-conveyor-line" />
              <div className="setup-conveyor-arrow">→ → →</div>
              <div className="setup-phone-mini">
                <div className="setup-phone-mini-screen">
                  <div className="setup-mini-tw" />
                  <span>+1</span>
                </div>
              </div>
            </div>
          </div>
          <p className="setup-tip">Slide, roll, or toss bottles & cans across the camera view. Each one that crosses the line = <strong>+1</strong></p>
          <div className="setup-methods">
            <div className="setup-method">
              <span className="setup-method-icon">👆</span>
              <span>Slide across table</span>
            </div>
            <div className="setup-method">
              <span className="setup-method-icon">📐</span>
              <span>Use a ramp / chute</span>
            </div>
            <div className="setup-method">
              <span className="setup-method-icon">🤲</span>
              <span>Hand-pass one by one</span>
            </div>
          </div>
        </div>

        <div className="setup-card">
          <div className="setup-card-header">
            <span className="setup-card-num">STEP 4</span>
            <span className="setup-card-title">KNOW YOUR MONEY</span>
          </div>
          <div className="setup-diagram">
            <div className="setup-payout">
              <div className="setup-payout-row">
                <span className="setup-payout-label">COUNTED</span>
                <span className="setup-payout-value">047</span>
              </div>
              <div className="setup-payout-row">
                <span className="setup-payout-label">VALUE</span>
                <span className="setup-payout-value setup-payout-money">$2.35</span>
              </div>
              <div className="setup-payout-row">
                <span className="setup-payout-label">STATE</span>
                <span className="setup-payout-value">NY @ 5¢</span>
              </div>
            </div>
          </div>
          <p className="setup-tip">See your deposit value in real time. Save your session. Take your bags to the redemption center and collect.</p>
        </div>

        <div className="setup-protips">
          <h3 className="setup-protips-title">PRO TIPS</h3>
          <div className="setup-protip">
            <span>💡</span> Good lighting = better detection. Avoid shadows across the line.
          </div>
          <div className="setup-protip">
            <span>📏</span> Keep items 6-18 inches from camera for best results.
          </div>
          <div className="setup-protip">
            <span>±</span> Miscounted? Use +/− buttons to fix it manually.
          </div>
          <div className="setup-protip">
            <span>☝️</span> Drag the tripwire line up or down to reposition it.
          </div>
        </div>
      </section>

      {/* ===== SIGNUP — Gate to counter ===== */}
      <section className="landing-signup-section" ref={formRef}>
        {status === 'done' ? (
          <div className="landing-success">
            <div className="landing-success-icon">✓</div>
            <h2>PLAYER REGISTERED!</h2>
            <p>Loading counter...</p>
          </div>
        ) : !showForm ? (
          <button className="landing-start-btn landing-start-btn-big" onClick={handleGetStarted}>
            ▶ GET STARTED
          </button>
        ) : (
          <form className="landing-form" onSubmit={handleSubmit}>
            <h2 className="landing-form-title">JOIN THE GAME</h2>

            {/* Google sign-in — one tap, gets name + email automatically */}
            {supabaseEnabled && (
              <>
                <button
                  type="button"
                  className="landing-google-btn"
                  onClick={signInWithGoogle}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                  SIGN IN WITH GOOGLE
                </button>
                <div className="landing-divider">
                  <span>OR</span>
                </div>
              </>
            )}

            <input
              className="landing-input"
              type="text"
              placeholder="NAME"
              value={name}
              onChange={(e) => { setName(e.target.value); setStatus(null) }}
              required
              autoComplete="name"
              autoFocus
            />
            <input
              className="landing-input"
              type="email"
              placeholder="EMAIL"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setStatus(null) }}
              required
              autoComplete="email"
            />
            <button
              className="landing-start-btn"
              type="submit"
              disabled={status === 'saving'}
            >
              {status === 'saving' ? 'SAVING...' : '▶ START COUNTING'}
            </button>

            {status === 'name_required' && (
              <p className="landing-error">Enter your name.</p>
            )}
            {status === 'email_invalid' && (
              <p className="landing-error">Enter a valid email.</p>
            )}
            {status === 'error' && (
              <p className="landing-error">Something went wrong. Try again.</p>
            )}
          </form>
        )}
      </section>

      <footer className="landing-footer">
        <p>CNTEM'UP © 2026</p>
        <p>BUILT IN NYC</p>
      </footer>
    </div>
  )
}
