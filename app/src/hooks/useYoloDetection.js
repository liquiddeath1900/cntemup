/**
 * YOLOv8n Custom Model — ONNX Runtime Web inference hook
 * Drop-in replacement for useObjectDetection.
 * Place your trained model at: public/models/bottle-can.onnx
 */
import { useState, useCallback, useRef } from 'react'
import * as ort from 'onnxruntime-web'

// ONNX Runtime config
ort.env.wasm.numThreads = 2

const MODEL_URL = '/models/bottle-can.onnx'
const INPUT_SIZE = 640 // Must match what you exported with
const CLASS_NAMES = ['bottle', 'can']

// Tunable thresholds — adjust these after testing
const CONF_THRESHOLD = 0.35
const IOU_THRESHOLD = 0.45

// Detection FPS
const DETECTION_FPS = 12

// Re-export config shape so App.jsx tracker works the same
export const DETECTION_CONFIG = {
  targetClasses: CLASS_NAMES,
  detectionFps: DETECTION_FPS,
  requiredConsecutiveFrames: 3,
}

export const CLASS_DISPLAY_NAMES = {
  bottle: 'bottle',
  can: 'can',
}

// ── Pre-processing ──────────────────────────────────────────────────
// Resize camera frame to 640x640 with letterboxing, normalize to 0-1
function preprocess(videoElement) {
  const canvas = document.createElement('canvas')
  canvas.width = INPUT_SIZE
  canvas.height = INPUT_SIZE
  const ctx = canvas.getContext('2d')

  const vw = videoElement.videoWidth
  const vh = videoElement.videoHeight
  const scale = Math.min(INPUT_SIZE / vw, INPUT_SIZE / vh)
  const nw = Math.round(vw * scale)
  const nh = Math.round(vh * scale)
  const dx = (INPUT_SIZE - nw) / 2
  const dy = (INPUT_SIZE - nh) / 2

  // Black letterbox background
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE)
  ctx.drawImage(videoElement, dx, dy, nw, nh)

  const imageData = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE)
  const { data } = imageData
  const pixels = INPUT_SIZE * INPUT_SIZE

  // Convert RGBA → float32 tensor [1, 3, 640, 640] in CHW order, normalized 0-1
  const float32 = new Float32Array(3 * pixels)
  for (let i = 0; i < pixels; i++) {
    float32[i] = data[i * 4] / 255                 // R channel
    float32[pixels + i] = data[i * 4 + 1] / 255    // G channel
    float32[2 * pixels + i] = data[i * 4 + 2] / 255 // B channel
  }

  const tensor = new ort.Tensor('float32', float32, [1, 3, INPUT_SIZE, INPUT_SIZE])
  return { tensor, scale, dx, dy }
}

// ── NMS (Non-Maximum Suppression) ───────────────────────────────────
function calculateIoU(a, b) {
  const x1 = Math.max(a[0], b[0])
  const y1 = Math.max(a[1], b[1])
  const x2 = Math.min(a[2], b[2])
  const y2 = Math.min(a[3], b[3])
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1)
  if (inter === 0) return 0
  const areaA = (a[2] - a[0]) * (a[3] - a[1])
  const areaB = (b[2] - b[0]) * (b[3] - b[1])
  return inter / (areaA + areaB - inter)
}

function nms(boxes, scores, iouThreshold) {
  const indices = Array.from(scores.keys()).sort((a, b) => scores[b] - scores[a])
  const keep = []

  while (indices.length > 0) {
    const i = indices.shift()
    keep.push(i)

    const remaining = []
    for (const j of indices) {
      if (calculateIoU(boxes[i], boxes[j]) < iouThreshold) {
        remaining.push(j)
      }
    }
    indices.length = 0
    indices.push(...remaining)
  }
  return keep
}

// ── Post-processing ─────────────────────────────────────────────────
// Parse YOLOv8 output tensor → array of { class, score, bbox, displayClass }
function postprocess(output, scale, dx, dy) {
  const data = output.data
  // YOLOv8 output: [1, num_classes + 4, num_boxes] e.g. [1, 6, 8400]
  const [, dims, numBoxes] = output.dims
  const numClasses = dims - 4

  const boxes = []
  const scores = []
  const classIds = []

  for (let i = 0; i < numBoxes; i++) {
    // Box coords: cx, cy, w, h
    const cx = data[0 * numBoxes + i]
    const cy = data[1 * numBoxes + i]
    const w = data[2 * numBoxes + i]
    const h = data[3 * numBoxes + i]

    // Find best class score
    let maxScore = 0
    let maxClass = 0
    for (let c = 0; c < numClasses; c++) {
      const s = data[(4 + c) * numBoxes + i]
      if (s > maxScore) {
        maxScore = s
        maxClass = c
      }
    }

    if (maxScore < CONF_THRESHOLD) continue

    // Convert from letterboxed 640x640 coords → original video coords
    const x1 = ((cx - w / 2) - dx) / scale
    const y1 = ((cy - h / 2) - dy) / scale
    const x2 = ((cx + w / 2) - dx) / scale
    const y2 = ((cy + h / 2) - dy) / scale

    boxes.push([x1, y1, x2, y2])
    scores.push(maxScore)
    classIds.push(maxClass)
  }

  // Remove overlapping duplicates
  const keepIndices = nms(boxes, scores, IOU_THRESHOLD)

  return keepIndices.map(i => ({
    class: CLASS_NAMES[classIds[i]] || `class_${classIds[i]}`,
    displayClass: CLASS_DISPLAY_NAMES[CLASS_NAMES[classIds[i]]] || CLASS_NAMES[classIds[i]],
    score: scores[i],
    // bbox as [x, y, width, height] to match COCO-SSD format
    bbox: [
      boxes[i][0],
      boxes[i][1],
      boxes[i][2] - boxes[i][0],
      boxes[i][3] - boxes[i][1],
    ],
  }))
}

// ── React Hook ──────────────────────────────────────────────────────
export function useYoloDetection() {
  const [model, setModel] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadProgress, setLoadProgress] = useState(0)
  const [error, setError] = useState(null)
  const detectionRef = useRef(null)

  const loadModel = useCallback(async () => {
    try {
      setIsLoading(true)
      setLoadProgress(10)
      setError(null)

      // Progress simulation (ONNX doesn't emit progress events)
      const timer = setInterval(() => {
        setLoadProgress(prev => Math.min(prev + 12, 85))
      }, 400)

      // Try WebGL first (GPU), fall back to WASM (CPU)
      const session = await ort.InferenceSession.create(MODEL_URL, {
        executionProviders: ['webgl', 'wasm'],
      })

      clearInterval(timer)
      setLoadProgress(100)
      setModel(session)
      setIsLoading(false)
      console.log('YOLOv8 model loaded!')
      return session
    } catch (err) {
      console.error('YOLO model load error:', err)
      setError('Failed to load YOLO model — is bottle-can.onnx in public/models/?')
      setIsLoading(false)
      setLoadProgress(0)
      return null
    }
  }, [])

  const detectObjects = useCallback(async (videoElement) => {
    if (!model || !videoElement) return []
    if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) return []

    try {
      const { tensor, scale, dx, dy } = preprocess(videoElement)

      // Run inference — input name is usually "images" for YOLOv8 ONNX exports
      const feeds = {}
      const inputName = model.inputNames[0] // auto-detect input name
      feeds[inputName] = tensor

      const results = await model.run(feeds)
      const output = results[model.outputNames[0]] // auto-detect output name

      return postprocess(output, scale, dx, dy)
    } catch (err) {
      console.error('YOLO detection error:', err)
      return []
    }
  }, [model])

  const startDetection = useCallback((videoElement, onDetection, fps = DETECTION_FPS) => {
    if (detectionRef.current) cancelAnimationFrame(detectionRef.current)

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

  const stopDetection = useCallback(() => {
    if (detectionRef.current) {
      cancelAnimationFrame(detectionRef.current)
      detectionRef.current = null
    }
  }, [])

  return {
    model,
    isLoading,
    loadProgress,
    error,
    loadModel,
    detectObjects,
    startDetection,
    stopDetection,
  }
}
