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
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  // Demo mode — for testing with zero users
  if (req.query.demo === 'true') {
    return res.status(200).json(DEMO_DATA)
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(200).json(DEMO_DATA) // Fallback to demo if no Supabase
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get all users who opted into leaderboard, with their total counts
    // Join profiles (where show_on_leaderboard = true) with sum of counting_sessions
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, display_name, is_premium, show_on_leaderboard')
      .eq('show_on_leaderboard', true)

    if (profileError) throw profileError

    if (!profiles || profiles.length === 0) {
      // No opted-in users — return demo data so page isn't empty
      return res.status(200).json(DEMO_DATA)
    }

    // Get session counts for opted-in users
    const userIds = profiles.map(p => p.user_id)
    const { data: sessions, error: sessError } = await supabase
      .from('counting_sessions')
      .select('user_id, count')
      .in('user_id', userIds)

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
      .sort((a, b) => b.total_count - a.total_count)
      .slice(0, 50)

    // Global stats (all users, not just opted-in)
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
    })
  } catch (err) {
    console.error('Leaderboard error:', err)
    // On error, return demo data so page still works
    return res.status(200).json({ ...DEMO_DATA, error: err.message })
  }
}
