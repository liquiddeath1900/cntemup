import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Demo seed data for testing with zero users
const DEMO_DATA = {
  rankings: [
    { display_name: 'BottleKing_NYC', total_count: 27340, is_premium: true },
    { display_name: 'EcoWarrior', total_count: 14200, is_premium: true },
    { display_name: 'CanCrusher99', total_count: 8750, is_premium: false },
    { display_name: 'GreenMachine', total_count: 5100, is_premium: true },
    { display_name: 'RecycleQueen', total_count: 3400, is_premium: false },
    { display_name: 'TrashPanda', total_count: 2100, is_premium: false },
    { display_name: 'NickelHunter', total_count: 1800, is_premium: true },
    { display_name: 'CanMan_BK', total_count: 900, is_premium: false },
    { display_name: 'BottleBoss', total_count: 450, is_premium: false },
    { display_name: 'NewCounter', total_count: 120, is_premium: false },
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
      .select('user_id, display_name, is_premium, show_on_leaderboard')
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

    // Build rankings — no emails, no user IDs in response
    const rankings = profiles
      .map(p => ({
        display_name: p.display_name || 'Player',
        total_count: countMap[p.user_id] || 0,
        is_premium: p.is_premium || false,
      }))
      .filter(r => r.total_count > 0) // Hide zero-count users in weekly view
      .sort((a, b) => b.total_count - a.total_count)
      .slice(0, 50)

    // Global stats (all users, all time, not just opted-in)
    const { data: allSessions } = await supabase
      .from('counting_sessions')
      .select('count')

    const totalBottles = (allSessions || []).reduce((sum, s) => sum + (s.count || 0), 0)

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
    return res.status(200).json({ ...DEMO_DATA, error: err.message, period })
  }
}
