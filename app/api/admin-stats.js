// Vercel Serverless Function — Admin Stats API
// GET /api/admin-stats?email=admin@example.com
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.VITE_ADMIN_EMAIL

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Auth check — verify admin email
  const email = req.query.email
  if (!email || email !== ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  try {
    // Total users
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })

    // Premium users
    const { count: premiumUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('is_premium', true)

    // Signups last 7 days
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { count: signupsWeek } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', weekAgo)

    // Signups last 30 days
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { count: signupsMonth } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', monthAgo)

    // Recent signups (last 50)
    const { data: recentSignups } = await supabase
      .from('profiles')
      .select('user_id, display_name, full_name, state_code, is_premium, subscription_status, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(50)

    // Visitor count (if visitors table exists)
    let visitorCount = 0
    try {
      const { count } = await supabase
        .from('visitors')
        .select('*', { count: 'exact', head: true })
      visitorCount = count || 0
    } catch {
      // visitors table may not exist
    }

    // Waitlist count
    let waitlistCount = 0
    try {
      const { count } = await supabase
        .from('waitlist')
        .select('*', { count: 'exact', head: true })
      waitlistCount = count || 0
    } catch {
      // waitlist table may not exist
    }

    // Total sessions
    let totalSessions = 0
    try {
      const { count } = await supabase
        .from('counting_sessions')
        .select('*', { count: 'exact', head: true })
      totalSessions = count || 0
    } catch {}

    // Waitlist entries (name+email free signups) — last 50
    let recentWaitlist = []
    try {
      const { data } = await supabase
        .from('waitlist')
        .select('name, email, source, created_at')
        .order('created_at', { ascending: false })
        .limit(50)
      recentWaitlist = data || []
    } catch {}

    // Auth users from Supabase (Google sign-ins) — get emails via admin API
    let authUsers = []
    try {
      const { data } = await supabase.auth.admin.listUsers({ perPage: 50 })
      authUsers = (data?.users || []).map(u => ({
        id: u.id,
        email: u.email,
        provider: u.app_metadata?.provider || 'email',
        created_at: u.created_at,
        last_sign_in: u.last_sign_in_at,
      }))
    } catch {}

    res.status(200).json({
      totalUsers: totalUsers || 0,
      premiumUsers: premiumUsers || 0,
      freeUsers: (totalUsers || 0) - (premiumUsers || 0),
      signupsWeek: signupsWeek || 0,
      signupsMonth: signupsMonth || 0,
      visitorCount,
      waitlistCount,
      totalSessions,
      recentSignups: recentSignups || [],
      recentWaitlist,
      authUsers,
    })
  } catch (err) {
    console.error('Admin stats error:', err.message)
    res.status(500).json({ error: err.message })
  }
}
