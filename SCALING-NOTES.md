# CNTEMUP Scaling Notes

## Current Architecture (Feb 2026)
- **Hosting:** Vercel (free tier)
- **Database:** Supabase (free tier)
- **Payments:** Stripe (test mode)
- **Auth:** Google OAuth (Supabase) + simple name/email (localStorage)

## Free Tier Limits & When They Hit

| Resource | Free Limit | ~When it breaks | Warning sign |
|----------|-----------|-----------------|--------------|
| Supabase DB storage | 500MB | ~5K-10K active users | DB usage > 400MB in Supabase dashboard |
| Supabase auth users | 50K | ~50K signups | Auth user count approaching 50K |
| Supabase bandwidth | 2GB/month | ~2K-5K daily active users | Bandwidth usage spikes in dashboard |
| Supabase API requests | Unlimited (but rate limited) | ~10K concurrent | 429 errors in logs |
| Vercel bandwidth | 100GB/month | ~50K-100K monthly visitors | Vercel usage dashboard |
| Vercel serverless | 100GB-hrs/month | ~500K API calls/month | Function execution warnings |

## When to Upgrade (Action Triggers)

### Supabase → Pro ($25/mo) — UPGRADE WHEN:
- [ ] Database usage exceeds 400MB (check: Supabase Dashboard → Settings → Usage)
- [ ] Auth users exceed 40K (check: Supabase Dashboard → Auth → Users count)
- [ ] Monthly bandwidth exceeds 1.5GB (check: Supabase Dashboard → Reports)
- [ ] You see slow admin dashboard loads (those COUNT(*) queries)

### Vercel → Pro ($20/mo) — UPGRADE WHEN:
- [ ] Monthly bandwidth exceeds 80GB
- [ ] Serverless function execution nears 100GB-hrs
- [ ] You need preview deployments for testing

## How to Monitor (No Built-In Alerts on Free Tier)

### Weekly Check (takes 2 min):
1. **Supabase Dashboard → Settings → Usage** — check DB size + bandwidth
2. **Vercel Dashboard → Usage** — check bandwidth + function invocations
3. **Admin dashboard (/admin)** — check total user count growth rate

### Set Calendar Reminder:
- Every Monday: check Supabase + Vercel usage dashboards
- If total users > 1,000: start checking twice a week
- If total users > 5,000: upgrade Supabase Pro immediately

## Scaling Fixes (When Needed)

### Phase 1: Quick wins ($0)
- Add DB indexes on `profiles.created_at`, `counting_sessions.user_id`
- Cache admin stats (add `Cache-Control` headers, reduce poll to 60s)
- Paginate the recent signups query

### Phase 2: Upgrade tiers (~$45/mo)
- Supabase Pro ($25/mo): 8GB DB, 250GB bandwidth, unlimited auth
- Vercel Pro ($20/mo): 1TB bandwidth, more serverless hours
- Break-even: ~23 Pro subscribers at $2/mo

### Phase 3: Optimization (if needed at 50K+ users)
- Move admin stats to Supabase Edge Functions (runs on DB server, no network hop)
- Add Redis/Upstash for caching hot queries
- Consider session data archival (move sessions older than 90 days to cold storage)

## Profitability Math
- Supabase Pro: $25/mo
- Vercel Pro: $20/mo
- Stripe fees: 2.9% + 30¢ per $2 charge = ~$0.36/user/mo
- **Total overhead: ~$45/mo fixed + $0.36/user variable**
- **Break-even: 28 Pro subscribers**
- **100 Pro subscribers = $164/mo profit**
- **1,000 Pro subscribers = $1,595/mo profit**
