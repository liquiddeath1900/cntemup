import { getRank } from '../lib/ranks'

// Rank-up celebration modal — SF6-inspired flash
export function RankUpModal({ newRank, onClose }) {
  if (!newRank) return null
  const rank = getRank(newRank.threshold)

  return (
    <div className="rankup-overlay" onClick={onClose}>
      <div className="rankup-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rankup-flash" style={{ background: rank.color }} />
        <div className="rankup-badge">{rank.badge}</div>
        <h2 className="rankup-title" style={{ color: rank.color }}>RANK UP!</h2>
        <p className="rankup-name" style={{ color: rank.color }}>{rank.name.toUpperCase()}</p>
        <p className="rankup-msg">Keep counting to reach {newRank.nextRank || 'the top'}!</p>
        <button className="rankup-btn" onClick={onClose} style={{ borderColor: rank.color }}>
          LET'S GO
        </button>
      </div>
    </div>
  )
}
