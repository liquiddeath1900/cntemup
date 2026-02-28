# CNTEMUP — Always-On Server Context

## ROLE
You are running on the always-on MacBook, controlled remotely via phone. Your main jobs:
- SEO research & content writing
- Competitor monitoring
- Background tasks the main dev machine doesn't need to run
- Quick fixes and git operations

## PROJECT
- **Repo:** https://github.com/liquiddeath1900/cntemup.git
- **Local path:** ~/Documents/CNTEMUP/app
- **Live site:** https://cntemup.com
- **Stack:** React + Vite, Supabase (auth + DB), Vercel (hosting + serverless), Stripe (payments)
- **Theme:** Game Boy DMG retro UI (Press Start 2P font, green-on-dark palette)
- **Purpose:** PWA bottle/can counter using phone camera tripwire detection
- **Competition:** ZERO direct competitors for camera-based counting

## ARCHITECTURE
- Static HTML content pages in `app/public/` (not React routes)
- React SPA at `/` with routes: `/counter`, `/settings`, `/admin`
- API routes in `app/api/` (Vercel serverless functions)
- Supabase for auth (Google OAuth) + database (profiles, waitlist)
- Stripe for Pro tier ($2/mo) — test mode currently
- Vercel root is `app/` directory

## LIVE CONTENT PAGES (7 total, all in public/)
1. `/` — Homepage (React SPA)
2. `/bottle-deposit-states` — All 10 US deposit states guide
3. `/how-many-cans-to-make-100` — Earnings calculator content
4. `/bottle-deposit-calculator` — Interactive JS calculator
5. `/bottle-deposit-near-me` — Where to return by state
6. `/how-to-count-cans-fast` — 5 methods compared
7. `/bottle-deposit-countries` — 40+ countries (Germany Pfand, Scandinavia, Australia)

## SEO STATUS
- Google Search Console verified, sitemap submitted (7 pages, Status: Success)
- Homepage indexed, other pages indexing requested
- All pages cross-linked in Related Guides sections
- Landing page footer has 5 content links
- Crushing language: "don't crush unless your center allows it" (enforced everywhere)

## GLOBAL GROWTH ROADMAP
- Phase 1 (now-60d): US SEO compound + Reddit/TikTok + canner community partnerships
- Phase 2 (60-120d): Sharing loop, localization (German/Swedish/Dutch), country landing pages
- Phase 3 (120-180d): Germany → Australia → Scandinavia expansion
- Phase 4 (180d+): B2B API, redemption center partnerships, Pro push
- Biggest unlocks: TikTok virality, localized pages (zero competition), sharing loop

## PRO TIER
- Free: Camera counter (unlimited counts)
- Pro: Deposit value display, state-specific rates
- Stripe webhook at `/api/stripe-webhook`
- Customer portal via `/api/create-portal-session`

## AUTH FLOW
- Free users: name + email → `waitlist` table + localStorage
- Pro users: Google OAuth → Stripe checkout → webhook sets `is_premium`
- Sign out: nuke sb-* localStorage keys + race signOut() vs 2s timeout

## ADMIN
- Route: `/admin`, guarded by `user.email === VITE_ADMIN_EMAIL`
- Admin email: fatfatproductions@gmail.com
- Shows: user counts, signups, sessions, waitlist, click-to-expand user cards

## KEY DECISIONS
- Don't crush cans language enforced everywhere
- All internal links use React Router `<Link>` (not `<a href>`)
- iOS zoom prevention on inputs
- Webhook returns 500 on Supabase error → Stripe retries
- RLS trigger prevents self-promotion to premium
- Deposit value = Pro-only, count = free

## GIT WORKFLOW (CRITICAL)
You share this repo with the main dev MacBook via GitHub.
- **ALWAYS `git pull` before starting any work**
- **ALWAYS `git push` after making changes**
- Never force push
- Commit messages should be descriptive

## CONTENT WRITING RULES
When writing new SEO pages:
- Match existing style: dark theme (#0a1a0a bg, #9bbc0f green, #e0e0e0 text)
- Include: canonical URL, OG tags, structured data (FAQ/HowTo schema)
- Add to sitemap.xml
- Cross-link with all existing pages in Related Guides
- CTA pointing to cntemup.com
- Footer: CNTEM'UP branding + © 2026
- Don't crush cans unless center allows it

## COMMUNICATION STYLE
- Concise (max 4 lines per response)
- Less talk, more action
- Ask before expensive tool usage

## MCP SERVERS AVAILABLE
- **Brave Search** — Web search
- **Exa** — AI-powered search, competitor research
- **Firecrawl** — Site scraping, content extraction
- **Memory** — Persistent knowledge graph
- **Sequential Thinking** — Complex reasoning
- **Supabase** — Database queries (optional)
- **Local Falcon** — Local SEO rankings (optional)

## WHAT YOU'RE GOOD FOR (from phone)
- Research keywords and competitors
- Draft new content pages
- Monitor SEO rankings
- Check site status
- Write and push content updates
- Run site audits via Firecrawl/Exa
- Quick git operations
