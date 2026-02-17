import { useState, useRef, useCallback, useEffect } from 'react'

// Custom hook for camera access
export function useCamera() {
  const videoRef = useRef(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState(null)
  const streamRef = useRef(null)

  const startCamera = useCallback(async () => {
    try {
      setError(null)

      // Stop any existing stream first
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }

      // Check if getUserMedia is available
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Camera not supported in this browser. Try Chrome or Safari.')
        return
      }

      // Try to get camera - works with webcams and mobile
      let stream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment', // prefer rear camera on mobile
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        })
      } catch {
        // Fallback: basic video request
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        })
      }

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        // Wait for video to be ready before calling play
        await new Promise((resolve, reject) => {
          const video = videoRef.current
          if (!video) return reject(new Error('Video element not found'))

          // If already ready, resolve immediately
          if (video.readyState >= 2) {
            resolve()
            return
          }

          const onLoaded = () => {
            video.removeEventListener('loadeddata', onLoaded)
            video.removeEventListener('error', onError)
            resolve()
          }
          const onError = (e) => {
            video.removeEventListener('loadeddata', onLoaded)
            video.removeEventListener('error', onError)
            reject(e)
          }
          video.addEventListener('loadeddata', onLoaded)
          video.addEventListener('error', onError)
        })

        try {
          await videoRef.current.play()
        } catch (playErr) {
          // On iOS/Safari, autoplay may be blocked — set up tap-to-play
          console.warn('Autoplay blocked, setting up tap-to-play:', playErr)
          videoRef.current.setAttribute('controls', true)
        }
        setIsStreaming(true)
      }
    } catch (err) {
      console.error('Camera error:', err)
      if (err.name === 'NotAllowedError') {
        setError('Camera permission denied. Please allow camera access in your browser settings.')
      } else if (err.name === 'NotFoundError') {
        setError('No camera found on this device.')
      } else {
        setError(err.message || 'Failed to access camera. Check browser permissions.')
      }
      setIsStreaming(false)
    }
  }, [])

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
    startCamera,
    stopCamera
  }
}
