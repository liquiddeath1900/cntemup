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

      // Try to get camera - works with webcams and mobile
      let stream
      try {
        // First try: any available camera
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
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
        await videoRef.current.play()
        setIsStreaming(true)
      }
    } catch (err) {
      console.error('Camera error:', err)
      setError(err.message || 'Failed to access camera. Check browser permissions.')
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
