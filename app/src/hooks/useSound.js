import { useState, useRef, useCallback, useEffect } from 'react'
import { DEFAULT_THEME, getTheme } from '../lib/themes'

// useSound — public API is unchanged (muted, toggleMute, playCount, playError,
// playSuccess, playBoot, playAlarm). Internally each play call routes through
// the currently active theme's sound profile, read from localStorage on every
// invocation (so theme changes in Settings take effect instantly, even though
// the hook is mounted once at the App level).
//
// Legacy exports (playCountBeep, playAlarmBeep, etc.) are kept for any
// importers that bypass the hook — they always play the Game Boy profile.

const MUTE_KEY = 'cntemup_muted'
const THEME_KEY = 'cntemup_theme'

function activeThemeSounds() {
  let id = DEFAULT_THEME
  try {
    id = localStorage.getItem(THEME_KEY) || DEFAULT_THEME
  } catch {
    /* storage unavailable — fall back to default */
  }
  return getTheme(id).sounds
}

export function playCountBeep() {
  getTheme('gameboy').sounds.count()
}

export function playErrorBeep() {
  getTheme('gameboy').sounds.error()
}

export function playSuccessBeep() {
  getTheme('gameboy').sounds.success()
}

export function playAlarmBeep() {
  getTheme('gameboy').sounds.alarm()
}

export function playBootChime() {
  getTheme('gameboy').sounds.boot()
}

export function useSound() {
  const [muted, setMuted] = useState(() => {
    try {
      return localStorage.getItem(MUTE_KEY) === 'true'
    } catch {
      return false
    }
  })
  const mutedRef = useRef(muted)

  // Re-read the theme on every fire — supports live theme swaps from Settings
  // without remounting the entire app tree.
  const themeIdRef = useRef(DEFAULT_THEME)
  useEffect(() => {
    const sync = () => {
      try {
        themeIdRef.current = localStorage.getItem(THEME_KEY) || DEFAULT_THEME
      } catch {
        themeIdRef.current = DEFAULT_THEME
      }
    }
    sync()
    window.addEventListener('storage', sync)
    window.addEventListener('cntemup-theme-change', sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener('cntemup-theme-change', sync)
    }
  }, [])

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev
      mutedRef.current = next
      try {
        localStorage.setItem(MUTE_KEY, String(next))
      } catch {
        /* storage unavailable */
      }
      return next
    })
  }, [])

  const playCount = useCallback(() => {
    if (!mutedRef.current) activeThemeSounds().count()
  }, [])

  const playError = useCallback(() => {
    if (!mutedRef.current) activeThemeSounds().error()
  }, [])

  const playSuccess = useCallback(() => {
    if (!mutedRef.current) activeThemeSounds().success()
  }, [])

  const playBoot = useCallback(() => {
    if (!mutedRef.current) activeThemeSounds().boot()
  }, [])

  const playAlarm = useCallback(() => {
    if (!mutedRef.current) activeThemeSounds().alarm()
  }, [])

  return { muted, toggleMute, playCount, playError, playSuccess, playBoot, playAlarm }
}
