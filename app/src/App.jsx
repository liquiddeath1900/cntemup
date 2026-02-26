import { useState, useEffect, useCallback, useRef } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Camera, isInCountZone } from './components/Camera'
import { Counter } from './components/Counter'
import { ModeSelector } from './components/ModeSelector'
import { TallyMode } from './components/TallyMode'
import { Auth } from './components/Auth'
import { Settings } from './components/Settings'
import { useCamera } from './hooks/useCamera'
import { useDetection } from './hooks/useDetection'
import { DETECTION_CONFIG } from './hooks/useObjectDetection'
import { useAuth } from './hooks/useAuth'
import { useDepositRules } from './hooks/useDepositRules'
import { createTracker } from './utils/tracker'
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
    const sessions = JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]')
    sessions.push(session)
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions))
  }
  return session
}

// Main counter/scanner page — Game Boy Color UI
function CounterPage() {
  const [count, setCount] = useState(0)
  const [sessionCount, setSessionCount] = useState(0)
  const [detections, setDetections] = useState([])
  const [isRunning, setIsRunning] = useState(false)
  const [savingSession, setSavingSession] = useState(false)
  const [topDetection, setTopDetection] = useState(null) // best detection for badge
  const [mode, setMode] = useState('scan') // 'scan' | 'tally'

  const { user, profile } = useAuth()
  const { rules, depositRate, calculateDeposit } = useDepositRules(profile?.state_code)
  const { videoRef, isStreaming, videoReady, error: cameraError, debugLog, devices, startCamera, stopCamera, switchCamera, handleTapToPlay } = useCamera()
  const { model, isLoading, loadProgress, error: modelError, loadModel, startDetection, stopDetection, modelType } = useDetection()

  // Object tracker — persists across frames, prevents double-counting
  const trackerRef = useRef(createTracker({
    iouThreshold: 0.3,
    maxMissedFrames: 8,
    minFramesToCount: DETECTION_CONFIG.requiredConsecutiveFrames,
    maxCentroidDist: 80,
  }))

  // Pre-load model on mount (not on first "Start" click)
  useEffect(() => {
    if (!model && !isLoading) {
      loadModel()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Detection handler using tracker
  const handleDetection = useCallback((objects) => {
    setDetections(objects)

    const video = videoRef.current
    if (!video) return

    // Filter to count zone
    const inZone = objects.filter(o =>
      isInCountZone(o.bbox, video.videoWidth, video.videoHeight)
    )

    // Update tracker with in-zone detections
    const { newlyCounted } = trackerRef.current.update(inZone)

    if (newlyCounted > 0) {
      setCount(prev => prev + newlyCounted)
      setSessionCount(prev => prev + newlyCounted)
    }

    // Show best detection for confidence badge
    if (objects.length > 0) {
      const best = objects.reduce((a, b) => a.score > b.score ? a : b)
      setTopDetection(best)
    } else {
      setTopDetection(null)
    }
  }, [videoRef])

  const handleManualAdd = () => {
    setCount(prev => prev + 1)
    setSessionCount(prev => prev + 1)
  }

  const handleManualSub = () => {
    if (count > 0) {
      setCount(prev => prev - 1)
      setSessionCount(prev => Math.max(0, prev - 1))
    }
  }

  const handleStart = async () => {
    setIsRunning(true)
    trackerRef.current.reset()
    await startCamera()
  }

  // Start detection when video is ready
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
    setTopDetection(null)
    trackerRef.current.reset()
  }

  const handleReset = () => {
    setCount(0)
    trackerRef.current.reset()
  }

  const handleClearSession = () => {
    setCount(0)
    setSessionCount(0)
    trackerRef.current.reset()
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

  const error = (cameraError && cameraError !== 'tap_to_play') ? cameraError : modelError
  const hasDeposit = profile?.state_code

  return (
    <div className="app">
      {/* Game Boy label/header */}
      <div className="gb-label">
        <div className="gb-label-row">
          <h1>CNTEM'UP</h1>
          <a href="/settings" className="settings-link">SET</a>
        </div>
        <p>Bottle & Can Counter</p>
      </div>

      {/* Mode toggle: SCAN | TALLY */}
      <ModeSelector mode={mode} setMode={setMode} />

      {/* ===== SCAN MODE (existing, untouched) ===== */}
      {mode === 'scan' && (
        <>
          <div className="gb-screen-bezel">
            <div className="gb-screen">
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
                topDetection={topDetection}
              />

              {isLoading && (
                <div className="gb-loading">
                  <span className="gb-loading-text">LOADING AI... {loadProgress}%</span>
                  <div className="gb-loading-bar">
                    <div className="gb-loading-fill" style={{ width: `${loadProgress}%` }} />
                  </div>
                </div>
              )}

              {error && <div className="gb-error">{error}</div>}
            </div>
          </div>

          <div className="gb-controls">
            <div className="gb-dpad-row">
              <button className="gb-dpad-btn gb-dpad-minus" onClick={handleManualSub}>−</button>
              {!isRunning ? (
                <button
                  className="gb-dpad-btn gb-scan-btn"
                  onClick={handleStart}
                  disabled={isLoading}
                >
                  {isLoading ? '...' : 'START'}
                </button>
              ) : (
                <button className="gb-dpad-btn gb-scan-btn gb-stop-btn" onClick={handleStop}>
                  STOP
                </button>
              )}
              <button className="gb-dpad-btn gb-dpad-plus" onClick={handleManualAdd}>+</button>
            </div>

            <div className="gb-action-row">
              <button className="gb-action-btn gb-start-btn" onClick={isRunning ? handleStop : handleStart} disabled={isLoading}>
                {isRunning ? 'STOP' : 'PAUSE'}
              </button>
              <button className="gb-action-btn gb-reset-btn" onClick={handleReset}>RESET</button>
            </div>

            <div className="gb-action-row">
              {sessionCount > 0 && (
                <button
                  className="gb-action-btn gb-save-btn"
                  onClick={handleSaveSession}
                  disabled={savingSession}
                >
                  {savingSession ? 'SAVING' : 'SAVE'}
                </button>
              )}
              <button className="gb-clear-btn" onClick={handleClearSession}>CLEAR</button>
            </div>
          </div>
        </>
      )}

      {/* ===== TALLY MODE (new) ===== */}
      {mode === 'tally' && (
        <>
          <div className="gb-screen-bezel">
            <div className="gb-screen">
              <TallyMode
                count={count}
                setCount={setCount}
                sessionCount={sessionCount}
                setSessionCount={setSessionCount}
              />

              <Counter
                count={count}
                sessionCount={sessionCount}
                isDetecting={false}
                depositRate={depositRate}
                stateCode={profile?.state_code}
                calculateDeposit={calculateDeposit}
                rules={rules}
                topDetection={null}
              />
            </div>
          </div>

          <div className="gb-controls">
            <div className="gb-dpad-row">
              <button className="gb-dpad-btn gb-dpad-minus" onClick={handleManualSub}>−</button>
              <button className="gb-dpad-btn gb-dpad-plus" onClick={handleManualAdd}>+</button>
            </div>

            <div className="gb-action-row">
              <button className="gb-action-btn gb-reset-btn" onClick={handleReset}>RESET</button>
            </div>

            <div className="gb-action-row">
              {sessionCount > 0 && (
                <button
                  className="gb-action-btn gb-save-btn"
                  onClick={handleSaveSession}
                  disabled={savingSession}
                >
                  {savingSession ? 'SAVING' : 'SAVE'}
                </button>
              )}
              <button className="gb-clear-btn" onClick={handleClearSession}>CLEAR</button>
            </div>
          </div>
        </>
      )}

      {/* Debug panel — dev only */}
      {import.meta.env.DEV && debugLog.length > 0 && (
        <div className="gb-debug">
          <strong>Debug:</strong>
          {debugLog.map((line, i) => (
            <div key={i} style={{ color: line.includes('ERROR') ? '#ef4444' : undefined }}>
              {line}
            </div>
          ))}
        </div>
      )}

      <footer className="gb-footer">
        <p>Point at bottles & cans</p>
        <p style={{ fontSize: '7px', marginTop: '2px', opacity: 0.5 }}>
          {modelType === 'yolo' ? 'YOLOv8 Custom' : 'COCO-SSD'} engine
        </p>
      </footer>
    </div>
  )
}

// Root app — routing
function App() {
  const { user, loading, setupLocal } = useAuth()
  const didSetup = useRef(false)

  if (!loading && !user && !didSetup.current) {
    didSetup.current = true
    setupLocal('NY', 'Counter')
  }

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
