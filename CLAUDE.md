# CNTEMUP Project Rules

## Stack
- React + Vite (PWA), Supabase (auth + DB), Vercel (hosting + serverless), Stripe (payments)
- Game Boy DMG retro UI — Press Start 2P font, green-on-dark palette
- App code in `app/`, API routes in `app/api/`

## Before Committing
- Run `npm run lint` in `app/` — must pass with 0 errors
- Run `semgrep scan --config auto src/ api/` (greg) — must have 0 findings
- Never commit .env files or API keys

## Deployment
- Deploy from `/Documents/CNTEMUP/` root (NOT `/app/`)
- Vercel project name: `cntemup` (not `app`)
- Never deploy without explicit user request
- Always build-test before deploy: `cd app && npm run build`

## Security
- VITE_* env vars are client-visible — never put secrets there
- ADMIN_EMAIL (non-VITE) is server-side only
- RLS trigger prevents users from self-promoting to premium
- Validate all user input server-side in API routes

## Architecture
- Local-first: works without Supabase, localStorage fallback
- AuthProvider in main.jsx wraps entire app
- Only 10 US states have bottle deposit laws
- Internal links use React Router `<Link>` not `<a href>`
