# Custom YOLOv8n Model — Complete Training Guide for CNTEM'UP

> Train a custom bottle/can detector that's 3-5x more accurate than COCO-SSD, runs in the browser, costs $0.

---

## Overview

| Step | Time | Cost |
|------|------|------|
| 1. Get images + label them | 2-4 hrs | Free |
| 2. Train on Google Colab | 1-2 hrs | Free |
| 3. Export to ONNX | 5 min | Free |
| 4. Integrate in React | 3-5 hrs | Free |
| **Total** | **~8-12 hrs** | **$0** |

---

## Step 1: Dataset — Images + Labels

### How Many Images?

| Amount | Quality |
|--------|---------|
| 200-500 | Minimum viable — works but fragile |
| 1,000-2,000 | Good for 2 classes (bottle + can) |
| 3,000-5,000 | Excellent — robust in varied conditions |
| 5,000+ | Overkill for 2 classes, diminishing returns |

### Fastest Path: Use Free Public Datasets

Download these and merge them:

| Dataset | Images | Classes | URL |
|---------|--------|---------|-----|
| **Beverage Containers** (best) | 6,500 | 9 container types | [roboflow.com](https://universe.roboflow.com/roboflow-universe-projects/beverage-containers-3atxb) |
| **Bottle and Can** | 1,200 | bottle, can | [roboflow.com](https://universe.roboflow.com/bouteille/bottle-and-can) |
| **Trash Detections** | 2,200 | can, glass bottle, plastic bottle + more | [roboflow.com](https://universe.roboflow.com/bots-games/yolov8-trash-detections-wkbdi) |
| **TACO** (real-world litter) | 1,500 | 60 waste classes | [github.com/pedropro/TACO](https://github.com/pedropro/TACO) |

**Recommended combo:** Fork "Bottle and Can" (1,200 images, clean 2-class labels) + add 300-500 of YOUR OWN photos taken with your phone in your counting environment.

### Adding Your Own Photos — What Makes Good Training Data

**DO:**
- Take photos from the SAME angle your app's camera will see (top-down on a table, held in hand, etc.)
- Vary the lighting (bright, dim, warm, cool, shadows)
- Include single bottles, groups of 2-5, and piles of 10+
- Mix brands, sizes, colors (clear, green, brown glass; silver, colored cans)
- Include crushed/dented cans and bottles with/without caps
- Add "hard" examples: bottles next to cups, cans on busy backgrounds
- Include some images with NO bottles/cans (negative examples — 10-15% of dataset)

**DON'T:**
- Don't use only perfect studio-lit photos
- Don't have all images from the same angle
- Don't use only one brand or size
- Don't crop too tight — include some background context

### Labeling Your Images

**Best free tool: Roboflow (web-based, no install)**
1. Create free account at [roboflow.com](https://app.roboflow.com)
2. Create new project → Object Detection → name it "bottle-can-counter"
3. Upload your images
4. Draw bounding boxes around each bottle and can
5. Use 2 classes: `bottle` and `can`

**Labeling tips:**
- Draw boxes TIGHT around the object (not loose)
- If an object is >50% visible, label it. If <50% visible, skip it
- Label EVERY bottle and can in EVERY image — missing labels teach the model to ignore real objects
- Roboflow has **auto-label** that uses AI to pre-label — then you just fix mistakes (way faster)
- Free tier gives you enough credits to auto-label ~1,500 images/month

**Bounding box format (YOLO .txt):**
```
# class_id center_x center_y width height (all normalized 0-1)
0 0.5 0.5 0.3 0.6    # bottle at center, 30% wide, 60% tall
1 0.2 0.8 0.15 0.2   # can at bottom-left
```

### Dataset Structure (What YOLOv8 Expects)

```
dataset/
├── data.yaml
├── train/
│   ├── images/
│   │   ├── img001.jpg
│   │   └── img002.jpg
│   └── labels/
│       ├── img001.txt
│       └── img002.txt
├── valid/
│   ├── images/
│   └── labels/
└── test/
    ├── images/
    └── labels/
```

**data.yaml:**
```yaml
train: /content/dataset/train/images
val: /content/dataset/valid/images
test: /content/dataset/test/images

nc: 2
names: ['bottle', 'can']
```

**Split ratios:** 70% train / 20% validation / 10% test
(Roboflow does this automatically when you export)

### Augmentation (Free Accuracy Boost)

In Roboflow, apply these augmentations when generating your dataset version:
- **Flip:** Horizontal only (bottles look the same flipped)
- **Rotation:** ±15° (objects won't always be perfectly upright)
- **Brightness:** ±25% (handles different lighting)
- **Blur:** Up to 2px (simulates camera shake)
- **Noise:** Up to 3% (simulates low-light grain)
- **Mosaic:** Yes (combines 4 images — great for learning multi-object scenes)

Set augmentation to **3x** — this triples your dataset for free.

---

## Step 2: Train on Google Colab (Free GPU)

### Complete Colab Notebook

Open [Google Colab](https://colab.research.google.com), select **T4 GPU** runtime, and run these cells:

**Cell 1: Install**
```python
!pip install ultralytics roboflow -q
```

**Cell 2: Download Dataset from Roboflow**
```python
from roboflow import Roboflow

# Get your API key from: app.roboflow.com → Settings → API Key
rf = Roboflow(api_key="YOUR_API_KEY")
project = rf.workspace("YOUR_WORKSPACE").project("bottle-can-counter")
version = project.version(1)  # Use your version number
dataset = version.download("yolov8")

# This downloads to a folder like "bottle-can-counter-1/"
dataset_path = dataset.location
print(f"Dataset downloaded to: {dataset_path}")
```

**Cell 3: Train**
```python
from ultralytics import YOLO

# Start from pre-trained COCO weights (transfer learning = way better than from scratch)
model = YOLO('yolov8n.pt')  # 'n' = nano = smallest/fastest

# Train
results = model.train(
    data=f'{dataset_path}/data.yaml',
    epochs=100,           # 100 is good default, early stopping will kick in
    imgsz=640,            # Standard YOLO input size
    batch=16,             # 16 works on free Colab T4
    patience=20,          # Stop early if no improvement for 20 epochs
    device=0,             # GPU
    workers=2,            # Colab has limited CPU workers
    project='bottle_can', # Output folder name
    name='train_v1',      # Run name

    # Augmentation (on top of dataset augmentation)
    hsv_h=0.015,          # Hue shift
    hsv_s=0.7,            # Saturation shift
    hsv_v=0.4,            # Brightness shift
    degrees=10,           # Rotation
    translate=0.1,        # Shift
    scale=0.5,            # Zoom
    flipud=0.0,           # No vertical flip (bottles don't go upside down usually)
    fliplr=0.5,           # Horizontal flip
    mosaic=1.0,           # Mosaic augmentation
    mixup=0.1,            # MixUp augmentation
)
```

**Training time:** ~30-90 min on free T4 for 1,000-3,000 images at 100 epochs.

**Cell 4: Check Results**
```python
# Training metrics are saved as images
from IPython.display import Image, display

# Confusion matrix — shows what's being confused
display(Image(filename='bottle_can/train_v1/confusion_matrix.png'))

# Training curves — loss should go down, mAP should go up
display(Image(filename='bottle_can/train_v1/results.png'))

# Sample predictions on validation set
display(Image(filename='bottle_can/train_v1/val_batch0_pred.jpg'))
```

**What "good" looks like:**
- mAP50 > 0.80 (80%) = good
- mAP50 > 0.90 (90%) = excellent
- mAP50 < 0.60 = needs more/better data

**Cell 5: Test on Sample Images**
```python
# Load best model
best_model = YOLO('bottle_can/train_v1/weights/best.pt')

# Test on validation images
results = best_model.predict(
    source=f'{dataset_path}/valid/images',
    save=True,
    conf=0.25,
)

# Check predictions
display(Image(filename='bottle_can/train_v1/val_batch0_pred.jpg'))
```

---

## Step 3: Export to ONNX

```python
# Export for browser use
best_model = YOLO('bottle_can/train_v1/weights/best.pt')

best_model.export(
    format='onnx',
    opset=12,         # Browser-compatible opset
    simplify=True,    # Removes unnecessary nodes
    imgsz=640,        # Must match what you trained with
)

# Model saved to: bottle_can/train_v1/weights/best.onnx
# Size: ~12-15 MB for YOLOv8n
```

**Download the model:**
```python
from google.colab import files
files.download('bottle_can/train_v1/weights/best.onnx')
```

**Alternative — smaller model (320px input):**
```python
# Smaller input = faster inference, slightly less accurate
best_model.export(format='onnx', opset=12, simplify=True, imgsz=320)
# Size: ~6-8 MB, inference ~2x faster
```

---

## Step 4: Integrate in React

### Install Dependencies

```bash
npm install onnxruntime-web
```

### Place Model File

```
public/
└── models/
    └── bottle-can-v1.onnx
```

### Create YOLO Inference Hook

Create `src/hooks/useYoloDetection.js`:

```javascript
import { useState, useCallback, useRef } from 'react'
import * as ort from 'onnxruntime-web'

// Configure ONNX Runtime to use WebGL (faster) with WASM fallback
ort.env.wasm.numThreads = 2
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/'

const MODEL_URL = '/models/bottle-can-v1.onnx'
const INPUT_SIZE = 640  // Must match export imgsz
const CLASS_NAMES = ['bottle', 'can']
const CONF_THRESHOLD = 0.35
const IOU_THRESHOLD = 0.45

// Pre-process: resize camera frame to 640x640, normalize to 0-1
function preprocess(videoElement) {
  const canvas = document.createElement('canvas')
  canvas.width = INPUT_SIZE
  canvas.height = INPUT_SIZE
  const ctx = canvas.getContext('2d')

  // Letterbox: maintain aspect ratio, pad with black
  const vw = videoElement.videoWidth
  const vh = videoElement.videoHeight
  const scale = Math.min(INPUT_SIZE / vw, INPUT_SIZE / vh)
  const nw = Math.round(vw * scale)
  const nh = Math.round(vh * scale)
  const dx = (INPUT_SIZE - nw) / 2
  const dy = (INPUT_SIZE - nh) / 2

  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE)
  ctx.drawImage(videoElement, dx, dy, nw, nh)

  const imageData = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE)
  const { data } = imageData

  // Convert to float32 tensor [1, 3, 640, 640] normalized to 0-1
  const float32Data = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE)
  for (let i = 0; i < INPUT_SIZE * INPUT_SIZE; i++) {
    float32Data[i] = data[i * 4] / 255                           // R
    float32Data[INPUT_SIZE * INPUT_SIZE + i] = data[i * 4 + 1] / 255  // G
    float32Data[2 * INPUT_SIZE * INPUT_SIZE + i] = data[i * 4 + 2] / 255  // B
  }

  const tensor = new ort.Tensor('float32', float32Data, [1, 3, INPUT_SIZE, INPUT_SIZE])
  return { tensor, scale, dx, dy }
}

// Non-Maximum Suppression — removes duplicate overlapping boxes
function nms(boxes, scores, iouThreshold) {
  const indices = Array.from(scores.keys()).sort((a, b) => scores[b] - scores[a])
  const keep = []

  while (indices.length > 0) {
    const i = indices.shift()
    keep.push(i)

    const remaining = []
    for (const j of indices) {
      const iou = calculateIoU(boxes[i], boxes[j])
      if (iou < iouThreshold) remaining.push(j)
    }
    indices.length = 0
    indices.push(...remaining)
  }

  return keep
}

function calculateIoU(boxA, boxB) {
  const x1 = Math.max(boxA[0], boxB[0])
  const y1 = Math.max(boxA[1], boxB[1])
  const x2 = Math.min(boxA[2], boxB[2])
  const y2 = Math.min(boxA[3], boxB[3])
  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1)
  if (intersection === 0) return 0
  const areaA = (boxA[2] - boxA[0]) * (boxA[3] - boxA[1])
  const areaB = (boxB[2] - boxB[0]) * (boxB[3] - boxB[1])
  return intersection / (areaA + areaB - intersection)
}

// Post-process: parse YOLO output tensor into detections
function postprocess(output, scale, dx, dy, videoWidth, videoHeight) {
  // YOLOv8 output shape: [1, num_classes + 4, num_boxes]
  // Transpose to [num_boxes, num_classes + 4]
  const data = output.data
  const [, dims, numBoxes] = output.dims  // [1, 6, 8400] for 2 classes

  const boxes = []
  const scores = []
  const classIds = []

  for (let i = 0; i < numBoxes; i++) {
    // Extract box coordinates (cx, cy, w, h)
    const cx = data[0 * numBoxes + i]
    const cy = data[1 * numBoxes + i]
    const w = data[2 * numBoxes + i]
    const h = data[3 * numBoxes + i]

    // Find best class
    let maxScore = 0
    let maxClassId = 0
    for (let c = 0; c < dims - 4; c++) {
      const score = data[(4 + c) * numBoxes + i]
      if (score > maxScore) {
        maxScore = score
        maxClassId = c
      }
    }

    if (maxScore < CONF_THRESHOLD) continue

    // Convert from letterboxed coords back to original video coords
    const x1 = ((cx - w / 2) - dx) / scale
    const y1 = ((cy - h / 2) - dy) / scale
    const x2 = ((cx + w / 2) - dx) / scale
    const y2 = ((cy + h / 2) - dy) / scale

    boxes.push([x1, y1, x2, y2])
    scores.push(maxScore)
    classIds.push(maxClassId)
  }

  // Apply NMS
  const keepIndices = nms(boxes, scores, IOU_THRESHOLD)

  return keepIndices.map(i => ({
    class: CLASS_NAMES[classIds[i]],
    displayClass: CLASS_NAMES[classIds[i]],
    score: scores[i],
    bbox: [
      boxes[i][0],              // x
      boxes[i][1],              // y
      boxes[i][2] - boxes[i][0], // width
      boxes[i][3] - boxes[i][1], // height
    ],
  }))
}

// React Hook
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

      const progressTimer = setInterval(() => {
        setLoadProgress(prev => Math.min(prev + 12, 85))
      }, 500)

      // Load ONNX model — tries WebGL first, falls back to WASM
      const session = await ort.InferenceSession.create(MODEL_URL, {
        executionProviders: ['webgl', 'wasm'],
      })

      clearInterval(progressTimer)
      setLoadProgress(100)
      setModel(session)
      setIsLoading(false)
      return session
    } catch (err) {
      console.error('YOLO model load error:', err)
      setError('Failed to load detection model')
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
      const results = await model.run({ images: tensor })
      const output = results[Object.keys(results)[0]]
      return postprocess(output, scale, dx, dy, videoElement.videoWidth, videoElement.videoHeight)
    } catch (err) {
      console.error('YOLO detection error:', err)
      return []
    }
  }, [model])

  const startDetection = useCallback((videoElement, onDetection, fps = 12) => {
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

  return { model, isLoading, loadProgress, error, loadModel, detectObjects, startDetection, stopDetection }
}
```

### Swap in App.jsx (When Ready)

```javascript
// Change this import:
// import { useObjectDetection } from './hooks/useObjectDetection'
import { useYoloDetection as useObjectDetection } from './hooks/useYoloDetection'
```

That's it — same API, drop-in replacement.

---

## Debugging Poor Results

| Problem | Fix |
|---------|-----|
| Detects everything as "bottle" | Imbalanced data — add more can images |
| Lots of false positives | Raise CONF_THRESHOLD to 0.4-0.5, add negative images |
| Misses obvious objects | Lower CONF_THRESHOLD to 0.2, retrain with more examples |
| Works on desk, fails in hand | Add training images taken while holding phone |
| Good accuracy but slow | Switch to 320px input size, reduce FPS to 8 |

---

## Quick-Start Checklist

- [ ] Create free Roboflow account
- [ ] Fork "Bottle and Can" dataset (1,200 images)
- [ ] Add 300+ of your own photos, label them
- [ ] Apply 3x augmentation, export as YOLOv8 format
- [ ] Open Google Colab → T4 GPU
- [ ] Run training (~1 hour)
- [ ] Check mAP50 > 80%
- [ ] Export to ONNX
- [ ] Drop `best.onnx` into `public/models/`
- [ ] `npm install onnxruntime-web`
- [ ] Create `useYoloDetection.js` hook (code above)
- [ ] Swap import in App.jsx
- [ ] Test and tune confidence threshold
