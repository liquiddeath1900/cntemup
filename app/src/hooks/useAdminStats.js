import { useState, useEffect, useCallback, useRef } from 'react'

// Fetch admin dashboard stats from serverless API
// Auto-refreshes every 30 seconds
export function useAdminStats(adminEmail) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const hasFetched = useRef(false)

  const fetchStats = useCallback(async () => {
    if (!adminEmail) return
    // Only show loading spinner on first fetch, not auto-refreshes
    if (!hasFetched.current) setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin-stats?email=${encodeURIComponent(adminEmail)}`)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      setStats(data)
      hasFetched.current = true
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [adminEmail])

  useEffect(() => {
    fetchStats()
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000)
    return () => clearInterval(interval)
  }, [fetchStats])

  return { stats, loading, error, refresh: fetchStats }
}
