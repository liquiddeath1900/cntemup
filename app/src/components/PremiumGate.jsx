import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { usePremium } from '../hooks/usePremium'

// Wrapper — shows upgrade prompt for locked features
export function PremiumGate({ children, feature = 'this feature' }) {
  const navigate = useNavigate()
  const { user, profile, isLocal } = useAuth()
  const { isPremium } = usePremium(profile)

  if (isPremium) return children

  const handleUpgrade = async () => {
    // Local users must create an account first
    if (isLocal) {
      navigate('/login')
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
          ? 'Create an account to unlock Pro features'
          : `Unlock ${feature} with CNTEM'UP Pro for just $2/mo`}
      </p>
      <button className="premium-gate-btn" onClick={handleUpgrade}>
        {isLocal ? 'CREATE ACCOUNT' : 'GO PRO — $2/MO'}
      </button>
    </div>
  )
}
