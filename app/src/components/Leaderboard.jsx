import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useLeaderboard } from '../hooks/useLeaderboard'
import { useHistory } from '../hooks/useHistory'
import { getRank, rankClass } from '../lib/ranks'

// Leaderboard page — Street Fighter rank system, environmental cause
export function Leaderboard() {
  const { user, profile, isLocal, updateLeaderboardVisibility } = useAuth()
  const [period, setPeriod] = useState('weekly')
  const isOptedIn = profile?.show_on_leaderboard || false
  const { rankings, globalStats, isDemo, loading, error } = useLeaderboard(period, isOptedIn)
  const { stats } = useHistory(user?.id, isLocal)

  const myTotalCount = stats?.totalBottles || 0
  const myRank = getRank(myTotalCount)
  const myName = profile?.display_name || profile?.full_name || 'Player'
  const isGoogleAuth = !isLocal && user?.id !== 'local'

  const handleToggle = async () => {
    if (updateLeaderboardVisibility) {
      await updateLeaderboardVisibility(!isOptedIn)
    }
  }

  return (
    <div className="settings-page">
      <div className="settings-scanlines" />

      <header className="settings-header">
        <Link to="/settings" className="settings-back">&larr; BACK</Link>
        <h1 className="settings-title">LEADERBOARD</h1>
      </header>

      <main className="settings-main">
        {/* Only show leaderboard data when user is opted in */}
        {isOptedIn && (
          <>
            {/* Demo banner */}
            {isDemo && (
              <div className="leaderboard-demo-banner">DEMO DATA</div>
            )}

            {/* Period toggle */}
            <div className="leaderboard-period-toggle">
              <button
                className={`period-tab ${period === 'weekly' ? 'period-tab-active' : ''}`}
                onClick={() => setPeriod('weekly')}
              >
                THIS WEEK
              </button>
              <button
                className={`period-tab ${period === 'alltime' ? 'period-tab-active' : ''}`}
                onClick={() => setPeriod('alltime')}
              >
                ALL TIME
              </button>
            </div>
            {period === 'weekly' && (
              <div className="leaderboard-reset-label">Resets Monday</div>
            )}

            {/* Hero stats */}
            <div className="history-summary" style={{ marginBottom: '8px' }}>
              <div className="history-stat">
                <span className="history-stat-value">
                  {globalStats.totalBottles.toLocaleString()}
                </span>
                <span className="history-stat-label">SAVED</span>
              </div>
              <div className="history-stat">
                <span className="history-stat-value">
                  {globalStats.totalCounters.toLocaleString()}
                </span>
                <span className="history-stat-label">COUNTERS</span>
              </div>
            </div>

            {/* Environmental cause message */}
            <div className="leaderboard-cause">
              Every bottle counted is one less in a landfill
            </div>

            {/* Rankings list */}
            {loading ? (
              <div className="history-loading">LOADING...</div>
            ) : error ? (
              <div className="history-error">{error}</div>
            ) : rankings.length === 0 ? (
              <div className="history-empty">
                <p>{period === 'weekly' ? 'No sessions this week yet. Be the first!' : 'No data yet.'}</p>
              </div>
            ) : (
              <div className="leaderboard-list">
                {rankings.map((entry, i) => {
                  const rank = getRank(entry.total_count)
                  const position = i + 1
                  const isMe = entry.display_name === myName && !isDemo
                  const isTop3 = position <= 3

                  return (
                    <div
                      key={i}
                      className={`leaderboard-row ${rankClass(entry.total_count)} ${isMe ? 'leaderboard-row-me' : ''} ${isTop3 ? 'leaderboard-top3' : ''}`}
                      style={{ borderColor: rank.color }}
                    >
                      <div className="leaderboard-row-main">
                        <span className="leaderboard-row-badge">{rank.badge}</span>
                        <span className="leaderboard-row-pos">#{position}</span>
                        <span className="leaderboard-row-name">
                          {entry.display_name}
                          {entry.is_premium && <span className="pro-badge-inline">⭐</span>}
                        </span>
                        <span className="leaderboard-row-count">
                          {entry.total_count.toLocaleString()}
                        </span>
                      </div>

                      {/* Progress bar for current user */}
                      {isMe && myRank.nextRank && (
                        <div className="leaderboard-progress">
                          <div
                            className="leaderboard-progress-bar"
                            style={{
                              width: `${Math.min(100, ((myTotalCount - myRank.threshold) / (myRank.countToNext + myTotalCount - myRank.threshold)) * 100)}%`,
                              background: myRank.color,
                            }}
                          />
                          <span className="leaderboard-progress-text">
                            {myRank.countToNext} to {myRank.nextBadge} {myRank.nextRank}
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* Your rank card (if not on leaderboard) */}
        {!isOptedIn && (
          <div className="leaderboard-your-rank" style={{ borderColor: myRank.color }}>
            <div className="leaderboard-row-main">
              <span className="leaderboard-row-badge">{myRank.badge}</span>
              <span className="leaderboard-row-name">{myName}</span>
              <span className="leaderboard-row-count">{myTotalCount.toLocaleString()}</span>
            </div>
            {myRank.nextRank && (
              <div className="leaderboard-progress">
                <div
                  className="leaderboard-progress-bar"
                  style={{
                    width: `${Math.min(100, myRank.threshold === 0 && myRank.countToNext > 0 ? (myTotalCount / myRank.countToNext) * 100 : ((myTotalCount - myRank.threshold) / (myRank.countToNext + myTotalCount - myRank.threshold)) * 100)}%`,
                    background: myRank.color,
                  }}
                />
                <span className="leaderboard-progress-text">
                  {myRank.countToNext} to {myRank.nextBadge} {myRank.nextRank}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Join CTA / Toggle */}
        {isGoogleAuth ? (
          <button className="leaderboard-cta" onClick={handleToggle}>
            {isOptedIn ? '🛡️ LEAVE THE BOARD' : '🛡️ JOIN THE BOARD'}
          </button>
        ) : (
          <div className="leaderboard-hint">
            Sign in with Google to join the leaderboard
          </div>
        )}
      </main>

      <footer className="settings-footer">
        <p>CNTEM'UP &copy; 2026</p>
      </footer>
    </div>
  )
}
