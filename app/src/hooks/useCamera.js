import { useState, useRef, useCallback, useEffect } from 'react'

// Custom hook for camera access
export function useCamera() {
  const videoRef = useRef(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState(null)
  const [debugLog, setDebugLog] = useState([])
  const streamRef = useRef(null)

  const log = useCallback((msg) => {
    console.log('[Camera]', msg)
    setDebugLog(prev => [...prev.slice(-9), `${new Date().toLocaleTimeString()}: ${msg}`])
  }, [])

  const startCamera = useCallback(async () => {
    try {
      setError(null)
      log('Starting camera...')

      // Stop any existing stream first
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        log('Stopped previous stream')
      }

      // Check if getUserMedia is available
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Camera not supported in this browser.')
        log('ERROR: getUserMedia not available')
        return
      }

      log('Requesting camera permission...')
      let stream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 640 },
            height: { ideal: 480 }
          },
          audio: false
        })
        log(`Got stream: ${stream.getVideoTracks()[0]?.label || 'unknown'}`)
      } catch (e1) {
        log(`First attempt failed: ${e1.name}. Trying fallback...`)
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        log(`Fallback got stream: ${stream.getVideoTracks()[0]?.label || 'unknown'}`)
      }

      streamRef.current = stream
      const track = stream.getVideoTracks()[0]
      const settings = track?.getSettings?.() || {}
      log(`Track: ${settings.width}x${settings.height} ${settings.facingMode || 'no-facing'}`)

      if (videoRef.current) {
        const video = videoRef.current
        video.srcObject = stream
        log(`srcObject set. readyState=${video.readyState}`)

        // Set streaming immediately to remove placeholder
        setIsStreaming(true)

        try {
          await video.play()
          log(`play() OK. readyState=${video.readyState} size=${video.videoWidth}x${video.videoHeight}`)
        } catch (playErr) {
          log(`play() failed: ${playErr.name} - ${playErr.message}`)
          setError(`Tap video to start: ${playErr.message}`)
        }
      } else {
        log('ERROR: videoRef.current is null!')
        setError('Video element not found. Try refreshing.')
      }
    } catch (err) {
      log(`FATAL: ${err.name} - ${err.message}`)
      if (err.name === 'NotAllowedError') {
        setError('Camera permission denied. Allow camera in browser settings.')
      } else if (err.name === 'NotFoundError') {
        setError('No camera found.')
      } else if (err.name === 'NotReadableError') {
        setError('Camera in use by another app. Close other camera apps.')
      } else {
        setError(`${err.name}: ${err.message}`)
      }
      setIsStreaming(false)
    }
  }, [log])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setIsStreaming(false)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [stopCamera])

  return {
    videoRef,
    isStreaming,
    error,
    debugLog,
    startCamera,
    stopCamera
  }
}
