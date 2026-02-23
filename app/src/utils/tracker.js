/**
 * Object tracker — prevents double-counting by tracking objects across frames
 * Uses IoU (Intersection over Union) to match detections to existing tracked objects.
 * An object must appear in N consecutive frames before it's counted as "new".
 */

// Calculate IoU between two bounding boxes [x, y, w, h]
function calculateIoU(boxA, boxB) {
  const [ax, ay, aw, ah] = boxA
  const [bx, by, bw, bh] = boxB

  const x1 = Math.max(ax, bx)
  const y1 = Math.max(ay, by)
  const x2 = Math.min(ax + aw, bx + bw)
  const y2 = Math.min(ay + ah, by + bh)

  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1)
  if (intersection === 0) return 0

  const areaA = aw * ah
  const areaB = bw * bh
  return intersection / (areaA + areaB - intersection)
}

// Get centroid of a bbox [x, y, w, h]
function getCentroid(bbox) {
  return { x: bbox[0] + bbox[2] / 2, y: bbox[1] + bbox[3] / 2 }
}

// Distance between two centroids
function centroidDistance(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}

let nextId = 1

/**
 * Create a new tracker instance.
 * @param {Object} opts
 * @param {number} opts.iouThreshold - Min IoU to match (default 0.3)
 * @param {number} opts.maxMissedFrames - Frames before dropping a tracked object (default 8)
 * @param {number} opts.minFramesToCount - Consecutive frames before counting as new (default 3)
 * @param {number} opts.maxCentroidDist - Max pixel distance for centroid fallback match (default 80)
 */
export function createTracker(opts = {}) {
  const {
    iouThreshold = 0.3,
    maxMissedFrames = 8,
    minFramesToCount = 3,
    maxCentroidDist = 80,
  } = opts

  // tracked: Map<id, { id, bbox, class, frames, counted, missedFrames }>
  let tracked = new Map()

  /**
   * Update tracker with new frame detections.
   * @param {Array} detections - Array of { bbox, class, score, displayClass }
   * @returns {{ newlyCounted: number, tracked: Array }}
   */
  function update(detections) {
    let newlyCounted = 0
    const matched = new Set() // IDs of tracked objects matched this frame
    const usedDetections = new Set() // Indices of detections already matched

    // Pass 1: Match by IoU (strongest signal)
    for (const [id, obj] of tracked) {
      let bestIdx = -1
      let bestIoU = 0

      for (let i = 0; i < detections.length; i++) {
        if (usedDetections.has(i)) continue
        const iou = calculateIoU(obj.bbox, detections[i].bbox)
        if (iou > bestIoU) {
          bestIoU = iou
          bestIdx = i
        }
      }

      if (bestIoU >= iouThreshold && bestIdx >= 0) {
        // Update existing tracked object
        obj.bbox = detections[bestIdx].bbox
        obj.score = detections[bestIdx].score
        obj.frames++
        obj.missedFrames = 0
        matched.add(id)
        usedDetections.add(bestIdx)
      }
    }

    // Pass 2: Centroid fallback for unmatched tracked objects
    for (const [id, obj] of tracked) {
      if (matched.has(id)) continue

      const objCentroid = getCentroid(obj.bbox)
      let bestIdx = -1
      let bestDist = Infinity

      for (let i = 0; i < detections.length; i++) {
        if (usedDetections.has(i)) continue
        const detCentroid = getCentroid(detections[i].bbox)
        const dist = centroidDistance(objCentroid, detCentroid)
        if (dist < bestDist) {
          bestDist = dist
          bestIdx = i
        }
      }

      if (bestDist <= maxCentroidDist && bestIdx >= 0) {
        obj.bbox = detections[bestIdx].bbox
        obj.score = detections[bestIdx].score
        obj.frames++
        obj.missedFrames = 0
        matched.add(id)
        usedDetections.add(bestIdx)
      }
    }

    // Increment missedFrames for unmatched tracked objects
    for (const [id, obj] of tracked) {
      if (!matched.has(id)) {
        obj.missedFrames++
      }
    }

    // Remove objects missing too long
    for (const [id, obj] of tracked) {
      if (obj.missedFrames > maxMissedFrames) {
        tracked.delete(id)
      }
    }

    // Pass 3: New detections → create new tracked objects
    for (let i = 0; i < detections.length; i++) {
      if (usedDetections.has(i)) continue

      const det = detections[i]
      const id = nextId++
      tracked.set(id, {
        id,
        bbox: det.bbox,
        class: det.class,
        displayClass: det.displayClass,
        score: det.score,
        frames: 1,
        counted: false,
        missedFrames: 0,
      })
    }

    // Count objects that have persisted long enough and haven't been counted yet
    for (const [, obj] of tracked) {
      if (!obj.counted && obj.frames >= minFramesToCount) {
        obj.counted = true
        newlyCounted++
      }
    }

    return {
      newlyCounted,
      tracked: Array.from(tracked.values()),
    }
  }

  /** Reset all tracking state */
  function reset() {
    tracked = new Map()
  }

  /** Get current count of tracked (counted) objects still visible */
  function getVisibleCount() {
    let count = 0
    for (const [, obj] of tracked) {
      if (obj.counted && obj.missedFrames === 0) count++
    }
    return count
  }

  return { update, reset, getVisibleCount }
}
