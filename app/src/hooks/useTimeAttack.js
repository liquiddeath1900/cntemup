import { useState, useRef, useCallback, useEffect } from 'react'

// Time Attack — count as many as you can in 30 seconds.
// Phases: idle → arming (camera starting) → countdown (3-2-1) → running → done
// The 3-second countdown doubles as detector warmup, so the first real drop counts.

const BEST_KEY = 'cntemup_timeattack_best'
export const TIME_ATTACK_SECONDS = 30
const COUNTDOWN_FROM = 3

function readBest() {
  try {
    return parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0
  } catch {
    return 0
  }
}

export function useTimeAttack({ onTick, onFinish } = {}) {
  const [phase, setPhaseState] = useState('idle')
  const [countdown, setCountdown] = useState(COUNTDOWN_FROM)
  const [secondsLeft, setSecondsLeft] = useState(TIME_ATTACK_SECONDS)
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(readBest)
  const [isRecord, setIsRecord] = useState(false)

  // Refs mirror state for the detector callback and timers, which outlive renders
  const phaseRef = useRef('idle')
  const scoreRef = useRef(0)
  const timerRef = useRef(null)
  const callbacksRef = useRef({ onTick, onFinish })
  useEffect(() => {
    callbacksRef.current = { onTick, onFinish }
  })

  const setPhase = useCallback((next) => {
    phaseRef.current = next
    setPhaseState(next)
  }, [])

  const clearTimer = useCallback(() => {
    clearInterval(timerRef.current)
    timerRef.current = null
  }, [])

  const finish = useCallback(() => {
    clearTimer()
    const finalScore = scoreRef.current
    const previousBest = readBest()
    const record = finalScore > previousBest
    if (record) {
      try {
        localStorage.setItem(BEST_KEY, String(finalScore))
      } catch {
        /* storage unavailable — record just isn't remembered */
      }
      setBest(finalScore)
    }
    setIsRecord(record)
    setPhase('done')
    callbacksRef.current.onFinish?.(finalScore, record)
  }, [clearTimer, setPhase])

  const run = useCallback(() => {
    const endsAt = Date.now() + TIME_ATTACK_SECONDS * 1000
    let lastShown = TIME_ATTACK_SECONDS
    setSecondsLeft(TIME_ATTACK_SECONDS)
    setPhase('running')
    timerRef.current = setInterval(() => {
      const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
      if (left !== lastShown) {
        lastShown = left
        setSecondsLeft(left)
        if (left > 0 && left <= 5) callbacksRef.current.onTick?.()
      }
      if (left === 0) finish()
    }, 100)
  }, [finish, setPhase])

  // Step 1: called on tap, before the camera is up
  const arm = useCallback(() => {
    clearTimer()
    scoreRef.current = 0
    setScore(0)
    setIsRecord(false)
    setCountdown(COUNTDOWN_FROM)
    setPhase('arming')
  }, [clearTimer, setPhase])

  // Step 2: called once video is live
  const startCountdown = useCallback(() => {
    if (phaseRef.current !== 'arming') return
    let n = COUNTDOWN_FROM
    setCountdown(n)
    setPhase('countdown')
    callbacksRef.current.onTick?.()
    timerRef.current = setInterval(() => {
      n -= 1
      if (n > 0) {
        setCountdown(n)
        callbacksRef.current.onTick?.()
      } else {
        clearTimer()
        run()
      }
    }, 1000)
  }, [clearTimer, run, setPhase])

  // Detector hit. Only counts while the clock is running; returns whether it counted.
  const registerHit = useCallback(() => {
    if (phaseRef.current !== 'running') return false
    scoreRef.current += 1
    setScore(scoreRef.current)
    return true
  }, [])

  const reset = useCallback(() => {
    clearTimer()
    setPhase('idle')
  }, [clearTimer, setPhase])

  useEffect(() => clearTimer, [clearTimer])

  return { phase, phaseRef, countdown, secondsLeft, score, best, isRecord, arm, startCountdown, registerHit, reset }
}
