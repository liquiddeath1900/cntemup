// Shared Web Audio primitives — used by all theme sound profiles.
// Mirrors the original useSound.js engine: each play() creates a fresh context
// so iOS Safari user-gesture unlock still works.

export function createAudioCtx() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

export function playTone(freq, duration = 0.08, type = 'square', volume = 0.3, ctx = null, when = 0) {
  try {
    const c = ctx || createAudioCtx()
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, c.currentTime + when)
    gain.gain.setValueAtTime(0, c.currentTime + when)
    gain.gain.linearRampToValueAtTime(volume, c.currentTime + when + 0.005)
    gain.gain.linearRampToValueAtTime(0, c.currentTime + when + duration)
    osc.connect(gain)
    gain.connect(c.destination)
    osc.start(c.currentTime + when)
    osc.stop(c.currentTime + when + duration + 0.01)
  } catch {
    /* fail silent */
  }
}

export function playNoiseBurst(duration = 0.15, volume = 0.2, filterFreq = 2000, ctx = null, when = 0, q = 2) {
  try {
    const c = ctx || createAudioCtx()
    const bufferSize = Math.floor(c.sampleRate * duration)
    const buf = c.createBuffer(1, bufferSize, c.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1
    const src = c.createBufferSource()
    src.buffer = buf
    const filter = c.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = filterFreq
    filter.Q.value = q
    const gain = c.createGain()
    gain.gain.setValueAtTime(0, c.currentTime + when)
    gain.gain.linearRampToValueAtTime(volume, c.currentTime + when + 0.005)
    gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + when + duration)
    src.connect(filter)
    filter.connect(gain)
    gain.connect(c.destination)
    src.start(c.currentTime + when)
    src.stop(c.currentTime + when + duration)
  } catch {
    /* fail silent */
  }
}

// Lazy-loaded HTMLAudioElement pool for sampled sounds (e.g. real swish).
// Pool prevents click-spamming from clipping itself when retriggers overlap.
const audioPools = new Map()

export function playSample(url, volume = 0.85, poolSize = 4) {
  let pool = audioPools.get(url)
  if (!pool) {
    pool = []
    for (let i = 0; i < poolSize; i++) {
      const a = new Audio(url)
      a.preload = 'auto'
      pool.push(a)
    }
    audioPools.set(url, pool)
  }
  // Pick the first idle audio element, or reset the oldest
  const idle = pool.find((a) => a.paused || a.ended)
  const a = idle || pool[0]
  try {
    a.currentTime = 0
    a.volume = volume
    a.play().catch(() => {})
  } catch {
    /* fail silent */
  }
}
