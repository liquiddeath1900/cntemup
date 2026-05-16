import { useState, useRef, useCallback, useEffect } from 'react'

// Tripwire V2 — prototype with shake rejection, direction confirmation, RGB diff.
// Same public API as useTripwire so App.jsx can run both in parallel and compare.
export function useTripwireV2() {
  const [tripwireY, setTripwireY] = useState(0.5)
  const [isTriggered, setIsTriggered] = useState(false)
  const [triggerCount, setTriggerCount] = useState(0)
  const [isRunning, setIsRunning] = useState(false)

  // Diagnostics for the dev overlay
  const [shakeRejects, setShakeRejects] = useState(0)
  const [directionRejects, setDirectionRejects] = useState(0)

  const rafRef = useRef(null)
  const cooldownRef = useRef(false)
  const canvasRef = useRef(null)
  const lastFrameTime = useRef(0)
  const onTriggerRef = useRef(null)

  const prevLineRef = useRef(null)
  const prevTopRef = useRef(null)
  const prevBottomRef = useRef(null)
  const prevCornerRef = useRef(null)
  const changeHistoryRef = useRef([]) // last N frames of { top, bottom }

  // ── Config ──────────────────────────────────────────────────────
  const STRIP_HEIGHT = 30        // px tall strip
  const NEIGHBOR_OFFSET = 0.08   // top/bottom strips 8% of frame above/below line
  const CHANGE_THRESHOLD = 25    // per-channel brightness delta = "changed"
  const TRIGGER_PERCENT = 0.12   // 12% of line strip changed = candidate trigger
  const NEIGHBOR_PERCENT = 0.06  // top/bottom hits at 6% (lower bar than line)
  const COOLDOWN_MS = 200
  const TARGET_FPS = 30
  const CORNER_SIZE = 60         // 60x60 corner patch for shake detection
  const SHAKE_PERCENT = 0.08     // 8% of corner pixels changed = camera moving
  const DIRECTION_LOOKBACK = 4   // frames to look back for neighbor strip activity

  const setOnTrigger = useCallback((fn) => {
    onTriggerRef.current = fn
  }, [])

  // Lazy-init offscreen canvas
  const getCanvas = useCallback(() => {
    if (!canvasRef.current) canvasRef.current = document.createElement('canvas')
    return canvasRef.current
  }, [])

  // Grab a region from the video as a Uint8Array of interleaved R,G,B bytes
  const getRegionRGB = useCallback((video, sx, sy, sw, sh) => {
    if (!video || video.videoWidth === 0) return null
    const canvas = getCanvas()
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    canvas.width = sw
    canvas.height = sh
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh)
    const { data } = ctx.getImageData(0, 0, sw, sh)
    // Pack RGBA → RGB to save memory and skip alpha in diff
    const rgb = new Uint8Array(sw * sh * 3)
    for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
      rgb[j] = data[i]
      rgb[j + 1] = data[i + 1]
      rgb[j + 2] = data[i + 2]
    }
    return rgb
  }, [getCanvas])

  // Compare two RGB buffers — fraction of pixels where max(|ΔR|,|ΔG|,|ΔB|) > threshold
  const compareRGB = useCallback((prev, curr) => {
    if (!prev || !curr || prev.length !== curr.length) return 0
    let changed = 0
    const pixels = prev.length / 3
    for (let p = 0; p < pixels; p++) {
      const i = p * 3
      const dr = Math.abs(prev[i] - curr[i])
      const dg = Math.abs(prev[i + 1] - curr[i + 1])
      const db = Math.abs(prev[i + 2] - curr[i + 2])
      if (Math.max(dr, dg, db) > CHANGE_THRESHOLD) changed++
    }
    return changed / pixels
  }, [])

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

    // Sample 4 regions: corner (shake), top neighbor, line, bottom neighbor
    const lineY = Math.max(0, Math.floor(h * tripwireY) - STRIP_HEIGHT / 2)
    const lineH = Math.min(STRIP_HEIGHT, h - lineY)
    const topY = Math.max(0, Math.floor(h * (tripwireY - NEIGHBOR_OFFSET)) - STRIP_HEIGHT / 2)
    const topH = Math.min(STRIP_HEIGHT, h - topY)
    const botY = Math.max(0, Math.floor(h * (tripwireY + NEIGHBOR_OFFSET)) - STRIP_HEIGHT / 2)
    const botH = Math.min(STRIP_HEIGHT, h - botY)

    const cornerW = Math.min(CORNER_SIZE, w)
    const cornerH = Math.min(CORNER_SIZE, h)

    const currentCorner = getRegionRGB(video, 0, 0, cornerW, cornerH)
    const currentTop = getRegionRGB(video, 0, topY, w, topH)
    const currentLine = getRegionRGB(video, 0, lineY, w, lineH)
    const currentBottom = getRegionRGB(video, 0, botY, w, botH)

    if (currentLine && prevLineRef.current) {
      const cornerChange = compareRGB(prevCornerRef.current, currentCorner)
      const topChange = compareRGB(prevTopRef.current, currentTop)
      const lineChange = compareRGB(prevLineRef.current, currentLine)
      const bottomChange = compareRGB(prevBottomRef.current, currentBottom)

      // Update history
      changeHistoryRef.current.push({ top: topChange, bottom: bottomChange })
      if (changeHistoryRef.current.length > DIRECTION_LOOKBACK) {
        changeHistoryRef.current.shift()
      }

      const isShake = cornerChange > SHAKE_PERCENT
      const lineHit = lineChange >= TRIGGER_PERCENT

      if (lineHit && !cooldownRef.current) {
        if (isShake) {
          setShakeRejects(n => n + 1)
        } else {
          // Direction confirmation: real moving object should show activity
          // in top OR bottom strip within the lookback window
          const directionConfirmed = changeHistoryRef.current.some(
            f => f.top >= NEIGHBOR_PERCENT || f.bottom >= NEIGHBOR_PERCENT
          )

          if (directionConfirmed) {
            cooldownRef.current = true
            setIsTriggered(true)
            setTriggerCount(n => n + 1)
            onTriggerRef.current?.()

            setTimeout(() => setIsTriggered(false), 200)
            setTimeout(() => { cooldownRef.current = false }, COOLDOWN_MS)
          } else {
            setDirectionRejects(n => n + 1)
          }
        }
      }
    }

    prevCornerRef.current = currentCorner
    prevTopRef.current = currentTop
    prevLineRef.current = currentLine
    prevBottomRef.current = currentBottom

    rafRef.current = requestAnimationFrame((ts) => processFrameRef.current(video, ts))
  }, [isRunning, tripwireY, getRegionRGB, compareRGB])

  useEffect(() => {
    processFrameRef.current = processFrame
  }, [processFrame])

  const startTripwire = useCallback((video) => {
    prevCornerRef.current = null
    prevTopRef.current = null
    prevLineRef.current = null
    prevBottomRef.current = null
    changeHistoryRef.current = []
    cooldownRef.current = false
    lastFrameTime.current = 0
    setIsRunning(true)
    rafRef.current = requestAnimationFrame((ts) => processFrameRef.current(video, ts))
  }, [])

  const stopTripwire = useCallback(() => {
    setIsRunning(false)
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    prevCornerRef.current = null
    prevTopRef.current = null
    prevLineRef.current = null
    prevBottomRef.current = null
    changeHistoryRef.current = []
    cooldownRef.current = false
  }, [])

  const resetCount = useCallback(() => {
    setTriggerCount(0)
    setShakeRejects(0)
    setDirectionRejects(0)
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
    shakeRejects,
    directionRejects,
  }
}
