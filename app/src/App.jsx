import { useState, useEffect, useCallback, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Camera, isInCountZone } from './components/Camera'
import { Counter } from './components/Counter'
import { Auth } from './components/Auth'
import { Settings } from './components/Settings'
import { useCamera } from './hooks/useCamera'
import { useObjectDetection, DETECTION_CONFIG } from './hooks/useObjectDetection'
import { useAuth } from './hooks/useAuth'
import { useDepositRules } from './hooks/useDepositRules'
import { supabase, supabaseEnabled } from './lib/supabase'
import './App.css'

const SESSIONS_KEY = 'cntemup_sessions'

// Save session locally or to Supabase
async function saveSession(userId, count, depositValue, stateCode) {
  const session = {
    id: crypto.randomUUID(),
    user_id: userId,
    count,
    deposit_value: depositValue,
    state_code: stateCode,
    created_at: new Date().toISOString(),
  }

  if (supabaseEnabled && supabase && userId !== 'local') {
    const { error } = await supabase.from('counting_sessions').insert(session)
    if (error) throw error
  } else {
    // localStorage fallback
    const sessions = JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]')
    sessions.push(session)
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions))
  }
  return session
}

// Main counter/scanner page
function CounterPage() {
  const [count, setCount] = useState(0)
  const [sessionCount, setSessionCount] = useState(0)
  const [detections, setDetections] = useState([])
  const [isRunning, setIsRunning] = useState(false)
  const [savingSession, setSavingSession] = useState(false)

  const { user, profile } = useAuth()
  const { rules, depositRate, calculateDeposit } = useDepositRules(profile?.state_code)
  const { videoRef, isStreaming, videoReady, error: cameraError, debugLog, devices, startCamera, stopCamera, switchCamera, handleTapToPlay } = useCamera()
  const { model, isLoading, error: modelError, loadModel, startDetection, stopDetection } = useObjectDetection()

  // Detection history for debounce — track last N frames
  const frameHistoryRef = useRef([])
  const prevStableCountRef = useRef(0)

  // Debounced detection handler — only count after 3 consecutive frames
  const handleDetection = useCallback((objects) => {
    setDetections(objects)

    const video = videoRef.current
    if (!video) return
    const inZone = objects.filter(o =>
      isInCountZone(o.bbox, video.videoWidth, video.videoHeight)
    )
    const currentCount = inZone.length

    const history = frameHistoryRef.current
    history.push(currentCount)
    if (history.length > DETECTION_CONFIG.requiredConsecutiveFrames) {
      history.shift()
    }

    if (history.length === DETECTION_CONFIG.requiredConsecutiveFrames) {
      const allSame = history.every(c => c === currentCount)
      if (allSame && currentCount > prevStableCountRef.current) {
        const newBottles = currentCount - prevStableCountRef.current
        setCount(prev => prev + newBottles)
        setSessionCount(prev => prev + newBottles)
        prevStableCountRef.current = currentCount
      } else if (allSame && currentCount < prevStableCountRef.current) {
        prevStableCountRef.current = currentCount
      }
    }
  }, [videoRef])

  const handleManualCount = () => {
    setCount(prev => prev + 1)
    setSessionCount(prev => prev + 1)
  }

  const handleStart = async () => {
    setIsRunning(true)
    frameHistoryRef.current = []
    prevStableCountRef.current = 0

    let activeModel = model
    if (!activeModel) {
      activeModel = await loadModel()
    }

    await startCamera()
    // Detection start is now gated by the videoReady useEffect below
  }

  // Start detection only when video has real dimensions — prevents 0x0 canvas bug
  useEffect(() => {
    if (isRunning && videoReady && model && videoRef.current) {
      startDetection(videoRef.current, handleDetection)
    }
  }, [isRunning, videoReady, model, startDetection, handleDetection, videoRef])

  const handleStop = () => {
    setIsRunning(false)
    stopDetection()
    stopCamera()
    setDetections([])
    frameHistoryRef.current = []
    prevStableCountRef.current = 0
  }

  const handleReset = () => {
    setCount(0)
    frameHistoryRef.current = []
    prevStableCountRef.current = 0
  }

  const handleClearSession = () => {
    setCount(0)
    setSessionCount(0)
    frameHistoryRef.current = []
    prevStableCountRef.current = 0
  }

  const handleSaveSession = async () => {
    if (!user || sessionCount === 0) return
    setSavingSession(true)
    try {
      const depositValue = calculateDeposit(sessionCount)
      await saveSession(user.id, sessionCount, depositValue, profile?.state_code || 'NY')
      handleClearSession()
    } catch (err) {
      console.error('Save session error:', err)
    } finally {
      setSavingSession(false)
    }
  }

  useEffect(() => {
    return () => {
      stopDetection()
      stopCamera()
    }
  }, [stopDetection, stopCamera])

  // Don't show tap_to_play as an error — it's handled by Camera overlay
  const error = (cameraError && cameraError !== 'tap_to_play') ? cameraError : modelError

  return (
    <div className="app">
      <header className="header">
        <div className="header-row">
          <h1>CNTEM'UP</h1>
          <a href="/settings" className="settings-link">Settings</a>
        </div>
        <p>Bottle & Can Counter</p>
      </header>

      <main className="main">
        <Camera
          videoRef={videoRef}
          isStreaming={isStreaming}
          videoReady={videoReady}
          detections={detections}
          error={cameraError}
          devices={devices}
          onTapToPlay={handleTapToPlay}
          onSwitchCamera={switchCamera}
        />

        <Counter
          count={count}
          sessionCount={sessionCount}
          isDetecting={isRunning && isStreaming}
          depositRate={depositRate}
          stateCode={profile?.state_code}
          calculateDeposit={calculateDeposit}
          rules={rules}
        />

        {error && (
          <div className="error">{error}</div>
        )}

        {isLoading && (
          <div className="loading">Loading AI model... this may take a few seconds</div>
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
            <>
              <button className="btn btn-danger" onClick={handleStop}>
                Stop
              </button>
              <button className="btn btn-manual" onClick={handleManualCount}>
                + Manual Count
              </button>
            </>
          )}

          <button className="btn btn-secondary" onClick={handleReset}>
            Reset Count
          </button>

          {sessionCount > 0 && (
            <button
              className="btn btn-primary"
              onClick={handleSaveSession}
              disabled={savingSession}
            >
              {savingSession ? 'Saving...' : 'Save Session'}
            </button>
          )}

          <button className="btn btn-ghost" onClick={handleClearSession}>
            Clear Session
          </button>
        </div>
      </main>

      {/* Debug panel — only visible in dev mode */}
      {import.meta.env.DEV && debugLog.length > 0 && (
        <div style={{
          margin: '1rem',
          padding: '0.75rem',
          background: '#000',
          borderRadius: '8px',
          fontSize: '11px',
          fontFamily: 'monospace',
          color: '#10b981',
          maxHeight: '150px',
          overflow: 'auto',
          whiteSpace: 'pre-wrap'
        }}>
          <strong>Camera Debug:</strong>
          {debugLog.map((line, i) => (
            <div key={i} style={{ color: line.includes('ERROR') || line.includes('FATAL') ? '#ef4444' : '#10b981' }}>
              {line}
            </div>
          ))}
        </div>
      )}

      <footer className="footer">
        <p>Point camera at bottles & cans</p>
      </footer>
    </div>
  )
}

// Root app — routing (no auth gate, counter-first)
function App() {
  const { user, loading, setupLocal } = useAuth()
  const didSetup = useRef(false)

  // Auto-setup local profile synchronously during render (not in useEffect)
  // This prevents the loading screen race condition
  if (!loading && !user && !didSetup.current) {
    didSetup.current = true
    setupLocal('NY', 'Counter')
  }

  // Only gate on auth initialization, not on user existence
  if (loading) {
    return (
      <div className="app">
        <div className="loading-screen">
          <h1>CNTEM'UP</h1>
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CounterPage />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/login" element={<Auth />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
