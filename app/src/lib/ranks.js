// Street Fighter-inspired rank system — 8 ranks, no sub-tiers
// Single source of truth for thresholds, colors, and badges

const RANKS = [
  { name: 'Master',   threshold: 25000, badge: '🔥', color: '#ef4444' },
  { name: 'Diamond',  threshold: 12000, badge: '👑', color: '#a855f7' },
  { name: 'Platinum', threshold: 6000,  badge: '💎', color: '#06b6d4' },
  { name: 'Gold',     threshold: 3000,  badge: '🥇', color: '#f59e0b' },
  { name: 'Silver',   threshold: 1500,  badge: '🥈', color: '#c0c0c0' },
  { name: 'Bronze',   threshold: 500,   badge: '🥉', color: '#cd7f32' },
  { name: 'Iron',     threshold: 200,   badge: '🛡️', color: '#71717a' },
  { name: 'Rookie',   threshold: 0,     badge: '🥫', color: '#888888' },
]

// Get rank info for a given total count
export function getRank(totalCount = 0) {
  const count = Math.max(0, totalCount)
  const rank = RANKS.find(r => count >= r.threshold) || RANKS[RANKS.length - 1]
  const currentIndex = RANKS.indexOf(rank)
  const nextRank = currentIndex > 0 ? RANKS[currentIndex - 1] : null

  return {
    name: rank.name,
    badge: rank.badge,
    color: rank.color,
    threshold: rank.threshold,
    nextRank: nextRank ? nextRank.name : null,
    nextBadge: nextRank ? nextRank.badge : null,
    countToNext: nextRank ? nextRank.threshold - count : 0,
  }
}

// CSS class name for a rank (used for border colors)
export function rankClass(totalCount = 0) {
  return `rank-${getRank(totalCount).name.toLowerCase()}`
}

// All ranks (for display purposes)
export { RANKS }
