import { useState, useEffect, useCallback, useRef } from 'react'

// Demo fallback for local dev (Vercel API routes don't run in vite dev)
const DEMO_FALLBACK = {
  rankings: [
    { display_name: 'BottleKing_NYC', total_count: 27340, is_premium: true, is_verified: true },
    { display_name: 'EcoWarrior', total_count: 14200, is_premium: true, is_verified: false },
    { display_name: 'CanCrusher99', total_count: 8750, is_premium: false, is_verified: true },
    { display_name: 'GreenMachine', total_count: 5100, is_premium: true, is_verified: false },
    { display_name: 'RecycleQueen', total_count: 3400, is_premium: false, is_verified: false },
  ],
  globalStats: { totalBottles: 63860, totalCounters: 10 },
  isDemo: true,
}

// Fetch leaderboard data — auto-refresh every 60s
// Supports period: 'weekly' (default) or 'alltime'
export function useLeaderboard(period = 'weekly', enabled = true) {
  const [rankings, setRankings] = useState([])
  const [globalStats, setGlobalStats] = useState({ totalBottles: 0, totalCounters: 0 })
  const [isDemo, setIsDemo] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const hasFetched = useRef(false)

  const fetchLeaderboard = useCallback(async () => {
    if (!enabled) {
      setRankings([])
      setGlobalStats({ totalBottles: 0, totalCounters: 0 })
      setIsDemo(false)
      setLoading(false)
      return
    }
    if (!hasFetched.current) setLoading(true)
    setError(null)

    try {
      const url = `/api/leaderboard?period=${period}`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const contentType = res.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) {
        // Vite dev serves raw JS — fall back to demo data
        throw new Error('NOT_JSON')
      }

      const data = await res.json()
      setRankings(data.rankings || [])
      setGlobalStats(data.globalStats || { totalBottles: 0, totalCounters: 0 })
      setIsDemo(data.isDemo || false)
      hasFetched.current = true
    } catch (err) {
      // In dev, API routes don't exist — use demo fallback silently
      if (import.meta.env.DEV) {
        setRankings(DEMO_FALLBACK.rankings)
        setGlobalStats(DEMO_FALLBACK.globalStats)
        setIsDemo(true)
        hasFetched.current = true
      } else {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }, [period, enabled])

  useEffect(() => {
    hasFetched.current = false
    fetchLeaderboard()
    const interval = setInterval(fetchLeaderboard, 60000)
    return () => clearInterval(interval)
  }, [fetchLeaderboard])

  return { rankings, globalStats, isDemo, loading, error, refresh: fetchLeaderboard }
}
