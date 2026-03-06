// Vercel Serverless Function — Admin Stats API
// GET /api/admin-stats (requires Bearer token from admin user)
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const ADMIN_EMAIL = process.env.ADMIN_EMAIL

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // JWT auth — verify caller identity from Supabase access token
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const token = authHeader.split(' ')[1]
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // Admin check — verified email must match server-side ADMIN_EMAIL
  if (!ADMIN_EMAIL || user.email !== ADMIN_EMAIL) {
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
    } catch { /* table may not exist */ }

    // Waitlist entries (name+email free signups) — last 50
    let recentWaitlist = []
    try {
      const { data } = await supabase
        .from('waitlist')
        .select('name, email, source, created_at')
        .order('created_at', { ascending: false })
        .limit(50)
      recentWaitlist = data || []
    } catch { /* table may not exist */ }

    // Flagged sessions — suspicious rate/count
    let flaggedSessions = []
    try {
      const { data } = await supabase
        .from('counting_sessions')
        .select('id, user_id, count, duration_seconds, is_flagged, flag_reason, started_at, created_at')
        .eq('is_flagged', true)
        .order('created_at', { ascending: false })
        .limit(50)
      // Enrich with display names
      if (data?.length) {
        const flaggedUserIds = [...new Set(data.map(s => s.user_id))]
        const { data: flaggedProfiles } = await supabase
          .from('profiles')
          .select('user_id, display_name')
          .in('user_id', flaggedUserIds)
        const nameMap = {}
        for (const p of (flaggedProfiles || [])) nameMap[p.user_id] = p.display_name
        flaggedSessions = data.map(s => ({
          ...s,
          display_name: nameMap[s.user_id] || 'Unknown',
          rate: s.duration_seconds > 0 ? (s.count / s.duration_seconds).toFixed(2) : '—',
        }))
      }
    } catch { /* table may not exist */ }

    // Pending verification slips
    let pendingVerifications = []
    try {
      const { data } = await supabase
        .from('session_verifications')
        .select('id, session_id, user_id, image_url, status, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(50)
      if (data?.length) {
        // Enrich with session count + user name
        const sessIds = data.map(v => v.session_id)
        const userIds = [...new Set(data.map(v => v.user_id))]
        const { data: sessions } = await supabase
          .from('counting_sessions')
          .select('id, count, deposit_value, state_code')
          .in('id', sessIds)
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, display_name, state_code')
          .in('user_id', userIds)
        const sessMap = {}
        for (const s of (sessions || [])) sessMap[s.id] = s
        const nameMap = {}
        for (const p of (profiles || [])) nameMap[p.user_id] = p.display_name
        pendingVerifications = data.map(v => {
          const sess = sessMap[v.session_id] || {}
          const stateCode = sess.state_code || 'NY'
          return {
            ...v,
            display_name: nameMap[v.user_id] || 'Unknown',
            count: sess.count || 0,
            deposit_value: sess.deposit_value || 0,
            state_code: stateCode,
          }
        })
      }
    } catch { /* table may not exist */ }

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
    } catch { /* admin API may not be available */ }

    // Build unified user list — merge auth, profiles, waitlist
    const profileMap = {}
    for (const p of (recentSignups || [])) profileMap[p.user_id] = p
    const authEmailMap = {}
    for (const a of authUsers) authEmailMap[a.id] = a.email

    const allUsers = []

    // Google/Pro users (auth + profile)
    for (const a of authUsers) {
      const p = profileMap[a.id] || {}
      allUsers.push({
        id: a.id,
        name: p.display_name || p.full_name || a.email?.split('@')[0] || 'Unknown',
        email: a.email,
        type: p.is_premium ? 'PRO' : 'GOOGLE',
        state_code: p.state_code || null,
        subscription_status: p.subscription_status || null,
        created_at: a.created_at,
        last_sign_in: a.last_sign_in,
        source: a.provider,
      })
    }

    // Waitlist-only users (not in auth)
    const authEmails = new Set(authUsers.map(a => a.email?.toLowerCase()))
    for (const w of recentWaitlist) {
      if (!authEmails.has(w.email?.toLowerCase())) {
        allUsers.push({
          id: `waitlist-${w.email}`,
          name: w.name || 'Anonymous',
          email: w.email,
          type: 'FREE',
          state_code: null,
          subscription_status: null,
          created_at: w.created_at,
          last_sign_in: null,
          source: w.source || 'landing',
        })
      }
    }

    // Sort all by created_at descending
    allUsers.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

    res.status(200).json({
      totalUsers: (totalUsers || 0) + waitlistCount,
      premiumUsers: premiumUsers || 0,
      googleUsers: authUsers.length,
      freeUsers: waitlistCount,
      signupsWeek: signupsWeek || 0,
      signupsMonth: signupsMonth || 0,
      visitorCount,
      waitlistCount,
      totalSessions,
      allUsers,
      recentSignups: recentSignups || [],
      recentWaitlist,
      authUsers,
      flaggedSessions,
      pendingVerifications,
    })
  } catch (err) {
    console.error('Admin stats error:', err.message)
    res.status(500).json({ error: 'Internal server error' })
  }
}
