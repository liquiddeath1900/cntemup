import { useState, useRef, useCallback } from 'react'

// Retro Game Boy-style sound effects using Web Audio API
// No external files needed — generates beeps procedurally

let audioCtx = null

function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  }
  // Resume if suspended (iOS requires user gesture)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume()
  }
  return audioCtx
}

// Play a retro beep — frequency + duration + waveform
function playTone(freq, duration = 0.08, type = 'square', volume = 0.3) {
  try {
    const ctx = getAudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = type // 'square' = classic Game Boy sound
    osc.frequency.setValueAtTime(freq, ctx.currentTime)

    // Quick attack, quick release for that 8-bit feel
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.005)
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + duration + 0.01)
  } catch {
    // Audio not supported or blocked — fail silently
  }
}

// Count beep — short high chirp (like coin pickup)
export function playCountBeep() {
  playTone(880, 0.06, 'square', 0.25)    // A5
  setTimeout(() => {
    playTone(1175, 0.08, 'square', 0.2)  // D6 (quick ascending double beep)
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

  return { muted, toggleMute, playCount, playError, playSuccess }
}
