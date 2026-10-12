import { useEffect, useRef, useState } from 'react'
import { useSound } from '../hooks/useSound'

// Flick demo for the landing page, modelled on Cup Pong: you look down a table,
// the bottle sits at the bottom, and a swipe up sends it arcing away from you.
// A tripwire runs across the table, the same line the app draws over your camera.
// Anything that crosses it gets counted, which is all the real app does. The open
// bin at the far end is the game: land it in there to build a streak.
// The bin slides side to side, faster as the streak grows. Pixel art, no camera.

const W = 160
const H = 190
const CX = 80
const HORIZON = 40          // where the table would vanish
const NEAR_Y = 176          // ground line closest to you
const GRAVITY = 0.25
const LIFT = 5.6            // every throw gets the same arc; power changes how far it goes
const PX = 3                // sprite pixel size at the near edge
const TABLE_HALF = 70       // half the table width at the near edge
const TRIP_Z = 0.5          // depth of the tripwire
const BIN_Z = 0.85          // depth of the bin
const BIN_HALF = 34         // bin half-width, in near-edge pixels
const BIN_TALL = 52
// frames until a thrown bottle has come back down to the height of the bin's rim
const TO_RIM = (LIFT + Math.sqrt(LIFT * LIFT - 2 * GRAVITY * BIN_TALL)) / GRAVITY
const BIN_SWING = 36        // how far the bin slides to each side
const APP_DROP_MS = 650     // how long the item takes to fall through the app-view box
const DEPOSIT = 0.05        // NY rate, matches the app's default state

// '#' = outline, 'o' = fill, '.' = empty
const SPRITES = {
  bottle: [
    '...##...', '..####..', '...##...', '...##...', '..####..', '.######.', '.#oooo#.', '.#oooo#.',
    '.######.', '.#....#.', '.#....#.', '.######.', '.#oooo#.', '.#oooo#.', '.######.', '..####..',
  ],
  can: [
    '..####..', '.######.', '.#oooo#.', '.######.', '.#....#.', '.#....#.', '.#....#.', '.######.',
    '.#oooo#.', '.######.', '..####..',
  ],
}

// 3x5 digits for the little app screen
const DIGITS = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001',
  '111100111001111', '111100111101111', '111001010010010', '111101111101111', '111101111001111']

function themeColor(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

// Things further down the table are drawn smaller and higher up the screen
const scaleAt = (z) => 1 / (1 + z * 1.6)
const groundY = (z) => HORIZON + (NEAR_Y - HORIZON) * scaleAt(z)
const screenX = (x, z) => CX + x * scaleAt(z)

export function LandingDemo() {
  const canvasRef = useRef(null)
  const [count, setCount] = useState(0)
  const [streak, setStreak] = useState(0)
  const [best, setBest] = useState(0)
  const [message, setMessage] = useState('FLICK IT ACROSS THE TRIPWIRE, INTO THE BIN')
  const rigLabelsRef = useRef(null)
  const [started, setStarted] = useState(false)
  const { playCount } = useSound()
  const playRef = useRef(playCount)
  useEffect(() => {
    playRef.current = playCount
  })

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.imageSmoothingEnabled = false
    const colors = {
      bg: themeColor('--gb-screen-bg', '#0f380f'),
      light: themeColor('--gb-screen-light', '#9bbc0f'),
      dark: themeColor('--gb-screen-dark', '#306230'),
      wire: themeColor('--gb-danger', '#ef4444'),
    }

    // Pre-draw each sprite once so it can be scaled and spun in flight
    const sprites = {}
    Object.keys(SPRITES).forEach((type) => {
      const rows = SPRITES[type]
      const c = document.createElement('canvas')
      c.width = rows[0].length * PX
      c.height = rows.length * PX
      const g = c.getContext('2d')
      rows.forEach((row, r) => {
        for (let i = 0; i < row.length; i++) {
          if (row[i] === '.') continue
          g.fillStyle = row[i] === '#' ? colors.light : colors.dark
          g.fillRect(i * PX, r * PX, PX, PX)
        }
      })
      sprites[type] = c
    })

    let total = 0
    let run = 0
    let bestRun = 0
    let thrown = 0
    let binX = 0
    let swing = 0              // phase of the bin's side-to-side slide
    let moving = false         // the bin holds still until the first throw
    let item = null            // { type, x, z, h, vx, vz, vh, rot, state }
    let spawnAt = 0
    let held = null            // { trail: [{x, y, t}] }
    let flashUntil = 0
    let appDropUntil = 0       // the little app screen shows the item falling through its line
    let appDropType = 'bottle'
    let frame = null
    let visible = true

    const spawn = () => {
      item = { type: thrown % 2 === 0 ? 'bottle' : 'can', x: 0, z: 0, h: 0, vx: 0, vz: 0, vh: 0, rot: 0, state: 'ready', crossed: false }
    }

    const toCanvas = (e) => {
      const rect = canvas.getBoundingClientRect()
      return { x: ((e.clientX - rect.left) / rect.width) * W, y: ((e.clientY - rect.top) / rect.height) * H }
    }

    const onDown = (e) => {
      if (!item || item.state !== 'ready') return
      const p = toCanvas(e)
      // grab anywhere in the bottom part of the screen, like Cup Pong
      if (p.y < 96) return
      e.preventDefault()
      try {
        canvas.setPointerCapture(e.pointerId)
      } catch {
        /* capture is a nicety — flicking still works without it */
      }
      item.state = 'held'
      held = { trail: [{ ...p, t: performance.now() }] }
    }
    const onMove = (e) => {
      if (!held) return
      const p = toCanvas(e)
      held.trail.push({ ...p, t: performance.now() })
      if (held.trail.length > 8) held.trail.shift()
    }
    const onUp = () => {
      if (!held) return
      const trail = held.trail
      held = null
      const last = trail[trail.length - 1]
      // speed over the last ~90ms of the swipe
      let first = trail[0]
      for (let i = trail.length - 1; i >= 0; i--) {
        if (last.t - trail[i].t > 90) break
        first = trail[i]
      }
      const frames = Math.max(1, (last.t - first.t) / 16.7)
      const dx = last.x - first.x
      const dy = last.y - first.y
      const raw = Math.hypot(dx, dy) / frames
      if (raw < 1.5 || dy >= 0) {
        // a tap, a hesitant drag or a downward swipe: leave it where it is
        item.state = 'ready'
        return
      }
      // How far down the table it is when it drops to rim height: a soft flick falls short
      // of the line, a medium one comes down over the bin, a hard one sails past.
      const reach = 0.25 + 0.9 * (1 - Math.exp(-raw / 14))
      // Swiping off to one side steers it
      const aim = Math.max(-58, Math.min(58, (dx / -dy) * 95))
      item.state = 'fly'
      item.vz = reach / TO_RIM
      item.vx = aim / TO_RIM
      item.vh = LIFT
      thrown += 1
      if (!moving) {
        moving = true
        setStarted(true)
      }
    }

    // crossing the tripwire is what the app counts
    const counted = (now) => {
      total += 1
      setCount(total)
      flashUntil = now + 170
      appDropUntil = now + APP_DROP_MS
      appDropType = item.type
      playRef.current()
    }

    // the bin is the game on top
    const landed = (inBin) => {
      if (inBin) {
        run += 1
        bestRun = Math.max(bestRun, run)
        setBest(bestRun)
        setMessage(run >= 3 ? `${run} IN A ROW!` : 'COUNTED, AND IN THE BIN!')
      } else {
        run = 0
        setMessage(item.crossed ? 'COUNTED +1. MISSED THE BIN THOUGH.' : "SHORT. IT DIDN'T CROSS THE TRIPWIRE.")
      }
      setStreak(run)
    }

    const step = (now) => {
      if (moving) {
        // slides side to side, a little faster with every bottle in a row
        swing += 0.022 * Math.min(2.2, 1 + run * 0.15)
        binX = Math.sin(swing) * BIN_SWING
      }
      if (rigLabelsRef.current) {
        rigLabelsRef.current.style.transform = `translateX(${((binX * scaleAt(BIN_Z)) / W) * 100}%)`
      }
      if (!item) {
        if (now >= spawnAt) spawn()
        return
      }
      if (item.state === 'fly') {
        const before = item.z
        const heightBefore = item.h
        item.z += item.vz
        item.x += item.vx
        item.vh -= GRAVITY
        item.h += item.vh
        item.rot += 0.16
        if (!item.crossed && before < TRIP_Z && item.z >= TRIP_Z) {
          item.crossed = true
          counted(now)
        }
        // dropping through the height of the bin's rim, over the bin: it's in
        const overBin = Math.abs(item.z - BIN_Z) < 0.085 && Math.abs(item.x - binX) < BIN_HALF - 13
        if (item.vh < 0 && heightBefore >= BIN_TALL && item.h < BIN_TALL && overBin) {
          item.state = 'in'
          landed(true)
        } else if (item.h <= 0) {
          item.h = 0
          item.state = 'down'
          item.downAt = now
          landed(false)
        }
      } else if (item.state === 'in') {
        item.vh -= GRAVITY
        item.h += item.vh
        item.x += (binX - item.x) * 0.25
        if (item.h <= 4) {
          item = null
          spawnAt = now + 380
        }
      } else if (item.state === 'down') {
        // skids a little, then it's cleared
        item.z += item.vz * 0.35
        item.x += item.vx * 0.35
        if (now - item.downAt > 520) {
          item = null
          spawnAt = now + 200
        }
      }
    }

    const rect = (color, x, y, w, h) => {
      ctx.fillStyle = color
      ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)))
    }

    const drawItem = () => {
      const sprite = sprites[item.type]
      const s = scaleAt(item.z)
      const w = sprite.width * s
      const h = sprite.height * s
      const gx = screenX(item.x, item.z)
      const gy = groundY(item.z)
      // shadow on the table: the cue that tells you how far away it is
      if (item.state !== 'in') {
        ctx.globalAlpha = 0.35
        rect('#000', gx - w * 0.45, gy - 1, w * 0.9, Math.max(1, 3 * s))
        ctx.globalAlpha = 1
      }
      ctx.save()
      ctx.translate(Math.round(gx), Math.round(gy - item.h * s - h / 2))
      if (item.state === 'fly' || item.state === 'in') ctx.rotate(item.rot)
      else if (item.state === 'down') ctx.rotate(Math.PI / 2)
      ctx.drawImage(sprite, -w / 2, -h / 2, w, h)
      ctx.restore()
    }

    const drawBin = (part) => {
      const s = scaleAt(BIN_Z)
      const x = screenX(binX, BIN_Z)
      const y = groundY(BIN_Z)
      const half = BIN_HALF * s
      const tall = BIN_TALL * s
      if (part === 'back') {
        // inside of the open bin
        rect(colors.light, x - half, y - tall - 5, half * 2, 6)
        rect(colors.bg, x - half + 2, y - tall - 3, half * 2 - 4, 4)
      } else {
        rect(colors.light, x - half, y - tall, half * 2, tall)
        rect(colors.dark, x - half + 2, y - tall + 2, half * 2 - 4, tall - 4)
        rect(colors.light, x - half * 0.45, y - tall * 0.62, half * 0.9, 2)
        rect(colors.light, x - half * 0.45, y - tall * 0.42, half * 0.9, 2)
      }
    }

    const drawAppScreen = (now) => {
      // what the phone on the tripod is showing: its camera view, the line, the count
      const x = 5
      const y = 5
      rect(colors.light, x, y, 42, 54)
      rect(colors.bg, x + 2, y + 2, 38, 50)
      rect(colors.dark, x + 2, y + 34, 38, 1)
      // The phone's view: the item falls from the top of the frame to the bottom.
      // The line stays where it is and blinks at the moment the item passes through it.
      const dropping = now < appDropUntil
      const t = dropping ? 1 - (appDropUntil - now) / APP_DROP_MS : 0
      const crossing = dropping && t > 0.38 && t < 0.7
      for (let i = 0; i < 38; i += crossing ? 1 : 5) rect(crossing ? colors.light : colors.wire, x + 2 + i, y + 18, crossing ? 1 : 3, crossing ? 2 : 1)
      if (dropping) {
        const sprite = sprites[appDropType]
        const w = 8
        const h = (sprite.height / sprite.width) * w
        ctx.save()
        ctx.beginPath()
        ctx.rect(x + 2, y + 2, 38, 32)   // keep it inside the camera part of the box
        ctx.clip()
        ctx.drawImage(sprite, x + 17, y + 2 - h + t * (32 + h), w, h)
        ctx.restore()
      }
      const text = String(total).padStart(3, '0')
      for (let d = 0; d < 3; d++) {
        const bits = DIGITS[Number(text[d])]
        for (let i = 0; i < 15; i++) {
          if (bits[i] === '1') rect(colors.light, x + 9 + d * 9 + (i % 3) * 2, y + 39 + Math.floor(i / 3) * 2, 2, 2)
        }
      }
    }

    const draw = (now) => {
      rect(colors.bg, 0, 0, W, H)

      // table running away from you
      const farZ = 1.25
      ctx.fillStyle = colors.dark
      ctx.globalAlpha = 0.45
      ctx.beginPath()
      ctx.moveTo(screenX(-TABLE_HALF, 0), H)
      ctx.lineTo(screenX(TABLE_HALF, 0), H)
      ctx.lineTo(screenX(TABLE_HALF, farZ), groundY(farZ))
      ctx.lineTo(screenX(-TABLE_HALF, farZ), groundY(farZ))
      ctx.closePath()
      ctx.fill()
      ctx.globalAlpha = 1
      rect(colors.dark, screenX(-TABLE_HALF, farZ), groundY(farZ) - 1, (TABLE_HALF * 2) * scaleAt(farZ), 1)

      // tripwire across the table, solid for a beat when something crosses
      const ty = groundY(TRIP_Z)
      const tHalf = TABLE_HALF * scaleAt(TRIP_Z) + 6
      const flashing = now < flashUntil
      for (let x = -tHalf; x < tHalf; x += flashing ? 1 : 6) rect(flashing ? colors.light : colors.wire, CX + x, ty, flashing ? 1 : 4, 2)

      // bin and bottle, drawn back to front
      const behindBin = item && (item.state === 'in' || item.z > BIN_Z + 0.02)
      drawBin('back')
      if (behindBin) drawItem()
      drawBin('front')


      if (item && !behindBin) drawItem()

      drawAppScreen(now)
    }

    const loop = (now) => {
      frame = null
      if (!visible) return
      step(now)
      draw(now)
      frame = requestAnimationFrame(loop)
    }
    const start = () => { if (!frame) frame = requestAnimationFrame(loop) }

    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)

    // only run while the demo is on screen
    const observer = new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting
      if (visible) start()
    })
    observer.observe(canvas)
    start()

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
    }
  }, [])

  return (
    <div className="lp-demo">
      <p className="lp-demo-hint" aria-live="polite">{message}</p>
      <div className="lp-demo-screen">
        <canvas
          ref={canvasRef}
          className="lp-demo-canvas"
          width={W}
          height={H}
          role="img"
          aria-label="Playable demo: swipe up to flick the bottle down the table. Crossing the tripwire counts it; landing it in the moving bin builds a streak."
        />
        <span className="lp-demo-label lp-demo-label-app">APP VIEW</span>
        <span className="lp-demo-label lp-demo-label-wire">TRIPWIRE</span>
        {/* follows the bin as it slides */}
        <div className="lp-demo-rig-labels" ref={rigLabelsRef}>
          <span className="lp-demo-label lp-demo-label-bin">BIN</span>
        </div>
        {!started && <span className="lp-demo-label lp-demo-label-flick">▲ SWIPE UP</span>}
      </div>
      <div className="lp-demo-lcd">
        <span>COUNT <strong>{String(count).padStart(3, '0')}</strong></span>
        <span>${(count * DEPOSIT).toFixed(2)}</span>
        <span>BIN STREAK <strong>{streak}</strong> <small>BEST {best}</small></span>
      </div>
    </div>
  )
}

// Side view of the best setup: phone upright on a tripod or stand, pointed straight
// at the bin. You stand behind the phone and throw past it; the dotted guide line is
// the path into the bin, through the tripwire. Colors follow the theme.
export function RigDiagram() {
  return (
    <svg className="lp-rig" viewBox="0 0 230 130" shapeRendering="crispEdges" role="img"
      aria-label="Diagram: a phone stands upright on a tripod, pointed straight at a bin. A bottle is thrown from behind the phone, over it, and a dotted guide line shows its path down into the bin through the tripwire.">
      {/* what the camera sees: straight ahead, level */}
      <polygon className="lp-rig-view" points="147,58 104,42 104,80" />
      {/* floor */}
      <rect className="lp-rig-light" x="8" y="106" width="214" height="3" />
      {/* bin */}
      <rect className="lp-rig-light" x="58" y="68" width="42" height="38" />
      <rect className="lp-rig-fill" x="61" y="71" width="36" height="32" />
      <rect className="lp-rig-light" x="55" y="62" width="3" height="9" />
      <rect className="lp-rig-light" x="100" y="62" width="3" height="9" />
      {/* tripwire across the bin mouth */}
      <g className="lp-rig-wire">
        <rect x="46" y="64" width="6" height="2" /><rect x="56" y="64" width="6" height="2" />
        <rect x="66" y="64" width="6" height="2" /><rect x="76" y="64" width="6" height="2" />
        <rect x="86" y="64" width="6" height="2" /><rect x="96" y="64" width="6" height="2" />
        <rect x="106" y="64" width="6" height="2" />
      </g>
      {/* guide line: the throw, from behind the phone, over it, into the bin */}
      <g className="lp-rig-guide">
        <rect x="185" y="30" width="3" height="3" /><rect x="177" y="24" width="3" height="3" /><rect x="170" y="20" width="3" height="3" /><rect x="163" y="16" width="3" height="3" />
        <rect x="156" y="13" width="3" height="3" /><rect x="149" y="12" width="3" height="3" /><rect x="142" y="11" width="3" height="3" /><rect x="136" y="11" width="3" height="3" />
        <rect x="129" y="12" width="3" height="3" /><rect x="123" y="14" width="3" height="3" /><rect x="116" y="17" width="3" height="3" /><rect x="110" y="21" width="3" height="3" />
        <rect x="104" y="25" width="3" height="3" /><rect x="98" y="31" width="3" height="3" /><rect x="92" y="38" width="3" height="3" /><rect x="86" y="45" width="3" height="3" />
        <polygon points="74,52 86,54 78,62" />
      </g>
      {/* bottle leaving your hand, behind the phone */}
      <g transform="rotate(-38 200 40)">
        <rect className="lp-rig-light" x="198" y="24" width="4" height="8" />
        <rect className="lp-rig-light" x="195" y="32" width="10" height="20" />
        <rect className="lp-rig-fill" x="197" y="38" width="6" height="8" />
      </g>
      {/* phone, upright */}
      <rect className="lp-rig-light" x="148" y="40" width="9" height="36" />
      <rect className="lp-rig-fill" x="151" y="44" width="4" height="28" />
      <rect className="lp-rig-light" x="146" y="57" width="2" height="3" />
      {/* tripod */}
      <rect className="lp-rig-light" x="151" y="76" width="3" height="8" />
      <polygon className="lp-rig-light" points="151,84 154,84 142,106 139,106" />
      <polygon className="lp-rig-light" points="151,84 154,84 154,106 151,106" />
      <polygon className="lp-rig-light" points="151,84 154,84 166,106 163,106" />
      <text className="lp-rig-text lp-rig-text-wire" x="26" y="67" textAnchor="middle">TRIPWIRE</text>
      <text className="lp-rig-text" x="79" y="119" textAnchor="middle">BIN</text>
      <text className="lp-rig-text" x="152" y="119" textAnchor="middle">PHONE UPRIGHT</text>
      <text className="lp-rig-text" x="152" y="128" textAnchor="middle">TRIPOD / STAND</text>
      <text className="lp-rig-text" x="200" y="72" textAnchor="middle">YOU THROW</text>
      <text className="lp-rig-text" x="200" y="81" textAnchor="middle">FROM HERE</text>
    </svg>
  )
}
