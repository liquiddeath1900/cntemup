/**
 * Smart detection hook — tries YOLO custom model first, falls back to COCO-SSD.
 * Drop your trained model at public/models/bottle-can.onnx and it auto-switches.
 */
import { useState, useCallback, useRef, useEffect } from 'react'
import { useYoloDetection, DETECTION_CONFIG as YOLO_CONFIG } from './useYoloDetection'
import { useObjectDetection, DETECTION_CONFIG as COCO_CONFIG } from './useObjectDetection'

// Check if YOLO model file exists
async function yoloModelExists() {
  try {
    const resp = await fetch('/models/bottle-can.onnx', { method: 'HEAD' })
    return resp.ok && resp.status === 200
  } catch {
    return false
  }
}

export function useDetection() {
  const [useYolo, setUseYolo] = useState(null) // null = checking, true/false = decided
  const yolo = useYoloDetection()
  const coco = useObjectDetection()

  // On mount, check which model is available
  useEffect(() => {
    yoloModelExists().then(exists => {
      setUseYolo(exists)
      console.log(exists ? 'YOLO model found — using custom detector' : 'No YOLO model — using COCO-SSD fallback')
    })
  }, [])

  // Pick the active engine
  const active = useYolo === true ? yolo : coco
  const config = useYolo === true ? YOLO_CONFIG : COCO_CONFIG

  // Wrap loadModel to handle the "still checking" state
  const loadModel = useCallback(async () => {
    if (useYolo === null) {
      // Still checking — wait a tick
      const exists = await yoloModelExists()
      setUseYolo(exists)
      if (exists) return yolo.loadModel()
      return coco.loadModel()
    }
    return active.loadModel()
  }, [useYolo, active, yolo, coco])

  return {
    ...active,
    loadModel,
    config,
    modelType: useYolo === true ? 'yolo' : 'coco-ssd',
    checking: useYolo === null,
  }
}

// Re-export for tracker
export { YOLO_CONFIG, COCO_CONFIG }
