import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Demo seed data for testing with zero users
const DEMO_DATA = {
  rankings: [
    { display_name: 'BottleKing_NYC', total_count: 27340, is_premium: true, is_verified: true },
    { display_name: 'EcoWarrior', total_count: 14200, is_premium: true, is_verified: false },
    { display_name: 'CanCrusher99', total_count: 8750, is_premium: false, is_verified: true },
    { display_name: 'GreenMachine', total_count: 5100, is_premium: true, is_verified: false },
    { display_name: 'RecycleQueen', total_count: 3400, is_premium: false, is_verified: false },
    { display_name: 'TrashPanda', total_count: 2100, is_premium: false, is_verified: false },
    { display_name: 'NickelHunter', total_count: 1800, is_premium: true, is_verified: true },
    { display_name: 'CanMan_BK', total_count: 900, is_premium: false, is_verified: false },
    { display_name: 'BottleBoss', total_count: 450, is_premium: false, is_verified: false },
    { display_name: 'NewCounter', total_count: 120, is_premium: false, is_verified: false },
  ],
  globalStats: { totalBottles: 63860, totalCounters: 10 },
  isDemo: true,
  period: 'alltime',
}

// Get Monday 00:00 UTC for current week
function getWeekStart() {
  const now = new Date()
  const day = now.getUTCDay()
  const diff = day === 0 ? 6 : day - 1 // Monday = 0 offset
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() - diff)
  monday.setUTCHours(0, 0, 0, 0)
  return monday.toISOString()
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const period = req.query.period || 'weekly' // weekly (default) or alltime

  // Demo mode — for testing with zero users
  if (req.query.demo === 'true') {
    return res.status(200).json({ ...DEMO_DATA, period })
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(200).json({ ...DEMO_DATA, period })
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get all users who opted into leaderboard
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, display_name, is_premium, is_verified, show_on_leaderboard')
      .eq('show_on_leaderboard', true)

    if (profileError) throw profileError

    if (!profiles || profiles.length === 0) {
      return res.status(200).json({ ...DEMO_DATA, period })
    }

    // Build session query — exclude flagged, optionally filter by week
    const userIds = profiles.map(p => p.user_id)
    let sessQuery = supabase
      .from('counting_sessions')
      .select('user_id, count')
      .in('user_id', userIds)
      .or('is_flagged.is.null,is_flagged.eq.false')

    if (period === 'weekly') {
      sessQuery = sessQuery.gte('created_at', getWeekStart())
    }

    const { data: sessions, error: sessError } = await sessQuery
    if (sessError) throw sessError

    // Aggregate counts per user
    const countMap = {}
    for (const s of (sessions || [])) {
      countMap[s.user_id] = (countMap[s.user_id] || 0) + (s.count || 0)
    }

    // Trust tier weights — used as tiebreaker when counts are equal
    // Verified > Pro > Google (all Google auth) > Free
    function trustWeight(p) {
      if (p.is_verified) return 3
      if (p.is_premium) return 2
      return 1 // Google auth (all profiles are Google auth currently)
    }

    // Build rankings — no emails, no user IDs in response
    const rankings = profiles
      .map(p => ({
        display_name: p.display_name || 'Player',
        total_count: countMap[p.user_id] || 0,
        is_premium: p.is_premium || false,
        is_verified: p.is_verified || false,
        trust_tier: trustWeight(p),
      }))
      .filter(r => r.total_count > 0)
      .sort((a, b) => b.total_count - a.total_count || b.trust_tier - a.trust_tier)
      .slice(0, 50)

    // Global stats (all users, all time, not just opted-in)
    // Prefer a DB-side aggregate; fall back to a JS sum if the RPC isn't present.
    // TODO: move to SQL sum() RPC (sum_session_counts) permanently once deployed.
    let totalBottles = 0
    try {
      const { data: rpcTotal, error: rpcErr } = await supabase.rpc('sum_session_counts')
      if (rpcErr) throw rpcErr
      totalBottles = Number(rpcTotal) || 0
    } catch {
      const { data: allSessions } = await supabase
        .from('counting_sessions')
        .select('count')
      totalBottles = (allSessions || []).reduce((sum, s) => sum + (s.count || 0), 0)
    }

    const { count: totalCounters } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })

    return res.status(200).json({
      rankings,
      globalStats: {
        totalBottles,
        totalCounters: totalCounters || 0,
      },
      isDemo: false,
      period,
    })
  } catch (err) {
    console.error('Leaderboard error:', err)
    return res.status(200).json({ ...DEMO_DATA, period })
  }
}
