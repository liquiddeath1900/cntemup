import { useState } from 'react'
import { shareScoreCard } from '../lib/scoreCard'
import { TIME_ATTACK_SECONDS } from '../hooks/useTimeAttack'

// Time Attack result — score, personal best, and a share card to challenge someone
export function TimeAttackModal({ score, best, isRecord, onAgain, onClose }) {
  const [shareState, setShareState] = useState('idle')

  const handleShare = async () => {
    setShareState('working')
    const result = await shareScoreCard({ score, seconds: TIME_ATTACK_SECONDS, isRecord })
    setShareState(result === 'saved' ? 'saved' : 'idle')
  }

  const SHARE_LABEL = { idle: 'SHARE SCORE', working: 'MAKING...', saved: 'SAVED!' }

  return (
    <div className="rankup-overlay" onClick={onClose}>
      <div className="rankup-modal ta-modal" onClick={(e) => e.stopPropagation()}>
        <p className="ta-modal-label">TIME'S UP</p>
        <p className="ta-modal-score">{score}</p>
        <p className="ta-modal-unit">IN {TIME_ATTACK_SECONDS} SECONDS</p>
        {isRecord ? (
          <p className="ta-modal-record">NEW PERSONAL BEST!</p>
        ) : (
          <p className="ta-modal-best">BEST: {best}</p>
        )}
        {score > 0 && <p className="ta-modal-unit">ADDED TO YOUR COUNT. HIT SAVE TO KEEP IT.</p>}
        <button className="gb-action-btn gb-save-btn ta-modal-share" onClick={handleShare} disabled={shareState === 'working'}>
          {SHARE_LABEL[shareState]}
        </button>
        <button className="rankup-btn" onClick={onAgain}>PLAY AGAIN</button>
        <button className="ta-modal-done" onClick={onClose}>DONE</button>
      </div>
    </div>
  )
}
