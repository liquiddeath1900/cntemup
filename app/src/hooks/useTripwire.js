import { useState, useRef, useCallback, useEffect } from 'react'

// Frame-differencing tripwire — counts items crossing a horizontal line
// No ML needed. Compares grayscale pixel strips between frames.
export function useTripwire() {
  const [tripwireY, setTripwireY] = useState(0.5) // 0-1 normalized position
  const [isTriggered, setIsTriggered] = useState(false)
  const [triggerCount, setTriggerCount] = useState(0)
  const [isRunning, setIsRunning] = useState(false)

  const prevStripRef = useRef(null)
  const rafRef = useRef(null)
  const cooldownRef = useRef(false)
  const canvasRef = useRef(null) // offscreen canvas for pixel reads
  const lastFrameTime = useRef(0)
  const onTriggerRef = useRef(null) // callback when tripwire fires

  // Pixel diff config
  const STRIP_HEIGHT = 30      // px tall strip around tripwire line
  const CHANGE_THRESHOLD = 30  // min pixel value delta to count as "changed"
  const TRIGGER_PERCENT = 0.15 // 15% of pixels must change to trigger
  const COOLDOWN_MS = 400      // ms between triggers
  const TARGET_FPS = 20        // ~50ms between frames

  // Set external trigger callback
  const setOnTrigger = useCallback((fn) => {
    onTriggerRef.current = fn
  }, [])

  // Grab grayscale strip from video at tripwire Y position
  const getStrip = useCallback((video) => {
    if (!video || video.videoWidth === 0) return null

    const w = video.videoWidth
    const h = video.videoHeight

    // Lazy-init offscreen canvas
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas')
    }
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    // Only draw the strip region (fast)
    const stripY = Math.max(0, Math.floor(h * tripwireY) - STRIP_HEIGHT / 2)
    const stripH = Math.min(STRIP_HEIGHT, h - stripY)
    canvas.width = w
    canvas.height = stripH

    ctx.drawImage(video, 0, stripY, w, stripH, 0, 0, w, stripH)
    const imageData = ctx.getImageData(0, 0, w, stripH)
    const data = imageData.data

    // Convert to grayscale (single channel)
    const gray = new Uint8Array(w * stripH)
    for (let i = 0; i < gray.length; i++) {
      const p = i * 4
      gray[i] = Math.round(data[p] * 0.299 + data[p + 1] * 0.587 + data[p + 2] * 0.114)
    }
    return gray
  }, [tripwireY])

  // Compare two grayscale strips — returns fraction of changed pixels
  const compareStrips = useCallback((prev, curr) => {
    if (!prev || !curr || prev.length !== curr.length) return 0
    let changed = 0
    for (let i = 0; i < prev.length; i++) {
      if (Math.abs(prev[i] - curr[i]) > CHANGE_THRESHOLD) {
        changed++
      }
    }
    return changed / prev.length
  }, [])

  // Main detection loop
  const processFrame = useCallback((video, timestamp) => {
    if (!isRunning) return

    // Throttle to TARGET_FPS
    const elapsed = timestamp - lastFrameTime.current
    if (elapsed < 1000 / TARGET_FPS) {
      rafRef.current = requestAnimationFrame((ts) => processFrame(video, ts))
      return
    }
    lastFrameTime.current = timestamp

    const currentStrip = getStrip(video)
    if (currentStrip && prevStripRef.current) {
      const changeFraction = compareStrips(prevStripRef.current, currentStrip)

      if (changeFraction >= TRIGGER_PERCENT && !cooldownRef.current) {
        // TRIGGERED
        cooldownRef.current = true
        setIsTriggered(true)
        setTriggerCount(prev => prev + 1)
        onTriggerRef.current?.()

        // Flash duration
        setTimeout(() => setIsTriggered(false), 200)

        // Cooldown prevents double-count
        setTimeout(() => {
          cooldownRef.current = false
        }, COOLDOWN_MS)
      }
    }
    prevStripRef.current = currentStrip

    rafRef.current = requestAnimationFrame((ts) => processFrame(video, ts))
  }, [isRunning, getStrip, compareStrips])

  // Start tripwire detection on a video element
  const startTripwire = useCallback((video) => {
    prevStripRef.current = null
    cooldownRef.current = false
    lastFrameTime.current = 0
    setIsRunning(true)

    // Kick off the rAF loop
    rafRef.current = requestAnimationFrame((ts) => processFrame(video, ts))
  }, [processFrame])

  // Stop tripwire detection
  const stopTripwire = useCallback(() => {
    setIsRunning(false)
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    prevStripRef.current = null
    cooldownRef.current = false
  }, [])

  // Reset count
  const resetCount = useCallback(() => {
    setTriggerCount(0)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
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
  }
}
