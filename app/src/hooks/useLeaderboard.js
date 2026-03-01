import { useState, useEffect, useCallback, useRef } from 'react'

// Fetch leaderboard data — auto-refresh every 60s
// In dev mode, uses ?demo=true so you can test with zero real users
export function useLeaderboard() {
  const [rankings, setRankings] = useState([])
  const [globalStats, setGlobalStats] = useState({ totalBottles: 0, totalCounters: 0 })
  const [isDemo, setIsDemo] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const hasFetched = useRef(false)

  const fetchLeaderboard = useCallback(async () => {
    if (!hasFetched.current) setLoading(true)
    setError(null)

    try {
      // In dev, always show demo data so you can test the UI
      const isDev = import.meta.env.DEV
      const url = isDev ? '/api/leaderboard?demo=true' : '/api/leaderboard'

      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()

      setRankings(data.rankings || [])
      setGlobalStats(data.globalStats || { totalBottles: 0, totalCounters: 0 })
      setIsDemo(data.isDemo || false)
      hasFetched.current = true
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLeaderboard()
    const interval = setInterval(fetchLeaderboard, 60000)
    return () => clearInterval(interval)
  }, [fetchLeaderboard])

  return { rankings, globalStats, isDemo, loading, error, refresh: fetchLeaderboard }
}
