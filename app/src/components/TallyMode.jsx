import { useState, useCallback, useRef, useEffect } from 'react'
import { useCamera } from '../hooks/useCamera'
import { useTripwire } from '../hooks/useTripwire'

// TallyMode — manual tap counter + camera-based tripwire counting
// Two sub-modes: TAP (no camera, big +1 button) and TRIPWIRE (camera + beam line)
export function TallyMode({ count, setCount, sessionCount, setSessionCount }) {
  const [subMode, setSubMode] = useState('tap') // 'tap' | 'tripwire'
  const [tripwireActive, setTripwireActive] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef(null)

  const {
    videoRef,
    isStreaming,
    videoReady,
    startCamera,
    stopCamera,
    devices,
    switchCamera,
  } = useCamera()

  const {
    startTripwire,
    stopTripwire,
    tripwireY,
    setTripwireY,
    isTriggered,
    setOnTrigger,
  } = useTripwire()

  // Wire tripwire trigger → increment count
  useEffect(() => {
    setOnTrigger(() => {
      setCount(prev => prev + 1)
      setSessionCount(prev => prev + 1)
    })
  }, [setCount, setSessionCount, setOnTrigger])

  // Tap handler
  const handleTap = useCallback(() => {
    setCount(prev => prev + 1)
    setSessionCount(prev => prev + 1)
  }, [setCount, setSessionCount])

  // Start tripwire camera + detection
  const handleStartTripwire = useCallback(async () => {
    await startCamera()
    setTripwireActive(true)
  }, [startCamera])

  // Once video is ready, start the tripwire loop
  useEffect(() => {
    if (tripwireActive && videoReady && videoRef.current) {
      startTripwire(videoRef.current)
    }
  }, [tripwireActive, videoReady, videoRef, startTripwire])

  const handleStopTripwire = useCallback(() => {
    stopTripwire()
    stopCamera()
    setTripwireActive(false)
  }, [stopTripwire, stopCamera])

  // Cleanup on unmount or mode switch
  useEffect(() => {
    return () => {
      stopTripwire()
      stopCamera()
    }
  }, [stopTripwire, stopCamera])

  // Stop tripwire when switching to tap mode
  useEffect(() => {
    if (subMode === 'tap' && tripwireActive) {
      handleStopTripwire()
    }
  }, [subMode]) // eslint-disable-line react-hooks/exhaustive-deps

  // Drag tripwire line vertically
  const handleDragStart = useCallback((e) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragMove = useCallback((e) => {
    if (!isDragging || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    const y = Math.max(0.1, Math.min(0.9, (clientY - rect.top) / rect.height))
    setTripwireY(y)
  }, [isDragging, setTripwireY])

  const handleDragEnd = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Attach drag listeners to window for smooth dragging
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove)
      window.addEventListener('mouseup', handleDragEnd)
      window.addEventListener('touchmove', handleDragMove, { passive: false })
      window.addEventListener('touchend', handleDragEnd)
      return () => {
        window.removeEventListener('mousemove', handleDragMove)
        window.removeEventListener('mouseup', handleDragEnd)
        window.removeEventListener('touchmove', handleDragMove)
        window.removeEventListener('touchend', handleDragEnd)
      }
    }
  }, [isDragging, handleDragMove, handleDragEnd])

  return (
    <div className="tally-mode">
      {/* Sub-mode toggle: TAP vs TRIPWIRE */}
      <div className="tally-toggle">
        <button
          className={`tally-toggle-btn ${subMode === 'tap' ? 'tally-toggle-active' : ''}`}
          onClick={() => setSubMode('tap')}
        >
          TAP
        </button>
        <button
          className={`tally-toggle-btn ${subMode === 'tripwire' ? 'tally-toggle-active' : ''}`}
          onClick={() => setSubMode('tripwire')}
        >
          TRIPWIRE
        </button>
      </div>

      {/* TAP sub-mode */}
      {subMode === 'tap' && (
        <div className="tally-tap-area">
          <button className="tap-button" onClick={handleTap}>
            <span className="tap-button-plus">+1</span>
          </button>
          <p className="tap-hint">TAP TO COUNT</p>
        </div>
      )}

      {/* TRIPWIRE sub-mode */}
      {subMode === 'tripwire' && (
        <div className="tally-tripwire-area" ref={containerRef}>
          {/* Video feed */}
          <video
            ref={videoRef}
            className="camera-video"
            playsInline
            muted
            autoPlay
          />

          {/* Tripwire line overlay */}
          {isStreaming && (
            <div
              className={`tripwire-line ${isTriggered ? 'tripwire-trigger-flash' : ''}`}
              style={{ top: `${tripwireY * 100}%` }}
              onMouseDown={handleDragStart}
              onTouchStart={handleDragStart}
            >
              <span className="tripwire-label">TRIPWIRE</span>
              <span className="tripwire-handle" />
            </div>
          )}

          {/* Camera switch button */}
          {devices.length > 1 && (
            <button className="camera-switch-btn" onClick={switchCamera}>
              ↻
            </button>
          )}

          {/* Start/Stop controls */}
          {!tripwireActive ? (
            <button className="tripwire-start-btn" onClick={handleStartTripwire}>
              START
            </button>
          ) : (
            <button className="tripwire-stop-btn" onClick={handleStopTripwire}>
              STOP
            </button>
          )}

          {!isStreaming && !tripwireActive && (
            <div className="camera-placeholder">
              <span>⎔</span>
              <p>TRIPWIRE CAM</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
