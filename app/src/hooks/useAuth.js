import { useState, useEffect, useCallback } from 'react'
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

// Auth hook — local-first with optional Supabase upgrade
export function useAuth() {
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
      state_code: stateCode,
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
      // Supabase mode
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
      // Local mode
      const updated = { ...profile, state_code: stateCode, updated_at: new Date().toISOString() }
      saveLocalProfile(updated)
      setProfile(updated)
    }
  }, [user, profile])

  const signOut = useCallback(async () => {
    if (supabaseEnabled && supabase) {
      await supabase.auth.signOut()
    }
    localStorage.removeItem(STORAGE_KEY)
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

    // Supabase auth listener
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null
      setUser(currentUser)
      if (currentUser) {
        supabase.from('profiles').select('*').eq('user_id', currentUser.id).single()
          .then(({ data }) => setProfile(data))
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const currentUser = session?.user ?? null
        setUser(currentUser)
        if (currentUser) {
          const { data } = await supabase.from('profiles').select('*')
            .eq('user_id', currentUser.id).single()
          setProfile(data)
        } else {
          setProfile(null)
        }
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
    updateState,
  }
}
