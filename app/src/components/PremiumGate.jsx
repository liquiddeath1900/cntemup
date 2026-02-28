import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { usePremium } from '../hooks/usePremium'

// Wrapper — shows upgrade prompt for locked features
export function PremiumGate({ children, feature = 'this feature' }) {
  const navigate = useNavigate()
  const { user, profile, isLocal, signInWithGoogle } = useAuth()
  const { isPremium } = usePremium(profile)

  if (isPremium) return children

  const handleUpgrade = async () => {
    // Local users → sign in with Google first (creates real account for Stripe)
    if (isLocal) {
      await signInWithGoogle()
      return
    }
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
      if (data.url) window.location.href = data.url
    } catch (err) {
      console.error('Checkout error:', err)
    }
  }

  return (
    <div className="premium-gate">
      <div className="premium-gate-icon">PRO</div>
      <h3 className="premium-gate-title">PRO FEATURE</h3>
      <p className="premium-gate-text">
        {isLocal
          ? 'Sign in with Google to unlock Pro features'
          : `Unlock ${feature} with CNTEM'UP Pro for just $2/mo`}
      </p>
      <button className="premium-gate-btn" onClick={handleUpgrade}>
        {isLocal ? 'SIGN IN WITH GOOGLE' : 'GO PRO — $2/MO'}
      </button>
    </div>
  )
}
