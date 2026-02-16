# CNTEM'UP - Bottle Counting App Roadmap

## Overview
PWA (Progressive Web App) that uses phone camera + ML to count bottles in real-time.

## Tech Stack
| Layer | Tech | Why |
|-------|------|-----|
| Frontend | React + Vite | Fast, modern, great PWA support |
| ML/Vision | TensorFlow.js | Runs in browser, no server costs |
| Backend | Bun + Hono | Fast runtime, free Cloudflare hosting |
| Database | Supabase | Free tier handles auth + history |
| Hosting | Cloudflare Pages | Free, fast, global CDN |

## Monetization
- **Free**: Camera counting, session total
- **Paid**: History logs, math (weight estimates, $ calculations), export data

---

## Phase 1: Foundation (MVP)
- [ ] Set up React + Vite project with PWA config
- [ ] Camera access component (WebRTC)
- [ ] Basic UI: camera view + counter display
- [ ] Test camera works on iOS Safari

## Phase 2: ML Integration
- [ ] Research pre-trained bottle detection models (Roboflow, TensorFlow Hub)
- [ ] Integrate TensorFlow.js
- [ ] Bottle detection logic (object enters frame = count)
- [ ] Optimize for mobile performance

## Phase 3: Gamification
- [ ] Sound effects on count
- [ ] Visual feedback (animations)
- [ ] Session summary screen
- [ ] Share results feature

## Phase 4: Backend + Paid Features
- [ ] Supabase setup (auth, database)
- [ ] User accounts
- [ ] History logging (paid)
- [ ] Math features: weight calc, $ estimate (paid)
- [ ] Stripe integration for payments

## Phase 5: Launch
- [ ] Domain setup (cntemup.com?)
- [ ] Landing page
- [ ] Beta test with GreenUp users
- [ ] Iterate based on feedback
- [ ] Public launch

---

## What's Needed From You
1. **Testing** - Try each build on your iPhone, report issues
2. **Training data** - Record videos/photos of bottle counting for ML tuning
3. **Domain** - Decide on domain name, purchase when ready
4. **GreenUp beta testers** - Line up 10-20 people to test
5. **Feedback** - What works, what doesn't, what users want

## What I Handle
- All code (frontend, backend, ML integration)
- Architecture decisions
- Debugging
- Deployment setup

---

## Next Steps
1. Set up the React + Vite project
2. Get camera working on iOS Safari
3. Find best pre-trained bottle detection model

---

*Last updated: 2026-01-27*
