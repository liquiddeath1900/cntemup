import { useState, useEffect, useCallback, useRef } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { LandingPage } from './components/LandingPage'
import { Counter } from './components/Counter'
import { Auth } from './components/Auth'
import { Settings } from './components/Settings'
import { History } from './components/History'
import { Tips } from './components/Tips'
import { AdminPage } from './components/AdminPage'
import { AlertModal } from './components/AlertModal'
import { useCamera } from './hooks/useCamera'
import { useTripwire } from './hooks/useTripwire'
import { useAuth } from './hooks/useAuth'
import { useDepositRules } from './hooks/useDepositRules'
import { useSound } from './hooks/useSound'
import { usePremium } from './hooks/usePremium'
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

// Main counter page — camera + tripwire counting
function CounterPage() {
  const [count, setCount] = useState(0)
  const [sessionCount, setSessionCount] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [savingSession, setSavingSession] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [showAlertModal, setShowAlertModal] = useState(false)
  const [alertFired, setAlertFired] = useState(false)
  const cameraContainerRef = useRef(null)

  const { user, profile } = useAuth()
  const { isPremium, alertTarget } = usePremium(profile)
  const { rules, depositRate, calculateDeposit } = useDepositRules(profile?.state_code)
  const { muted, toggleMute, playCount, playAlarm, playBoot } = useSound()
  const { videoRef, isStreaming, videoReady, error: cameraError, debugLog, devices, startCamera, stopCamera, switchCamera, handleTapToPlay } = useCamera()
  const { startTripwire, stopTripwire, tripwireY, setTripwireY, isTriggered, setOnTrigger } = useTripwire()

  // Wire tripwire trigger → increment count + sound + alert check
  useEffect(() => {
    setOnTrigger(() => {
      setCount(prev => prev + 1)
      setSessionCount(prev => {
        const next = prev + 1
        // Check alert target (premium only)
        if (isPremium && alertTarget > 0 && next === alertTarget && !alertFired) {
          setAlertFired(true)
          setShowAlertModal(true)
          playAlarm()
        }
        return next
      })
      playCount()
    })
  }, [setCount, setSessionCount, setOnTrigger, playCount, isPremium, alertTarget, alertFired, playAlarm])

  // Start tripwire when video is ready
  useEffect(() => {
    if (isRunning && videoReady && videoRef.current) {
      startTripwire(videoRef.current)
    }
  }, [isRunning, videoReady, videoRef, startTripwire])

  const handleManualAdd = () => {
    setCount(prev => prev + 1)
    setSessionCount(prev => prev + 1)
    playCount()
  }

  const handleManualSub = () => {
    if (count > 0) {
      setCount(prev => prev - 1)
      setSessionCount(prev => Math.max(0, prev - 1))
    }
  }

  const handleStart = async () => {
    // Play boot chime on tap — call playCount first to unlock iOS audio context
    playCount()
    setTimeout(() => playBoot(), 150)
    // Delay camera start so sound plays before permission prompt
    setTimeout(async () => {
      setIsRunning(true)
      await startCamera()
    }, 700)
  }

  const handleStop = () => {
    setIsRunning(false)
    stopTripwire()
    stopCamera()
  }

  const handleReset = () => {
    setCount(0)
  }

  const handleClearSession = () => {
    setCount(0)
    setSessionCount(0)
    setAlertFired(false)
    setShowAlertModal(false)
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTripwire()
      stopCamera()
    }
  }, [stopTripwire, stopCamera])

  // Drag tripwire line
  const handleDragStart = useCallback((e) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragMove = useCallback((e) => {
    if (!isDragging || !cameraContainerRef.current) return
    const rect = cameraContainerRef.current.getBoundingClientRect()
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    const y = Math.max(0.1, Math.min(0.9, (clientY - rect.top) / rect.height))
    setTripwireY(y)
  }, [isDragging, setTripwireY])

  const handleDragEnd = useCallback(() => {
    setIsDragging(false)
  }, [])

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

  const error = cameraError && cameraError !== 'tap_to_play' ? cameraError : null

  return (
    <div className="app">
      {/* Alert modal */}
      {showAlertModal && (
        <AlertModal
          target={alertTarget}
          count={sessionCount}
          onSave={() => {
            setShowAlertModal(false)
            handleSaveSession()
          }}
          onKeepCounting={() => setShowAlertModal(false)}
        />
      )}

      {/* Header */}
      <div className="gb-label">
        <div className="gb-label-row">
          <button className="mute-btn" onClick={toggleMute}>
            {muted ? '🔇' : '🔊'}
          </button>
          <h1>CNTEM'UP{isPremium && <span className="pro-badge">PRO</span>}</h1>
          <a href="/settings" className="settings-link">SET</a>
        </div>
        <p>Bottle & Can Counter</p>
      </div>

      {/* Screen */}
      <div className="gb-screen-bezel">
        <div className="gb-screen">
          {/* Camera + tripwire */}
          <div className="camera-container" ref={cameraContainerRef}>
            <video
              ref={videoRef}
              className="camera-video"
              playsInline
              muted
              autoPlay
            />

            {/* Tripwire line — visible when camera is running */}
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

            {/* Camera switch */}
            {devices.length > 1 && isStreaming && (
              <button className="camera-switch-btn" onClick={switchCamera}>↻</button>
            )}

            {/* Tap to play (iOS) */}
            {cameraError === 'tap_to_play' && (
              <div className="camera-tap-overlay" onClick={handleTapToPlay}>
                <span>TAP TO START</span>
              </div>
            )}

            {/* Placeholder when camera off */}
            {!isStreaming && (
              <div className="camera-placeholder">
                <span>⎔</span>
                <p>PRESS START</p>
              </div>
            )}
          </div>

          {/* Count display */}
          <Counter
            count={count}
            sessionCount={sessionCount}
            isDetecting={isRunning && isStreaming}
            depositRate={depositRate}
            stateCode={profile?.state_code}
            calculateDeposit={calculateDeposit}
            rules={rules}
            topDetection={null}
            isPremium={isPremium}
          />

          {error && <div className="gb-error">{error}</div>}
        </div>
      </div>

      {/* Controls */}
      <div className="gb-controls">
        <div className="gb-dpad-row">
          <button className="gb-dpad-btn gb-dpad-minus" onClick={handleManualSub}>−</button>

          {!isRunning ? (
            <button className="gb-dpad-btn gb-scan-btn" onClick={handleStart}>
              START
            </button>
          ) : (
            <button className="gb-dpad-btn gb-scan-btn gb-stop-btn" onClick={handleStop}>
              STOP
            </button>
          )}

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

      {/* Debug — dev only */}
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
        <p>Pass items across the line</p>
      </footer>
    </div>
  )
}

// Admin route guard — checks email against env var
function AdminRoute({ element }) {
  const { user, loading } = useAuth()
  const adminEmail = import.meta.env.VITE_ADMIN_EMAIL
  if (loading) return null
  if (!user || !adminEmail || user.email !== adminEmail) {
    window.location.href = '/'
    return null
  }
  return element
}

// Root app — routing
function App() {
  const { user, loading, setupLocal } = useAuth()
  const didSetup = useRef(false)

  useEffect(() => {
    if (!loading && !user && !didSetup.current) {
      didSetup.current = true
      setupLocal('NY', 'Counter')
    }
  }, [loading, user, setupLocal])

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
        <Route path="/" element={<LandingPage />} />
        <Route path="/app" element={<CounterPage />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/login" element={<Auth />} />
        <Route path="/history" element={<History />} />
        <Route path="/tips" element={<Tips />} />
        <Route path="/admin" element={<AdminRoute element={<AdminPage />} />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
