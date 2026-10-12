// Score card — draws a shareable image in the active theme's colors.
// With `seconds` it is a challenge result; without, it is a plain count.

const W = 1080
const H = 1350
const FONT = '"Press Start 2P", monospace'

function themeColor(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

export async function makeScoreCard({ score, seconds, isRecord }) {
  // Canvas can only use the pixel font once the browser has it loaded
  try {
    await document.fonts.load(`40px ${FONT}`)
  } catch {
    /* falls back to monospace */
  }

  const bg = themeColor('--gb-screen-bg', '#0f380f')
  const light = themeColor('--gb-screen-light', '#9bbc0f')
  const dark = themeColor('--gb-screen-dark', '#306230')

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // LCD scan lines
  ctx.fillStyle = 'rgba(0, 0, 0, 0.12)'
  for (let y = 0; y < H; y += 8) ctx.fillRect(0, y, W, 3)

  // Bezel
  ctx.strokeStyle = dark
  ctx.lineWidth = 16
  ctx.strokeRect(40, 40, W - 80, H - 80)

  ctx.textAlign = 'center'
  ctx.fillStyle = light

  ctx.font = `64px ${FONT}`
  ctx.fillText("CNTEM'UP", W / 2, 210)

  ctx.font = `30px ${FONT}`
  ctx.fillStyle = dark
  ctx.fillRect(170, 270, W - 340, 76)
  ctx.fillStyle = bg
  ctx.fillText(seconds ? `${seconds} SECOND CHALLENGE` : 'COUNTED WITH MY PHONE', W / 2, 322)

  // The score, as big as it will fit
  const text = String(score)
  const size = { 1: 380, 2: 380, 3: 280 }[text.length] || 210
  ctx.fillStyle = light
  ctx.font = `${size}px ${FONT}`
  ctx.fillText(text, W / 2 + size * 0.04, 760)

  ctx.font = `36px ${FONT}`
  ctx.fillText('BOTTLES & CANS', W / 2, 870)

  if (isRecord) {
    ctx.font = `30px ${FONT}`
    ctx.fillText('* NEW PERSONAL BEST *', W / 2, 950)
  }

  ctx.font = `46px ${FONT}`
  ctx.fillText(seconds ? 'CAN YOU BEAT IT?' : 'COUNT YOURS FREE', W / 2, 1100)

  ctx.font = `30px ${FONT}`
  ctx.fillStyle = dark
  ctx.fillText('cntemup.com', W / 2, 1210)

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
}

// Opens the phone's share sheet with the image; falls back to a download on browsers without it.
// Returns 'shared', 'saved' or 'cancelled'.
export async function shareScoreCard({ score, seconds, isRecord }) {
  const blob = await makeScoreCard({ score, seconds, isRecord })
  if (!blob) return 'cancelled'
  const file = new File([blob], `cntemup-${score}.png`, { type: 'image/png' })
  const text = seconds
    ? `I counted ${score} bottles and cans in ${seconds} seconds on CNTEM'UP. Can you beat it? cntemup.com`
    : `I just counted ${score} bottles and cans with my phone camera on CNTEM'UP. cntemup.com`

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text })
      return 'shared'
    } catch {
      return 'cancelled'
    }
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return 'saved'
}
