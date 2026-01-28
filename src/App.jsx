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

  const { videoRef, isStreaming, error: cameraError, startCamera, stopCamera } = useCamera()
  const { model, isLoading, error: modelError, loadModel, startDetection, stopDetection } = useObjectDetection()

  // Track previously detected objects to avoid double-counting
  const prevCountRef = useRef(0)

  // Handle detection results
  const handleDetection = useCallback((objects) => {
    setDetections(objects)
    const currentCount = objects.length

    // Only increment if we see MORE objects than before
    // This handles the "toss into bag" scenario
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
        startDetection(videoRef.current, handleDetection, 8) // 8 FPS for mobile perf
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
            {error}
          </div>
        )}

        {isLoading && (
          <div className="loading">
            Loading AI model...
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
