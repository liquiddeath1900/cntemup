import { useEffect, useState, useCallback } from 'react'
import { DEFAULT_THEME, getTheme } from '../lib/themes'

const THEME_KEY = 'cntemup_theme'

// Read/write the active theme id. Persists in localStorage so the
// choice survives reloads. Applies data-theme to <html> so theme-scoped
// CSS overrides activate without a re-render storm.
export function useTheme() {
  const [themeId, setThemeId] = useState(() => {
    try {
      return localStorage.getItem(THEME_KEY) || DEFAULT_THEME
    } catch {
      return DEFAULT_THEME
    }
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeId)
  }, [themeId])

  const setTheme = useCallback((id) => {
    setThemeId(id)
    try {
      localStorage.setItem(THEME_KEY, id)
    } catch {
      /* storage unavailable */
    }
  }, [])

  return {
    themeId,
    theme: getTheme(themeId),
    setTheme,
  }
}
