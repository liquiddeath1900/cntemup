import { useState, useEffect, useCallback, useRef } from 'react'
import { Camera } from './components/Camera'
import { Counter } from './components/Counter'
import { useCamera } from './hooks/useCamera'
import { useObjectDetection } from './hooks/useObjectDetection'
import './App.css'

function App() {
  const [count, setCount] = useState(0)
  const [sessionCount, setSessionCount] = useState(0)
  const [detections, setDetections] = useState([])
  const [isRunning, setIsRunning] = useState(false)

  const {
    videoRef,
    isStreaming,
    error: cameraError,
    devices,
    selectedDevice,
    startCamera,
    stopCamera,
    switchCamera
  } = useCamera()

  const { model, isLoading, error: modelError, loadModel, startDetection, stopDetection } = useObjectDetection()

  // Track previously detected objects to avoid double-counting
  const prevCountRef = useRef(0)

  // Handle detection results
  const handleDetection = useCallback((objects) => {
    setDetections(objects)
    const currentCount = objects.length

    // Only increment if we see MORE objects than before
    if (currentCount > prevCountRef.current) {
      const newBottles = currentCount - prevCountRef.current
      setCount(prev => prev + newBottles)
      setSessionCount(prev => prev + newBottles)
    }

    prevCountRef.current = currentCount
  }, [])

  // Start scanning
  const handleStart = async () => {
    setIsRunning(true)

    // Load model if not loaded
    let activeModel = model
    if (!activeModel) {
      activeModel = await loadModel()
    }

    // Start camera
    await startCamera()

    // Small delay to ensure video is playing
    setTimeout(() => {
      if (videoRef.current && activeModel) {
        startDetection(videoRef.current, handleDetection, 8)
      }
    }, 500)
  }

  // Stop scanning
  const handleStop = () => {
    setIsRunning(false)
    stopDetection()
    stopCamera()
    setDetections([])
    prevCountRef.current = 0
  }

  // Reset current count (keep session)
  const handleReset = () => {
    setCount(0)
    prevCountRef.current = 0
  }

  // Reset everything
  const handleClearSession = () => {
    setCount(0)
    setSessionCount(0)
    prevCountRef.current = 0
  }

  // Handle camera switch
  const handleCameraChange = async (e) => {
    const deviceId = e.target.value
    await switchCamera(deviceId)
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopDetection()
      stopCamera()
    }
  }, [stopDetection, stopCamera])

  const error = cameraError || modelError

  return (
    <div className="app">
      <header className="header">
        <h1>CNTEM'UP</h1>
        <p>Bottle & Can Counter</p>
      </header>

      <main className="main">
        {/* Camera selector */}
        {devices.length > 1 && (
          <div className="camera-selector">
            <label htmlFor="camera-select">Camera:</label>
            <select
              id="camera-select"
              value={selectedDevice || ''}
              onChange={handleCameraChange}
              className="camera-dropdown"
            >
              {devices.map((device, index) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Camera ${index + 1}`}
                </option>
              ))}
            </select>
          </div>
        )}

        <Camera
          videoRef={videoRef}
          isStreaming={isStreaming}
          detections={detections}
        />

        <Counter
          count={count}
          sessionCount={sessionCount}
          isDetecting={isRunning && isStreaming}
        />

        {error && (
          <div className="error">
            <svg className="error-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p>{error}</p>
          </div>
        )}

        {isLoading && (
          <div className="loading">
            <div className="loading-spinner"></div>
            <p>Loading AI model...</p>
            <p className="hint">This may take a moment</p>
          </div>
        )}

        <div className="controls">
          {!isRunning ? (
            <button
              className="btn btn-primary"
              onClick={handleStart}
              disabled={isLoading}
            >
              {isLoading ? 'Loading...' : 'Start Counting'}
            </button>
          ) : (
            <button
              className="btn btn-danger"
              onClick={handleStop}
            >
              Stop
            </button>
          )}

          <button
            className="btn btn-secondary"
            onClick={handleReset}
          >
            Reset Count
          </button>

          <button
            className="btn btn-ghost"
            onClick={handleClearSession}
          >
            Clear Session
          </button>
        </div>
      </main>

      <footer className="footer">
        <p>Point camera at bottles & cans</p>
      </footer>
    </div>
  )
}

export default App
