import { useState, useRef, useCallback, useEffect } from 'react'

// Beam-occlusion detector — software photoelectric tripwire.
//
// One horizontal strip at tripwireY. Each frame compute mean luminance, compare to
// a rolling baseline. A bottle passing through OCCLUDES the strip → luminance drops
// sharply → recovers when the bottle exits. Count one event per dip-then-recover.
//
// Why this approach: pixel-diff motion detectors (V1/V2/V3) fire on any change
// — AE hunt, shadows, camera shake. Beam-occlusion tracks signal SHAPE (V-curve),
// which is invariant to absolute lighting level once the baseline adapts. Matches
// the physical thing happening (light blocked, light restored). Paired with
// camera-lock in useCamera.js to keep the baseline stable.
export function useBeamOcclusion() {
  const [tripwireY, setTripwireY] = useState(0.5)
  const [isTriggered, setIsTriggered] = useState(false)
  const [triggerCount, setTriggerCount] = useState(0)
  const [isRunning, setIsRunning] = useState(false)

  // Diagnostics for dev overlay
  const [baselineValue, setBaselineValue] = useState(0)
  const [currentValue, setCurrentValue] = useState(0)
  const [dipDepth, setDipDepth] = useState(0)

  const rafRef = useRef(null)
  const canvasRef = useRef(null)
  const lastFrameTime = useRef(0)
  const onTriggerRef = useRef(null)

  // Rolling baseline (exponential moving average of luminance when idle)
  const baselineRef = useRef(null)
  // State machine: 'idle' | 'occluded'
  const stateRef = useRef('idle')
  // Deepest dip seen during current occlusion
  const dipMinRef = useRef(null)
  // Last fire time for cooldown
  const lastFireAtRef = useRef(0)

  // ── Config ──────────────────────────────────────────────────────
  const STRIP_HEIGHT = 6                 // px tall — a few rows for noise robustness, not 1
  const TARGET_FPS = 60                  // request the camera's max; loop will skip if frame not new
  const DROP_THRESHOLD = 0.10            // 10% below baseline = enter occlusion
  const RECOVER_THRESHOLD = 0.05         // back within 5% of baseline = recovered → count
  const BASELINE_ALPHA = 0.05            // EMA factor when idle (~2-3s convergence at 30fps)
  const GLOBAL_COOLDOWN_MS = 200         // one bottle = one count
  const WARMUP_FRAMES = 15               // ~0.5s — let baseline settle before we count

  const setOnTrigger = useCallback((fn) => {
    onTriggerRef.current = fn
  }, [])

  const getCanvas = useCallback(() => {
    if (!canvasRef.current) canvasRef.current = document.createElement('canvas')
    return canvasRef.current
  }, [])

  // Mean luminance of a horizontal strip from the video.
  // Rec. 601: Y = 0.299R + 0.587G + 0.114B — standard perceptual luminance.
  const getStripLuminance = useCallback((video, sy, sw, sh) => {
    if (!video || video.videoWidth === 0) return null
    const canvas = getCanvas()
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    canvas.width = sw
    canvas.height = sh
    ctx.drawImage(video, 0, sy, sw, sh, 0, 0, sw, sh)
    const { data } = ctx.getImageData(0, 0, sw, sh)
    let sum = 0
    const pixels = data.length / 4
    for (let i = 0; i < data.length; i += 4) {
      sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    }
    return sum / pixels
  }, [getCanvas])

  const warmupCountRef = useRef(0)
  const processFrameRef = useRef(null)

  const processFrame = useCallback((video, timestamp) => {
    if (!isRunning) return

    const elapsed = timestamp - lastFrameTime.current
    if (elapsed < 1000 / TARGET_FPS) {
      rafRef.current = requestAnimationFrame((ts) => processFrameRef.current(video, ts))
      return
    }
    lastFrameTime.current = timestamp

    const w = video.videoWidth
    const h = video.videoHeight
    if (!w || !h) {
      rafRef.current = requestAnimationFrame((ts) => processFrameRef.current(video, ts))
      return
    }

    const y = Math.max(0, Math.floor(h * tripwireY) - STRIP_HEIGHT / 2)
    const sh = Math.min(STRIP_HEIGHT, h - y)
    const luminance = getStripLuminance(video, y, w, sh)
    if (luminance === null) {
      rafRef.current = requestAnimationFrame((ts) => processFrameRef.current(video, ts))
      return
    }

    setCurrentValue(luminance)

    // Bootstrap the baseline on first valid frame
    if (baselineRef.current === null) {
      baselineRef.current = luminance
      warmupCountRef.current = 1
      setBaselineValue(luminance)
      rafRef.current = requestAnimationFrame((ts) => processFrameRef.current(video, ts))
      return
    }

    // Warmup window — adapt baseline aggressively, don't count
    if (warmupCountRef.current < WARMUP_FRAMES) {
      baselineRef.current = baselineRef.current * (1 - 0.2) + luminance * 0.2
      warmupCountRef.current++
      setBaselineValue(baselineRef.current)
      rafRef.current = requestAnimationFrame((ts) => processFrameRef.current(video, ts))
      return
    }

    const baseline = baselineRef.current
    const dropPct = baseline > 0 ? (baseline - luminance) / baseline : 0

    if (stateRef.current === 'idle') {
      if (dropPct > DROP_THRESHOLD) {
        // Enter occlusion — bottle just started blocking the beam
        stateRef.current = 'occluded'
        dipMinRef.current = luminance
        setDipDepth(dropPct)
      } else {
        // Adapt baseline (idle only — never drift during an occlusion)
        baselineRef.current = baseline * (1 - BASELINE_ALPHA) + luminance * BASELINE_ALPHA
        setBaselineValue(baselineRef.current)
      }
    } else {
      // Occluded — track the deepest point, watch for recovery
      if (luminance < dipMinRef.current) {
        dipMinRef.current = luminance
        setDipDepth((baseline - luminance) / baseline)
      }
      if (dropPct < RECOVER_THRESHOLD) {
        // Beam restored — bottle has passed
        const now = timestamp
        if (now - lastFireAtRef.current >= GLOBAL_COOLDOWN_MS) {
          lastFireAtRef.current = now
          setTriggerCount(n => n + 1)
          onTriggerRef.current?.()
          setIsTriggered(true)
          setTimeout(() => setIsTriggered(false), 200)
        }
        stateRef.current = 'idle'
        dipMinRef.current = null
      }
    }

    rafRef.current = requestAnimationFrame((ts) => processFrameRef.current(video, ts))
  }, [isRunning, tripwireY, getStripLuminance])

  useEffect(() => {
    processFrameRef.current = processFrame
  }, [processFrame])

  const startTripwire = useCallback((video) => {
    baselineRef.current = null
    stateRef.current = 'idle'
    dipMinRef.current = null
    lastFireAtRef.current = 0
    lastFrameTime.current = 0
    warmupCountRef.current = 0
    setIsRunning(true)
    rafRef.current = requestAnimationFrame((ts) => processFrameRef.current(video, ts))
  }, [])

  const stopTripwire = useCallback(() => {
    setIsRunning(false)
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    baselineRef.current = null
    stateRef.current = 'idle'
    dipMinRef.current = null
  }, [])

  const resetCount = useCallback(() => {
    setTriggerCount(0)
  }, [])

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return {
    startTripwire,
    stopTripwire,
    tripwireY,
    setTripwireY,
    isTriggered,
    triggerCount,
    resetCount,
    isRunning,
    setOnTrigger,
    // Diagnostics
    baselineValue,
    currentValue,
    dipDepth,
    // Back-compat fields the V3 overlay reads — unused for beam, return zeros
    shakeRejects: 0,
    expiredPrimes: 0,
    upwardRejects: 0,
    gateHalfOffset: 0,
  }
}
