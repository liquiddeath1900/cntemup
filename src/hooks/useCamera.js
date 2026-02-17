import { useState, useRef, useCallback, useEffect } from 'react'

// Custom hook for camera access with device selection
export function useCamera() {
  const videoRef = useRef(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState(null)
  const [devices, setDevices] = useState([])
  const [selectedDevice, setSelectedDevice] = useState(null)
  const streamRef = useRef(null)
  const selectedDeviceRef = useRef(null)

  // Keep ref in sync with state
  useEffect(() => {
    selectedDeviceRef.current = selectedDevice
  }, [selectedDevice])

  // Get list of available cameras
  const getDevices = useCallback(async () => {
    try {
      // Need to request permission first to get device labels
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      tempStream.getTracks().forEach(track => track.stop())

      const allDevices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = allDevices.filter(device => device.kind === 'videoinput')
      setDevices(videoDevices)

      // Auto-select first external camera or fallback to first (only if none selected)
      if (!selectedDeviceRef.current && videoDevices.length > 0) {
        const externalCam = videoDevices.find(d =>
          d.label.toLowerCase().includes('logitech') ||
          d.label.toLowerCase().includes('external') ||
          d.label.toLowerCase().includes('usb')
        )
        setSelectedDevice(externalCam ? externalCam.deviceId : videoDevices[0].deviceId)
      }

      return videoDevices
    } catch (err) {
      console.error('Error getting devices:', err)
      setError('Camera permission denied. Please allow camera access.')
      return []
    }
  }, [])

  // Load devices on mount
  useEffect(() => {
    void getDevices()
  }, [getDevices])

  const startCamera = useCallback(async (deviceId = selectedDevice) => {
    try {
      setError(null)

      // Stop any existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }

      const constraints = {
        video: deviceId ? {
          deviceId: { exact: deviceId },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } : {
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        try {
          await videoRef.current.play()
          setIsStreaming(true)
        } catch (playErr) {
          console.error('Autoplay blocked:', playErr)
          setError('Camera blocked by browser. Tap the video to start.')
          setIsStreaming(false)
        }
      }
    } catch (err) {
      console.error('Camera error:', err)
      setError(err.message || 'Failed to access camera. Check browser permissions.')
      setIsStreaming(false)
    }
  }, [selectedDevice])

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

  // Switch camera
  const switchCamera = useCallback(async (deviceId) => {
    setSelectedDevice(deviceId)
    if (isStreaming) {
      await startCamera(deviceId)
    }
  }, [isStreaming, startCamera])

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
    devices,
    selectedDevice,
    startCamera,
    stopCamera,
    switchCamera,
    getDevices
  }
}
