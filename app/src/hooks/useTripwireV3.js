import { useState, useRef, useCallback, useEffect } from 'react'

// Uniform aggressive thresholds across all 5 lines (one per sampling line, top→bottom).
// Motion blur from a falling bottle creates a streak that hits every line ~equally
// in one frame, so there's no physical basis for tiering — multi-line gives 5
// independent chances to catch the streak, that's the win.
const CELL_TRIGGER_PERCENT_PER_LINE = [0.08, 0.08, 0.08, 0.08, 0.08]

// Tripwire V3 — multi-line gate with segmented cells.
// N parallel sampling lines stacked across the gate region. Cells split each line
// horizontally. A confirmed pass = a cell cluster activates on line K, then an
// overlapping cluster activates on line K+1 within MAX_TRANSIT_MS_PER_HOP.
// More lines + tighter spacing = more chances to catch a fast-falling bottle,
// since gravity gives only ~30–60ms between adjacent lines.
// UI only shows the user-facing line at tripwireY; the rest are invisible.
export function useTripwireV3() {
  const [tripwireY, setTripwireY] = useState(0.5)
  const [isTriggered, setIsTriggered] = useState(false)
  const [triggerCount, setTriggerCount] = useState(0)
  const [isRunning, setIsRunning] = useState(false)

  // Diagnostics for dev overlay
  const [shakeRejects, setShakeRejects] = useState(0)
  const [expiredPrimes, setExpiredPrimes] = useState(0)
  const [upwardRejects, setUpwardRejects] = useState(0)

  const rafRef = useRef(null)
  const canvasRef = useRef(null)
  const lastFrameTime = useRef(0)
  const onTriggerRef = useRef(null)

  // Per-line previous RGB buffers (length N_LINES)
  const prevLinesRef = useRef([])
  const prevCornerRef = useRef(null)

  // Active primed events — clusters waiting for confirmation on the next line down
  // Each: { lineIdx, left, right, primedAt }
  const primedEventsRef = useRef([])

  // Global cooldown timestamp so one physical bottle fires once
  const lastFireAtRef = useRef(0)

  // ── Config ──────────────────────────────────────────────────────
  const N_LINES = 5                      // sampling lines across the gate
  const GATE_HALF_OFFSET = 0.05          // outermost lines sit ±5% from tripwireY
  const STRIP_HEIGHT = 22                // px tall per line strip
  const N_CELLS = 8                      // horizontal cells per line
  const CHANGE_THRESHOLD = 18            // per-channel brightness delta = pixel "changed"
  const MAX_TRANSIT_MS_PER_HOP = 250     // max time between adjacent line confirmations
  const MAX_PRIMED_AGE_MS = 500          // primed events expire after this
  const GLOBAL_COOLDOWN_MS = 200         // min time between any two fires
  const TARGET_FPS = 30
  const CORNER_SIZE = 60
  const SHAKE_PERCENT = 0.07

  const setOnTrigger = useCallback((fn) => {
    onTriggerRef.current = fn
  }, [])

  const getCanvas = useCallback(() => {
    if (!canvasRef.current) canvasRef.current = document.createElement('canvas')
    return canvasRef.current
  }, [])

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

  // Per-cell change fractions across a horizontal strip buffer
  const compareRGBPerCell = useCallback((prev, curr, stripW, stripH) => {
    const out = new Array(N_CELLS).fill(0)
    if (!prev || !curr || prev.length !== curr.length) return out

    const cellW = Math.floor(stripW / N_CELLS)
    if (cellW === 0) return out

    for (let c = 0; c < N_CELLS; c++) {
      const xStart = c * cellW
      const xEnd = c === N_CELLS - 1 ? stripW : xStart + cellW
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
    }
    return out
  }, [])

  // Group adjacent active cells into clusters using a per-line threshold
  const findClusters = useCallback((cellActivations, threshold) => {
    const clusters = []
    let start = -1
    for (let i = 0; i < cellActivations.length; i++) {
      const active = cellActivations[i] >= threshold
      if (active && start === -1) start = i
      if (!active && start !== -1) {
        clusters.push({ left: start, right: i - 1 })
        start = -1
      }
    }
    if (start !== -1) clusters.push({ left: start, right: cellActivations.length - 1 })
    return clusters
  }, [])

  const clustersOverlap = (a, b) => !(a.right < b.left || b.right < a.left)

  // Vertical offset (fraction of frame height) for sampling line i ∈ [0, N_LINES-1].
  // Line 0 = topmost (-GATE_HALF_OFFSET), Line N-1 = bottommost (+GATE_HALF_OFFSET).
  const lineOffset = useCallback((i) => {
    if (N_LINES === 1) return 0
    return -GATE_HALF_OFFSET + (2 * GATE_HALF_OFFSET) * (i / (N_LINES - 1))
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

    const cornerW = Math.min(CORNER_SIZE, w)
    const cornerH = Math.min(CORNER_SIZE, h)
    const currentCorner = getRegionRGB(video, 0, 0, cornerW, cornerH)

    // Sample all N_LINES strips this frame
    const currentLines = new Array(N_LINES)
    const lineHeights = new Array(N_LINES)
    for (let i = 0; i < N_LINES; i++) {
      const y = Math.max(0, Math.floor(h * (tripwireY + lineOffset(i))) - STRIP_HEIGHT / 2)
      const sh = Math.min(STRIP_HEIGHT, h - y)
      lineHeights[i] = sh
      currentLines[i] = getRegionRGB(video, 0, y, w, sh)
    }

    const havePrev = prevLinesRef.current.length === N_LINES && prevLinesRef.current.every(b => b)
    if (havePrev && currentLines.every(b => b)) {
      const cornerChange = compareRGB(prevCornerRef.current, currentCorner)
      const isShake = cornerChange > SHAKE_PERCENT

      if (isShake) {
        setShakeRejects(n => n + 1)
      } else {
        // Compute per-cell activations for every line
        const lineCells = new Array(N_LINES)
        const lineClusters = new Array(N_LINES)
        for (let i = 0; i < N_LINES; i++) {
          lineCells[i] = compareRGBPerCell(prevLinesRef.current[i], currentLines[i], w, lineHeights[i])
          lineClusters[i] = findClusters(lineCells[i], CELL_TRIGGER_PERCENT_PER_LINE[i])
        }

        const now = timestamp
        const sinceLastFire = now - lastFireAtRef.current
        const cooldownActive = sinceLastFire < GLOBAL_COOLDOWN_MS

        // Phase 1: for each cluster on line i (i >= 1), look for a prime on line i-1
        // with overlapping cells inside the transit window. If matched → fire (once per frame).
        const consumedPrimes = new Set()
        let firedThisFrame = false

        if (!cooldownActive) {
          for (let i = 1; i < N_LINES && !firedThisFrame; i++) {
            for (const cluster of lineClusters[i]) {
              let matched = false
              for (let pi = 0; pi < primedEventsRef.current.length; pi++) {
                if (consumedPrimes.has(pi)) continue
                const prime = primedEventsRef.current[pi]
                if (prime.lineIdx !== i - 1) continue
                if (now - prime.primedAt > MAX_TRANSIT_MS_PER_HOP) continue
                if (clustersOverlap(prime, cluster)) {
                  // Promote the prime to line i so it can chain to line i+1 if needed,
                  // but since we already fired we'll just count it and consume.
                  setTriggerCount(n => n + 1)
                  onTriggerRef.current?.()
                  consumedPrimes.add(pi)
                  lastFireAtRef.current = now
                  firedThisFrame = true
                  matched = true
                  break
                }
              }
              if (matched) break
            }
          }
        }

        if (firedThisFrame) {
          setIsTriggered(true)
          setTimeout(() => setIsTriggered(false), 200)
        }
        primedEventsRef.current = primedEventsRef.current.filter((_, i) => !consumedPrimes.has(i))

        // Phase 2: register clusters on every line as primes (so any line can act as the
        // "top" of a confirmation pair with the next line down). Skip lines that just
        // fired this frame's cooldown.
        if (!cooldownActive || !firedThisFrame) {
          for (let i = 0; i < N_LINES - 1; i++) {  // last line can't prime — nothing below it
            for (const cluster of lineClusters[i]) {
              const dup = primedEventsRef.current.some(
                p => p.lineIdx === i && clustersOverlap(p, cluster)
              )
              if (dup) continue
              primedEventsRef.current.push({
                lineIdx: i,
                left: cluster.left,
                right: cluster.right,
                primedAt: now,
              })
            }
          }
        }
      }

      // Expire stale primes
      const expireBefore = timestamp - MAX_PRIMED_AGE_MS
      const before = primedEventsRef.current.length
      primedEventsRef.current = primedEventsRef.current.filter(p => p.primedAt >= expireBefore)
      const expired = before - primedEventsRef.current.length
      if (expired > 0) setExpiredPrimes(n => n + expired)
    }

    prevCornerRef.current = currentCorner
    prevLinesRef.current = currentLines

    rafRef.current = requestAnimationFrame((ts) => processFrameRef.current(video, ts))
  }, [isRunning, tripwireY, getRegionRGB, compareRGB, compareRGBPerCell, findClusters, lineOffset])

  useEffect(() => {
    processFrameRef.current = processFrame
  }, [processFrame])

  const startTripwire = useCallback((video) => {
    prevCornerRef.current = null
    prevLinesRef.current = []
    primedEventsRef.current = []
    lastFireAtRef.current = 0
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
    prevLinesRef.current = []
    primedEventsRef.current = []
  }, [])

  const resetCount = useCallback(() => {
    setTriggerCount(0)
    setShakeRejects(0)
    setExpiredPrimes(0)
    setUpwardRejects(0)
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
    upwardRejects,
    // Kept for back-compat with App.jsx (no longer rendered visually)
    gateHalfOffset: GATE_HALF_OFFSET,
  }
}
