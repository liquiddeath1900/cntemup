import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { GENERAL_TIPS, STATE_TIPS, NON_DEPOSIT_STATE_TIP } from '../data/depositTips'
import { DEPOSIT_STATES } from '../data/stateRules'

// Deposit Tips page — free for everyone
export function Tips() {
  const { profile } = useAuth()
  const stateCode = profile?.state_code || 'NY'
  const [openSection, setOpenSection] = useState(null)

  const hasDeposit = DEPOSIT_STATES.has(stateCode)
  const stateTips = STATE_TIPS[stateCode]

  const toggleSection = (index) => {
    setOpenSection(openSection === index ? null : index)
  }

  return (
    <div className="settings-page">
      <div className="settings-scanlines" />

      <header className="settings-header">
        <Link to="/settings" className="settings-back">&larr; BACK</Link>
        <h1 className="settings-title">TIPS</h1>
      </header>

      <main className="settings-main">
        {/* State-specific tips first */}
        {hasDeposit && stateTips ? (
          <div className="tips-state-section">
            <h2 className="tips-state-name">{stateTips.state_name}</h2>
            <div className="tips-rate-badge">{stateTips.rate_info}</div>
            <ul className="tips-list">
              {stateTips.tips.map((tip, i) => (
                <li key={i} className="tips-list-item">{tip}</li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="tips-state-section tips-no-deposit">
            <h2 className="tips-state-name">{NON_DEPOSIT_STATE_TIP.title}</h2>
            <p className="tips-no-deposit-msg">{NON_DEPOSIT_STATE_TIP.message}</p>
          </div>
        )}

        {/* General tips accordion */}
        <h2 className="tips-general-header">GENERAL TIPS</h2>
        {GENERAL_TIPS.map((section, index) => (
          <div key={index} className="tips-accordion">
            <button
              className={`tips-accordion-header ${openSection === index ? 'tips-accordion-open' : ''}`}
              onClick={() => toggleSection(index)}
            >
              <span>{section.title}</span>
              <span>{openSection === index ? '−' : '+'}</span>
            </button>
            {openSection === index && (
              <ul className="tips-accordion-content">
                {section.tips.map((tip, i) => (
                  <li key={i} className="tips-list-item">{tip}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </main>

      <footer className="settings-footer">
        <p>CNTEM'UP &copy; 2026</p>
      </footer>
    </div>
  )
}
