import { useState, useRef, useCallback, useEffect } from 'react'

// Custom hook for camera access with device selection
export function useCamera() {
  const videoRef = useRef(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState(null)
  const [devices, setDevices] = useState([])
  const [selectedDevice, setSelectedDevice] = useState(null)
  const streamRef = useRef(null)

  // Get list of available cameras
  const getDevices = useCallback(async () => {
    try {
      // Need to request permission first to get device labels
      await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        .then(stream => stream.getTracks().forEach(track => track.stop()))

      const allDevices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = allDevices.filter(device => device.kind === 'videoinput')
      setDevices(videoDevices)

      // Auto-select first external camera (usually Logitech) or fallback to first
      const externalCam = videoDevices.find(d =>
        d.label.toLowerCase().includes('logitech') ||
        d.label.toLowerCase().includes('external') ||
        d.label.toLowerCase().includes('usb')
      )
      if (externalCam && !selectedDevice) {
        setSelectedDevice(externalCam.deviceId)
      } else if (videoDevices.length > 0 && !selectedDevice) {
        setSelectedDevice(videoDevices[0].deviceId)
      }

      return videoDevices
    } catch (err) {
      console.error('Error getting devices:', err)
      return []
    }
  }, [selectedDevice])

  // Load devices on mount
  useEffect(() => {
    getDevices()
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
        await videoRef.current.play()
        setIsStreaming(true)
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
