# Custom Model Training Guide

Train a YOLOv8 model to replace COCO-SSD for better bottle/can detection accuracy.

## Image Collection Requirements

### Minimum Dataset
- **200-300 photos** for MVP (aim for 500+ for production)
- Balance between bottles and cans (roughly 50/50)

### What to Photograph
- Single bottles/cans
- Groups of 2-10 containers
- Bags of bottles (partially visible)
- Crushed/dented cans
- Wet/dirty containers
- Different brands and sizes

### Capture Variety
| Variable | Examples |
|----------|----------|
| **Angles** | Top-down, 45°, side view, bottom-up |
| **Lighting** | Indoor fluorescent, natural daylight, dim, bright |
| **Backgrounds** | Counter, floor, bag, sorting table, street, recycling center |
| **Distance** | Close-up (1ft), medium (3ft), far (6ft+) |
| **Containers** | Glass, plastic, aluminum cans, steel cans |
| **Sizes** | 8oz, 12oz, 16oz, 20oz, 24oz, 1L, 2L |

### Classes to Label
1. `bottle` — glass or plastic bottles
2. `can` — aluminum or steel cans
3. (Optional) `container` — generic catch-all

## Training Pipeline

### 1. Label with Roboflow
1. Create account at [roboflow.com](https://roboflow.com)
2. Upload images
3. Draw bounding boxes around each container
4. Label each as `bottle` or `can`
5. Apply augmentations (flip, rotate, brightness, noise)
6. Export in YOLOv8 format

### 2. Train with Google Colab
```python
# Install ultralytics
!pip install ultralytics

from ultralytics import YOLO

# Load base model
model = YOLO('yolov8n.pt')  # nano for mobile, 's' for better accuracy

# Train on your dataset
results = model.train(
    data='/content/dataset/data.yaml',
    epochs=100,
    imgsz=640,
    batch=16,
    name='bottles-v1'
)

# Export for web (TensorFlow.js)
model.export(format='tfjs')
```

### 3. Deploy to App
1. Download the exported `tfjs` model folder
2. Place in `app/public/models/bottles-v1/`
3. Uncomment the YOLOv8 config in `useObjectDetection.js`
4. Test and iterate

## Target Metrics
- **mAP@0.5**: >80% (good), >90% (excellent)
- **Inference time**: <100ms on mobile
- **False positive rate**: <5%

## Tips
- More data always helps — even 50 more images can improve accuracy
- Include "hard negatives" (things that look like bottles but aren't)
- Retrain periodically as you collect more images from real usage
- Start with YOLOv8n (nano) for mobile speed, upgrade to YOLOv8s if accuracy is low
