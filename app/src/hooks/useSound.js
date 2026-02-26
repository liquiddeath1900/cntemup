import { useState, useRef, useCallback } from 'react'

// Retro Game Boy-style sound effects using Web Audio API
// No external files needed — generates beeps procedurally

// iOS Safari requires AudioContext to be created AND resumed inside a user gesture.
// We create a fresh context each time to guarantee playback on mobile.
function createAudioCtx() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

// Play a retro beep — frequency + duration + waveform
function playTone(freq, duration = 0.08, type = 'square', volume = 0.3, ctx = null) {
  try {
    const audioCtx = ctx || createAudioCtx()
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()

    osc.type = type // 'square' = classic Game Boy sound
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime)

    // Quick attack, quick release for that 8-bit feel
    gain.gain.setValueAtTime(0, audioCtx.currentTime)
    gain.gain.linearRampToValueAtTime(volume, audioCtx.currentTime + 0.005)
    gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + duration)

    osc.connect(gain)
    gain.connect(audioCtx.destination)
    osc.start(audioCtx.currentTime)
    osc.stop(audioCtx.currentTime + duration + 0.01)
  } catch {
    // Audio not supported or blocked — fail silently
  }
}

// Count beep — short high chirp (like coin pickup)
export function playCountBeep() {
  const ctx = createAudioCtx()
  playTone(880, 0.06, 'square', 0.25, ctx)    // A5
  setTimeout(() => {
    playTone(1175, 0.08, 'square', 0.2, ctx)  // D6 (quick ascending double beep)
  }, 60)
}

// Error beep — low buzz
export function playErrorBeep() {
  playTone(220, 0.15, 'square', 0.2)
}

// Success beep — ascending triad
export function playSuccessBeep() {
  playTone(523, 0.08, 'square', 0.2)   // C5
  setTimeout(() => playTone(659, 0.08, 'square', 0.2), 80)  // E5
  setTimeout(() => playTone(784, 0.12, 'square', 0.2), 160) // G5
}

// Game Boy boot chime — uses same playTone pattern that works on iOS
export function playBootChime() {
  const ctx = createAudioCtx()
  playTone(262, 0.1, 'square', 0.3, ctx)          // C4 — low ping
  setTimeout(() => {
    playTone(523, 0.3, 'square', 0.35, ctx)        // C5 — high ding!
  }, 120)
}

// Hook for mute state
const MUTE_KEY = 'cntemup_muted'

export function useSound() {
  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem(MUTE_KEY) === 'true' } catch { return false }
  })
  const mutedRef = useRef(muted)

  const toggleMute = useCallback(() => {
    setMuted(prev => {
      const next = !prev
      mutedRef.current = next
      try { localStorage.setItem(MUTE_KEY, String(next)) } catch {}
      return next
    })
  }, [])

  const playCount = useCallback(() => {
    if (!mutedRef.current) playCountBeep()
  }, [])

  const playError = useCallback(() => {
    if (!mutedRef.current) playErrorBeep()
  }, [])

  const playSuccess = useCallback(() => {
    if (!mutedRef.current) playSuccessBeep()
  }, [])

  const playBoot = useCallback(() => {
    if (!mutedRef.current) playBootChime()
  }, [])

  return { muted, toggleMute, playCount, playError, playSuccess, playBoot }
}
