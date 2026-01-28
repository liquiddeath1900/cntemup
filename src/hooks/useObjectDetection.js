import { useState, useCallback, useRef } from 'react'
import * as cocoSsd from '@tensorflow-models/coco-ssd'
import '@tensorflow/tfjs'

// Custom hook for object detection (bottles/cups)
export function useObjectDetection() {
  const [model, setModel] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const detectionRef = useRef(null)

  // Load the COCO-SSD model
  const loadModel = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      console.log('Loading detection model...')

      const loadedModel = await cocoSsd.load({
        base: 'lite_mobilenet_v2' // Lighter model for mobile
      })

      setModel(loadedModel)
      console.log('Model loaded!')
      setIsLoading(false)
      return loadedModel
    } catch (err) {
      console.error('Model load error:', err)
      setError('Failed to load detection model')
      setIsLoading(false)
      return null
    }
  }, [])

  // Detect objects in video frame
  // COCO-SSD detects: bottle, cup, wine glass, bowl
  const detectObjects = useCallback(async (videoElement) => {
    if (!model || !videoElement) return []

    try {
      const predictions = await model.detect(videoElement)

      // Filter for bottle-like objects
      // COCO classes: bottle, cup, wine glass
      const bottleClasses = ['bottle', 'cup', 'wine glass']
      const bottles = predictions.filter(p =>
        bottleClasses.includes(p.class) && p.score > 0.5
      )

      return bottles
    } catch (err) {
      console.error('Detection error:', err)
      return []
    }
  }, [model])

  // Start continuous detection loop
  const startDetection = useCallback((videoElement, onDetection, fps = 10) => {
    if (detectionRef.current) {
      cancelAnimationFrame(detectionRef.current)
    }

    const interval = 1000 / fps
    let lastTime = 0

    const detect = async (timestamp) => {
      if (timestamp - lastTime >= interval) {
        const objects = await detectObjects(videoElement)
        onDetection(objects)
        lastTime = timestamp
      }
      detectionRef.current = requestAnimationFrame(detect)
    }

    detectionRef.current = requestAnimationFrame(detect)
  }, [detectObjects])

  // Stop detection loop
  const stopDetection = useCallback(() => {
    if (detectionRef.current) {
      cancelAnimationFrame(detectionRef.current)
      detectionRef.current = null
    }
  }, [])

  return {
    model,
    isLoading,
    error,
    loadModel,
    detectObjects,
    startDetection,
    stopDetection
  }
}
