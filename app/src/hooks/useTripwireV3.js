import { useState, useRef, useCallback, useEffect } from 'react'

// Tripwire V3 — two-line gate with segmented cells.
// An object must cross the TOP line, then the BOTTOM line, within a transit window.
// Each horizontal "cell" of the gate runs an independent state machine so multiple
// bottles falling through different parts of the frame each get their own count.
// Same public API as useTripwire / useTripwireV2 so App.jsx can run all three in parallel.
export function useTripwireV3() {
  const [tripwireY, setTripwireY] = useState(0.5)
  const [isTriggered, setIsTriggered] = useState(false)
  const [triggerCount, setTriggerCount] = useState(0)
  const [isRunning, setIsRunning] = useState(false)

  // Diagnostics for dev overlay
  const [shakeRejects, setShakeRejects] = useState(0)
  const [expiredPrimes, setExpiredPrimes] = useState(0)

  const rafRef = useRef(null)
  const canvasRef = useRef(null)
  const lastFrameTime = useRef(0)
  const onTriggerRef = useRef(null)

  const prevTopRef = useRef(null)
  const prevBottomRef = useRef(null)
  const prevCornerRef = useRef(null)

  // Active "primed events" — top-line clusters waiting for a matching bottom-line cluster
  // Each: { leftCell, rightCell, primedAt }
  const primedEventsRef = useRef([])

  // ── Config ──────────────────────────────────────────────────────
  const STRIP_HEIGHT = 22         // px tall per gate line strip
  const GATE_HALF_OFFSET = 0.05   // each line sits 5% of frame above/below tripwireY → 10% gate
  const N_CELLS = 8               // horizontal cells across the frame
  const CHANGE_THRESHOLD = 25     // per-channel brightness delta = "changed"
  const CELL_TRIGGER_PERCENT = 0.18 // 18% of cell's pixels changed = cell is active
  const MAX_TRANSIT_MS = 600      // max time top→bottom for a real drop
  const MAX_PRIMED_AGE_MS = 800   // primed events expire after this
  const TARGET_FPS = 30
  const CORNER_SIZE = 60
  const SHAKE_PERCENT = 0.08

  const setOnTrigger = useCallback((fn) => {
    onTriggerRef.current = fn
  }, [])

  const getCanvas = useCallback(() => {
    if (!canvasRef.current) canvasRef.current = document.createElement('canvas')
    return canvasRef.current
  }, [])

  // Grab a region from video as Uint8Array of interleaved R,G,B bytes
  const getRegionRGB = useCallback((video, sx, sy, sw, sh) => {
    if (!video || video.videoWidth === 0) return null
    const canvas = getCanvas()
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    canvas.width = sw
    canvas.height = sh
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh)
    const { data } = ctx.getImageData(0, 0, sw, sh)
    const rgb = new Uint8Array(sw * sh * 3)
    for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
      rgb[j] = data[i]; rgb[j + 1] = data[i + 1]; rgb[j + 2] = data[i + 2]
    }
    return rgb
  }, [getCanvas])

  // Overall change fraction across an RGB buffer
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

  // Per-cell change fractions across a horizontal strip buffer.
  // Returns array of length N_CELLS with each cell's change fraction.
  const compareRGBPerCell = useCallback((prev, curr, stripW, stripH) => {
    const out = new Array(N_CELLS).fill(0)
    if (!prev || !curr || prev.length !== curr.length) return out

    const cellW = Math.floor(stripW / N_CELLS)
    if (cellW === 0) return out

    for (let c = 0; c < N_CELLS; c++) {
      const xStart = c * cellW
      const xEnd = c === N_CELLS - 1 ? stripW : xStart + cellW
      const w = xEnd - xStart
      let changed = 0
      let total = 0
      for (let y = 0; y < stripH; y++) {
        for (let x = xStart; x < xEnd; x++) {
          const p = (y * stripW + x) * 3
          const dr = Math.abs(prev[p] - curr[p])
          const dg = Math.abs(prev[p + 1] - curr[p + 1])
          const db = Math.abs(prev[p + 2] - curr[p + 2])
          if (Math.max(dr, dg, db) > CHANGE_THRESHOLD) changed++
          total++
        }
      }
      out[c] = total > 0 ? changed / total : 0
      void w
    }
    return out
  }, [])

  // Group adjacent active cells into clusters. Returns [{ left, right }, ...]
  const findClusters = useCallback((cellActivations) => {
    const clusters = []
    let start = -1
    for (let i = 0; i < cellActivations.length; i++) {
      const active = cellActivations[i] >= CELL_TRIGGER_PERCENT
      if (active && start === -1) start = i
      if (!active && start !== -1) {
        clusters.push({ left: start, right: i - 1 })
        start = -1
      }
    }
    if (start !== -1) clusters.push({ left: start, right: cellActivations.length - 1 })
    return clusters
  }, [])

  // Two clusters overlap if their cell-index ranges overlap
  const clustersOverlap = (a, b) => !(a.right < b.left || b.right < a.left)

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

    // Gate geometry
    const topY = Math.max(0, Math.floor(h * (tripwireY - GATE_HALF_OFFSET)) - STRIP_HEIGHT / 2)
    const topH = Math.min(STRIP_HEIGHT, h - topY)
    const botY = Math.max(0, Math.floor(h * (tripwireY + GATE_HALF_OFFSET)) - STRIP_HEIGHT / 2)
    const botH = Math.min(STRIP_HEIGHT, h - botY)
    const cornerW = Math.min(CORNER_SIZE, w)
    const cornerH = Math.min(CORNER_SIZE, h)

    const currentCorner = getRegionRGB(video, 0, 0, cornerW, cornerH)
    const currentTop = getRegionRGB(video, 0, topY, w, topH)
    const currentBottom = getRegionRGB(video, 0, botY, w, botH)

    if (currentTop && prevTopRef.current && currentBottom && prevBottomRef.current) {
      const cornerChange = compareRGB(prevCornerRef.current, currentCorner)
      const isShake = cornerChange > SHAKE_PERCENT

      if (isShake) {
        // Shake frame — don't add new primes, don't fire counts, but DO age existing primes
        setShakeRejects(n => n + 1)
      } else {
        const topCells = compareRGBPerCell(prevTopRef.current, currentTop, w, topH)
        const botCells = compareRGBPerCell(prevBottomRef.current, currentBottom, w, botH)

        const topClusters = findClusters(topCells)
        const botClusters = findClusters(botCells)

        const now = timestamp

        // Phase 1: try to resolve any bottom cluster against an existing primed event
        const consumedPrimes = new Set()
        let firedThisFrame = false
        for (const bot of botClusters) {
          for (let pi = 0; pi < primedEventsRef.current.length; pi++) {
            if (consumedPrimes.has(pi)) continue
            const prime = primedEventsRef.current[pi]
            const age = now - prime.primedAt
            if (age > MAX_TRANSIT_MS) continue
            if (clustersOverlap(prime, bot)) {
              setTriggerCount(n => n + 1)
              onTriggerRef.current?.()
              consumedPrimes.add(pi)
              firedThisFrame = true
              break // one bottom cluster fires at most one prime
            }
          }
        }
        if (firedThisFrame) {
          setIsTriggered(true)
          setTimeout(() => setIsTriggered(false), 200)
        }
        // Drop consumed primes
        primedEventsRef.current = primedEventsRef.current.filter((_, i) => !consumedPrimes.has(i))

        // Phase 2: register top clusters as new primed events,
        // skipping any that overlap an already-alive prime (so a slow bottle
        // sitting on the top line doesn't keep adding new primes)
        for (const top of topClusters) {
          const overlapsExisting = primedEventsRef.current.some(p => clustersOverlap(p, top))
          if (!overlapsExisting) {
            primedEventsRef.current.push({ left: top.left, right: top.right, primedAt: now })
          }
        }
      }

      // Expire stale primes regardless of shake/no-shake
      const expireBefore = timestamp - MAX_PRIMED_AGE_MS
      const before = primedEventsRef.current.length
      primedEventsRef.current = primedEventsRef.current.filter(p => p.primedAt >= expireBefore)
      const expired = before - primedEventsRef.current.length
      if (expired > 0) setExpiredPrimes(n => n + expired)
    }

    prevCornerRef.current = currentCorner
    prevTopRef.current = currentTop
    prevBottomRef.current = currentBottom

    rafRef.current = requestAnimationFrame((ts) => processFrameRef.current(video, ts))
  }, [isRunning, tripwireY, getRegionRGB, compareRGB, compareRGBPerCell, findClusters])

  useEffect(() => {
    processFrameRef.current = processFrame
  }, [processFrame])

  const startTripwire = useCallback((video) => {
    prevCornerRef.current = null
    prevTopRef.current = null
    prevBottomRef.current = null
    primedEventsRef.current = []
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
    prevBottomRef.current = null
    primedEventsRef.current = []
  }, [])

  const resetCount = useCallback(() => {
    setTriggerCount(0)
    setShakeRejects(0)
    setExpiredPrimes(0)
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
    expiredPrimes,
    // For visual gate rendering in App.jsx
    gateHalfOffset: GATE_HALF_OFFSET,
  }
}
