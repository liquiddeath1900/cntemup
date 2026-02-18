import { useState, useCallback, useRef } from 'react'
import * as cocoSsd from '@tensorflow-models/coco-ssd'
import '@tensorflow/tfjs'

// Detection configuration — tune these values for accuracy vs performance
export const DETECTION_CONFIG = {
  // Bottle + cup (cup is closest COCO class to "can")
  targetClasses: ['bottle', 'cup'],
  // Per-class confidence thresholds — cups need higher to reduce false positives
  confidenceThresholds: {
    bottle: 0.35,
    cup: 0.5,
  },
  // Default fallback threshold
  confidenceThreshold: 0.35,
  // Higher FPS = smoother tracking, costs more battery
  detectionFps: 15,
  // Frames an object must persist before counting (prevents flicker)
  requiredConsecutiveFrames: 3,
}

// Map COCO-SSD class names to user-friendly display labels
export const CLASS_DISPLAY_NAMES = {
  bottle: 'bottle',
  cup: 'can',
}

// Model configuration — structured for future YOLOv8 swap
export const MODEL_CONFIG = {
  cocoSsd: {
    name: 'COCO-SSD (MobileNet v2)',
    loader: () => cocoSsd.load({ base: 'mobilenet_v2' }),
    // Maps model output to standard { class, score, bbox } format
    normalize: (predictions) => predictions,
  },
  // Future: drop in custom YOLOv8 model here
  // yolov8: {
  //   name: 'Custom Bottle/Can Detector',
  //   loader: () => loadYoloModel('/models/bottles-v1/model.json'),
  //   normalize: (predictions) => predictions.map(p => ({
  //     class: p.label, score: p.confidence, bbox: p.box
  //   })),
  // },
}

// Custom hook for object detection
export function useObjectDetection() {
  const [model, setModel] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const detectionRef = useRef(null)
  const modelConfigRef = useRef('cocoSsd')

  // Load detection model
  const loadModel = useCallback(async (modelKey = 'cocoSsd') => {
    try {
      setIsLoading(true)
      setError(null)
      modelConfigRef.current = modelKey

      const config = MODEL_CONFIG[modelKey]
      console.log(`Loading ${config.name}...`)

      const loadedModel = await config.loader()

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

  // Detect objects in a single video frame
  const detectObjects = useCallback(async (videoElement) => {
    if (!model || !videoElement) return []
    // Skip detection if video has no dimensions yet
    if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) return []

    try {
      const predictions = await model.detect(videoElement)
      const config = MODEL_CONFIG[modelConfigRef.current]
      const normalized = config.normalize(predictions)

      // Filter to target classes with per-class confidence thresholds
      return normalized
        .filter(p => {
          if (!DETECTION_CONFIG.targetClasses.includes(p.class)) return false
          const threshold = DETECTION_CONFIG.confidenceThresholds[p.class] || DETECTION_CONFIG.confidenceThreshold
          return p.score > threshold
        })
        .map(p => ({
          ...p,
          // Add display name for UI (e.g. "cup" → "can")
          displayClass: CLASS_DISPLAY_NAMES[p.class] || p.class,
        }))
    } catch (err) {
      console.error('Detection error:', err)
      return []
    }
  }, [model])

  // Start continuous detection loop
  const startDetection = useCallback((videoElement, onDetection, fps = DETECTION_CONFIG.detectionFps) => {
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
