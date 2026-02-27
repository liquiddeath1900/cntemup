import { useState, useEffect, useCallback, useContext, createContext } from 'react'
import { supabase, supabaseEnabled } from '../lib/supabase'

const STORAGE_KEY = 'cntemup_profile'

// Default local profile
function getLocalProfile() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored)
  } catch {}
  return null
}

function saveLocalProfile(profile) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
}

// Shared auth context — all components see the same state
const AuthContext = createContext(null)

// Provider — wrap your app with this once
export function AuthProvider({ children }) {
  const auth = useAuthInternal()
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
}

// Hook — reads from shared context
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (ctx) return ctx
  // Fallback for components outside provider (shouldn't happen)
  return useAuthInternal()
}

// Internal hook — the actual logic (only runs once inside AuthProvider)
function useAuthInternal() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // --- LOCAL MODE (default) ---
  const initLocal = useCallback(() => {
    const localProfile = getLocalProfile()
    if (localProfile) {
      setUser({ id: 'local', email: 'local' })
      setProfile(localProfile)
    }
    setLoading(false)
  }, [])

  // Quick setup — just pick a state and go
  const setupLocal = useCallback((stateCode, displayName = 'Counter') => {
    const prof = {
      user_id: 'local',
      display_name: displayName,
      full_name: displayName,
      state_code: stateCode,
      is_premium: false,
      alert_target: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    saveLocalProfile(prof)
    setUser({ id: 'local', email: 'local' })
    setProfile(prof)
    return prof
  }, [])

  const updateState = useCallback(async (stateCode) => {
    if (supabaseEnabled && user?.id !== 'local') {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .upsert({
            user_id: user.id,
            state_code: stateCode,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' })
          .select()
          .single()
        if (error) throw error
        setProfile(data)
      } catch (err) {
        setError(err.message)
      }
    } else {
      setProfile(prev => {
        const updated = { ...prev, state_code: stateCode, updated_at: new Date().toISOString() }
        saveLocalProfile(updated)
        return updated
      })
    }
  }, [user])

  const updateAlertTarget = useCallback(async (target) => {
    const numTarget = parseInt(target, 10) || 0
    if (supabaseEnabled && user?.id !== 'local') {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .update({ alert_target: numTarget, updated_at: new Date().toISOString() })
          .eq('user_id', user.id)
          .select()
          .single()
        if (error) throw error
        setProfile(data)
      } catch (err) {
        setError(err.message)
      }
    } else {
      setProfile(prev => {
        const updated = { ...prev, alert_target: numTarget, updated_at: new Date().toISOString() }
        saveLocalProfile(updated)
        return updated
      })
    }
  }, [user])

  // Re-fetch profile from Supabase (used after Stripe payment)
  const refreshProfile = useCallback(async () => {
    if (!supabaseEnabled || !user || user.id === 'local') return null
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()
    if (data) setProfile(data)
    return data
  }, [user])

  const signOut = useCallback(async () => {
    if (supabaseEnabled && supabase) {
      await supabase.auth.signOut()
    }
    setUser(null)
    setProfile(null)
  }, [])

  // --- SUPABASE MODE (optional upgrade) ---
  const signUp = useCallback(async (email, password, stateCode, displayName) => {
    if (!supabaseEnabled) return setupLocal(stateCode, displayName)
    try {
      setError(null)
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) throw error
      if (data.user) {
        await supabase.from('profiles').upsert({
          user_id: data.user.id,
          display_name: displayName || email.split('@')[0],
          full_name: displayName || email.split('@')[0],
          state_code: stateCode,
        }, { onConflict: 'user_id' })
      }
      return data
    } catch (err) {
      setError(err.message)
      return null
    }
  }, [setupLocal])

  const signIn = useCallback(async (email, password) => {
    if (!supabaseEnabled) return null
    try {
      setError(null)
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      return data
    } catch (err) {
      setError(err.message)
      return null
    }
  }, [])

  const signInWithGoogle = useCallback(async () => {
    if (!supabaseEnabled) return
    try {
      setError(null)
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      })
      if (error) throw error
    } catch (err) {
      setError(err.message)
    }
  }, [])

  // Init on mount
  useEffect(() => {
    if (!supabaseEnabled) {
      initLocal()
      return
    }

    const timeout = setTimeout(() => {
      if (loading) {
        console.warn('[Auth] Supabase timeout, falling back to local')
        initLocal()
      }
    }, 3000)

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      clearTimeout(timeout)
      const currentUser = session?.user ?? null
      if (currentUser) {
        setUser(currentUser)
        // Await profile before clearing loading — prevents flash of non-premium state
        const { data } = await supabase.from('profiles').select('*').eq('user_id', currentUser.id).single()
        setProfile(data)
        setLoading(false)
      } else {
        // No Supabase session — fall back to local
        initLocal()
      }
    }).catch(() => {
      clearTimeout(timeout)
      initLocal()
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const currentUser = session?.user ?? null
        if (currentUser) {
          setUser(currentUser)
          const { data } = await supabase.from('profiles').select('*')
            .eq('user_id', currentUser.id).single()
          setProfile(data)
        }
        // If no Supabase session, don't wipe local profile —
        // local mode is already set up via initLocal/setupLocal
      }
    )

    return () => subscription.unsubscribe()
  }, [initLocal])

  return {
    user,
    profile,
    loading,
    error,
    isLocal: !supabaseEnabled || user?.id === 'local',
    setupLocal,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    refreshProfile,
    updateState,
    updateAlertTarget,
  }
}
