import { useState, useRef, useCallback, useEffect } from 'react'

// Custom hook for camera access with iOS support + camera switching
export function useCamera() {
  const videoRef = useRef(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [videoReady, setVideoReady] = useState(false) // true when video has dimensions
  const [error, setError] = useState(null)
  const [debugLog, setDebugLog] = useState([])
  const [devices, setDevices] = useState([])
  const [activeDeviceIndex, setActiveDeviceIndex] = useState(0)
  const streamRef = useRef(null)

  const log = useCallback((msg) => {
    console.log('[Camera]', msg)
    setDebugLog(prev => [...prev.slice(-9), `${new Date().toLocaleTimeString()}: ${msg}`])
  }, [])

  // Enumerate available video input devices
  const enumeratecameras = useCallback(async () => {
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = allDevices.filter(d => d.kind === 'videoinput')
      setDevices(videoDevices)
      log(`Found ${videoDevices.length} camera(s)`)
      return videoDevices
    } catch (err) {
      log(`Device enumeration failed: ${err.message}`)
      return []
    }
  }, [log])

  // Attach video-ready listeners to detect when dimensions are available
  const attachReadyListeners = useCallback((video) => {
    const checkReady = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        log(`Video ready: ${video.videoWidth}x${video.videoHeight}`)
        setVideoReady(true)
      }
    }

    video.addEventListener('playing', checkReady)
    video.addEventListener('loadedmetadata', checkReady)

    // Check immediately in case already ready
    checkReady()

    return () => {
      video.removeEventListener('playing', checkReady)
      video.removeEventListener('loadedmetadata', checkReady)
    }
  }, [log])

  const startCamera = useCallback(async (deviceId = null) => {
    try {
      setError(null)
      setVideoReady(false)
      log('Starting camera...')

      // Stop any existing stream first
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        log('Stopped previous stream')
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Camera not supported in this browser.')
        log('ERROR: getUserMedia not available')
        return
      }

      log('Requesting camera permission...')
      let stream

      // Build constraints — use deviceId if specified, otherwise prefer rear camera
      const constraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId } }
          : { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints)
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

      // Enumerate cameras after permission granted (labels now available)
      await enumeratecameras()

      if (videoRef.current) {
        const video = videoRef.current
        video.srcObject = stream
        log(`srcObject set. readyState=${video.readyState}`)

        // Set streaming to show video element, but videoReady stays false until dimensions load
        setIsStreaming(true)

        // Attach ready listeners before play
        const cleanup = attachReadyListeners(video)

        try {
          await video.play()
          log(`play() OK. readyState=${video.readyState} size=${video.videoWidth}x${video.videoHeight}`)
        } catch (playErr) {
          // iOS Safari blocks autoplay — keep streaming true so video stays mounted for tap
          log(`play() failed: ${playErr.name} - ${playErr.message}`)
          if (playErr.name === 'NotAllowedError') {
            setError('tap_to_play') // special flag for Camera component
          } else {
            setError(`Play failed: ${playErr.message}`)
          }
        }

        // Store cleanup for later
        video._readyCleanup = cleanup
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
      setVideoReady(false)
    }
  }, [log, enumeratecameras, attachReadyListeners])

  // Switch to next available camera
  const switchCamera = useCallback(async () => {
    if (devices.length < 2) return
    const nextIndex = (activeDeviceIndex + 1) % devices.length
    setActiveDeviceIndex(nextIndex)
    log(`Switching to camera ${nextIndex}: ${devices[nextIndex]?.label || 'unknown'}`)
    await startCamera(devices[nextIndex].deviceId)
  }, [devices, activeDeviceIndex, startCamera, log])

  // Handle tap-to-play for iOS
  const handleTapToPlay = useCallback(async () => {
    const video = videoRef.current
    if (!video) return
    try {
      await video.play()
      setError(null)
      log('Tap-to-play OK')
    } catch (err) {
      log(`Tap-to-play failed: ${err.message}`)
    }
  }, [log])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current._readyCleanup?.()
      videoRef.current.srcObject = null
    }
    setIsStreaming(false)
    setVideoReady(false)
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
    videoReady,
    error,
    debugLog,
    devices,
    startCamera,
    stopCamera,
    switchCamera,
    handleTapToPlay
  }
}
