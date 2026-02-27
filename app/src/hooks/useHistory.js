import { useState, useEffect, useCallback } from 'react'
import { supabase, supabaseEnabled } from '../lib/supabase'

const SESSIONS_KEY = 'cntemup_sessions'

// Fetch session history — last 45 days, ordered by date
export function useHistory(userId, isLocal) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchSessions = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      if (supabaseEnabled && !isLocal && userId) {
        // Supabase — last 45 days
        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() - 45)

        const { data, error: fetchError } = await supabase
          .from('counting_sessions')
          .select('*')
          .eq('user_id', userId)
          .gte('created_at', cutoff.toISOString())
          .order('created_at', { ascending: false })

        if (fetchError) throw fetchError
        setSessions(data || [])
      } else {
        // Local — read from localStorage
        const stored = JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]')
        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() - 45)
        const filtered = stored
          .filter(s => new Date(s.created_at) >= cutoff)
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        setSessions(filtered)
      }
    } catch (err) {
      setError(err.message)
      setSessions([])
    } finally {
      setLoading(false)
    }
  }, [userId, isLocal])

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  // Summary stats
  const stats = {
    totalSessions: sessions.length,
    totalBottles: sessions.reduce((sum, s) => sum + (s.count || 0), 0),
    totalEarnings: sessions.reduce((sum, s) => sum + (parseFloat(s.deposit_value) || 0), 0),
  }

  return { sessions, stats, loading, error, refresh: fetchSessions }
}
