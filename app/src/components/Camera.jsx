import { useEffect, useRef } from 'react'

// Check if a detection bbox center is inside the count zone (center 60% of frame)
export function isInCountZone(bbox, videoWidth, videoHeight) {
  const [x, y, w, h] = bbox
  const centerX = x + w / 2
  const centerY = y + h / 2

  const zoneLeft = videoWidth * 0.2
  const zoneRight = videoWidth * 0.8
  const zoneTop = videoHeight * 0.2
  const zoneBottom = videoHeight * 0.8

  return centerX >= zoneLeft && centerX <= zoneRight &&
         centerY >= zoneTop && centerY <= zoneBottom
}

// Camera component - displays video feed with detection overlay + count zone
export function Camera({
  videoRef,
  isStreaming,
  videoReady = false,
  detections = [],
  error,
  devices = [],
  onTapToPlay,
  onSwitchCamera,
}) {
  const canvasRef = useRef(null)

  // Draw count zone + detection boxes on canvas overlay
  useEffect(() => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video || !isStreaming) return

    // Guard: skip drawing if video has no dimensions yet (prevents 0x0 canvas)
    if (video.videoWidth === 0 || video.videoHeight === 0) return

    const ctx = canvas.getContext('2d')

    // Match canvas size to video
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Clear previous drawings
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw count zone (center 60% highlighted area)
    const zoneX = canvas.width * 0.2
    const zoneY = canvas.height * 0.2
    const zoneW = canvas.width * 0.6
    const zoneH = canvas.height * 0.6

    // Dim area outside count zone
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
    ctx.fillRect(0, 0, canvas.width, zoneY) // top
    ctx.fillRect(0, zoneY + zoneH, canvas.width, canvas.height - zoneY - zoneH) // bottom
    ctx.fillRect(0, zoneY, zoneX, zoneH) // left
    ctx.fillRect(zoneX + zoneW, zoneY, canvas.width - zoneX - zoneW, zoneH) // right

    // Count zone border
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.6)'
    ctx.lineWidth = 2
    ctx.setLineDash([8, 4])
    ctx.strokeRect(zoneX, zoneY, zoneW, zoneH)
    ctx.setLineDash([])

    // "Count Zone" label
    ctx.fillStyle = 'rgba(16, 185, 129, 0.7)'
    ctx.font = 'bold 14px system-ui'
    ctx.fillText('COUNT ZONE', zoneX + 8, zoneY + 20)

    // Draw detection boxes
    detections.forEach(detection => {
      const [x, y, width, height] = detection.bbox
      const inZone = isInCountZone(detection.bbox, canvas.width, canvas.height)

      // Green if in zone, gray if outside
      const color = inZone ? '#10b981' : '#6b7280'

      ctx.strokeStyle = color
      ctx.lineWidth = 3
      ctx.strokeRect(x, y, width, height)

      // Label background — use displayClass for user-friendly name
      ctx.fillStyle = color
      const label = `${detection.displayClass || detection.class} ${Math.round(detection.score * 100)}%`
      const textWidth = ctx.measureText(label).width
      ctx.fillRect(x, y - 25, textWidth + 10, 25)

      // Label text
      ctx.fillStyle = '#fff'
      ctx.font = '16px system-ui'
      ctx.fillText(label, x + 5, y - 7)
    })
  }, [detections, isStreaming, videoRef, videoReady])

  const showTapOverlay = error === 'tap_to_play'

  return (
    <div className="camera-container">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="camera-video"
        onClick={showTapOverlay ? onTapToPlay : undefined}
      />
      <canvas
        ref={canvasRef}
        className="camera-overlay"
      />

      {/* Tap-to-play overlay for iOS */}
      {showTapOverlay && (
        <div className="camera-tap-overlay" onClick={onTapToPlay}>
          <span>Tap to start camera</span>
        </div>
      )}

      {/* Camera switch button — only show when multiple cameras available */}
      {isStreaming && devices.length > 1 && (
        <button className="camera-switch-btn" onClick={onSwitchCamera} aria-label="Switch camera">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 16v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4"/>
            <polyline points="1 12 5 8 9 12"/>
            <polyline points="15 12 19 16 23 12"/>
            <path d="M5 8v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8"/>
          </svg>
        </button>
      )}

      {!isStreaming && (
        <div className="camera-placeholder">
          <span>📷</span>
          <p>Camera not active</p>
        </div>
      )}
    </div>
  )
}
