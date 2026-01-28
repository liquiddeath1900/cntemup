import { useEffect, useRef } from 'react'

// Camera component - displays video feed with detection overlay
export function Camera({ videoRef, isStreaming, detections = [] }) {
  const canvasRef = useRef(null)

  // Draw detection boxes on canvas overlay
  useEffect(() => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video || !isStreaming) return

    const ctx = canvas.getContext('2d')

    // Match canvas size to video
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Clear previous drawings
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw detection boxes
    detections.forEach(detection => {
      const [x, y, width, height] = detection.bbox

      // Box style
      ctx.strokeStyle = '#10b981'
      ctx.lineWidth = 3
      ctx.strokeRect(x, y, width, height)

      // Label background
      ctx.fillStyle = '#10b981'
      const label = `${detection.class} ${Math.round(detection.score * 100)}%`
      const textWidth = ctx.measureText(label).width
      ctx.fillRect(x, y - 25, textWidth + 10, 25)

      // Label text
      ctx.fillStyle = '#fff'
      ctx.font = '16px system-ui'
      ctx.fillText(label, x + 5, y - 7)
    })
  }, [detections, isStreaming, videoRef])

  return (
    <div className="camera-container">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="camera-video"
      />
      <canvas
        ref={canvasRef}
        className="camera-overlay"
      />
      {!isStreaming && (
        <div className="camera-placeholder">
          <span>📷</span>
          <p>Camera not active</p>
        </div>
      )}
    </div>
  )
}
