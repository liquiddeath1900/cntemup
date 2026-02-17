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
  const { videoRef, isStreaming, error: cameraError, startCamera, stopCamera } = useCamera()
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

    // Wait for video to be ready before starting detection
    const video = videoRef.current
    if (video && activeModel) {
      if (video.readyState >= 3) {
        startDetection(video, handleDetection)
      } else {
        const onReady = () => {
          video.removeEventListener('canplay', onReady)
          startDetection(video, handleDetection)
        }
        video.addEventListener('canplay', onReady)
      }
    }
  }

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

  const error = cameraError || modelError

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
          detections={detections}
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
          <div className="loading">Loading AI model...</div>
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

      <footer className="footer">
        <p>Point camera at bottles & cans</p>
      </footer>
    </div>
  )
}

// Root app — routing (no auth gate, counter-first)
function App() {
  const { user, loading, setupLocal } = useAuth()

  // Auto-setup local profile if no user — skip login, go straight to counter
  useEffect(() => {
    if (!loading && !user) {
      setupLocal('NY', 'Counter')
    }
  }, [loading, user, setupLocal])

  if (loading || !user) {
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
