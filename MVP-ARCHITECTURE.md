# Bottle Counter MVP Architecture

## Overview
Browser-based bottle/can counter using phone camera + ML detection.

---

## Tech Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (PWA)                           │
│  Next.js + TailwindCSS + TensorFlow.js                         │
│  - Camera capture via WebRTC                                    │
│  - YOLOv8n model runs IN BROWSER (no server costs)             │
│  - Real-time counting overlay                                   │
│  - Offline capable (PWA)                                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        BACKEND (API)                            │
│  Supabase (Free tier = 50k MAU)                                │
│  - Auth (email/Google sign-in)                                  │
│  - PostgreSQL for user data + scan history                      │
│  - Edge Functions for premium features                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        ML MODEL                                 │
│  YOLOv8n (nano) → converted to ONNX/TensorFlow.js              │
│  - Trained on Beverage Containers dataset                       │
│  - Classes: bottle, can, tetra_pack                            │
│  - Runs client-side = $0 inference costs                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

```sql
-- Users table
users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE,
  state TEXT,              -- for deposit rate lookup
  country TEXT,
  created_at TIMESTAMP,
  is_premium BOOLEAN DEFAULT false,
  notify_mobile_launch BOOLEAN DEFAULT true
)

-- Scan sessions (premium feature: history)
scans (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users,
  bottles_count INT,
  cans_count INT,
  total_value DECIMAL,     -- calculated from state rates
  scanned_at TIMESTAMP
)

-- Deposit rates by state
deposit_rates (
  state TEXT PRIMARY KEY,
  bottle_rate DECIMAL,     -- e.g., 0.05 for NY
  can_rate DECIMAL,
  large_bottle_rate DECIMAL,
  notes TEXT               -- any special rules
)
```

---

## User Flow

```
1. LANDING PAGE
   └── "Start Counting" or "Sign Up"

2. SIGN UP (simple)
   └── Email + Password (or Google OAuth)
   └── Select State/Location
   └── Checkbox: "Notify me when mobile app launches"

3. MAIN COUNTER
   ┌─────────────────────────────┐
   │  ┌───────────────────────┐  │
   │  │                       │  │
   │  │    CAMERA FEED        │  │
   │  │    + bounding boxes   │  │
   │  │                       │  │
   │  └───────────────────────┘  │
   │                             │
   │  🍾 Bottles: 24            │
   │  🥫 Cans: 18               │
   │  ─────────────────────     │
   │  💰 Total: $2.10 (NY rate) │
   │                             │
   │  [Reset] [Save Session]    │
   └─────────────────────────────┘

4. END SESSION
   └── Shows total count + estimated value
   └── Premium: Save to history
```

---

## Free vs Premium Features

| Feature | Free | Premium ($4.99/mo) |
|---------|------|-------------------|
| Real-time counting | ✅ | ✅ |
| State-based rates | ✅ | ✅ |
| Session history | ❌ | ✅ |
| Export reports (CSV) | ❌ | ✅ |
| Size classification | ❌ | ✅ |
| Multi-camera support | ❌ | ✅ |
| Priority mobile access | ❌ | ✅ |

---

## State Deposit Rates (Initial)

```javascript
const DEPOSIT_RATES = {
  // States WITH bottle bills
  'NY': { standard: 0.05, large: 0.05 },
  'CA': { standard: 0.05, large: 0.10 },  // 24oz+ = 10¢
  'OR': { standard: 0.10, large: 0.10 },
  'MI': { standard: 0.10, large: 0.10 },
  'ME': { standard: 0.05, large: 0.15 },  // wine/liquor = 15¢
  'VT': { standard: 0.05, large: 0.15 },
  'MA': { standard: 0.05, large: 0.05 },
  'CT': { standard: 0.05, large: 0.05 },
  'IA': { standard: 0.05, large: 0.05 },
  'HI': { standard: 0.05, large: 0.05 },

  // States WITHOUT bottle bills
  'TX': null,
  'FL': null,
  // ... etc
}
```

---

## Cost Breakdown (MVP)

| Service | Cost |
|---------|------|
| Vercel (hosting) | $0 (free tier) |
| Supabase (backend) | $0 (free tier) |
| ML inference | $0 (runs in browser) |
| Domain | ~$12/year |
| **Total MVP** | **~$12/year** |

---

## File Structure

```
bottle-counter/
├── app/
│   ├── page.tsx              # Landing
│   ├── login/page.tsx        # Auth
│   ├── signup/page.tsx       # Registration + state select
│   ├── counter/page.tsx      # Main camera + counting
│   └── history/page.tsx      # Premium: scan history
├── components/
│   ├── Camera.tsx            # WebRTC camera component
│   ├── Counter.tsx           # Real-time count display
│   ├── BoundingBox.tsx       # Detection overlay
│   └── StateSelector.tsx     # Location picker
├── lib/
│   ├── supabase.ts           # DB client
│   ├── detector.ts           # YOLO model wrapper
│   ├── deposit-rates.ts      # State rates lookup
│   └── utils.ts
├── models/
│   └── yolov8n-bottles.onnx  # Trained model
└── public/
    └── ...
```

---

## Next Steps

1. **Phase 1: Model** (Week 1)
   - [ ] Download Beverage Containers dataset from Roboflow
   - [ ] Train YOLOv8n model
   - [ ] Convert to ONNX/TensorFlow.js format
   - [ ] Test inference speed on mobile browser

2. **Phase 2: Auth + DB** (Week 2)
   - [ ] Set up Supabase project
   - [ ] Create tables + seed deposit rates
   - [ ] Build signup/login flow

3. **Phase 3: Counter UI** (Week 3)
   - [ ] Camera component with WebRTC
   - [ ] Integrate ML model
   - [ ] Real-time bounding boxes + counting
   - [ ] State-based value calculation

4. **Phase 4: Polish + Launch** (Week 4)
   - [ ] PWA setup (offline support)
   - [ ] Mobile optimization
   - [ ] Beta testing
   - [ ] Launch on Product Hunt

---

## Technical Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Browser ML too slow on old phones | Offer "photo mode" fallback (snap + process) |
| Camera permissions blocked | Clear permission UI + fallback instructions |
| Model accuracy issues | Start with high-confidence threshold, improve with user feedback |
| State rate changes | Admin panel to update rates (or auto-scrape from state sites) |
