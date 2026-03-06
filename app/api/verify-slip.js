// Vercel Serverless Function — Verify/Reject a slip (admin only)
// POST /api/verify-slip { verification_id, action: 'approve' | 'reject' }
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const ADMIN_EMAIL = process.env.ADMIN_EMAIL

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // JWT auth
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const token = authHeader.split(' ')[1]
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // Admin check
  if (!ADMIN_EMAIL || user.email !== ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const { verification_id, action } = req.body || {}
  if (!verification_id || !['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'Missing verification_id or invalid action (approve/reject)' })
  }

  try {
    const now = new Date().toISOString()
    const newStatus = action === 'approve' ? 'approved' : 'rejected'

    // Update verification status
    const { data: verification, error: updateError } = await supabase
      .from('session_verifications')
      .update({ status: newStatus, verified_at: now, verified_by: user.email })
      .eq('id', verification_id)
      .select('user_id')
      .single()

    if (updateError) throw updateError

    // On approve: mark user as verified if not already
    if (action === 'approve' && verification?.user_id) {
      await supabase
        .from('profiles')
        .update({ is_verified: true, updated_at: now })
        .eq('user_id', verification.user_id)
    }

    return res.status(200).json({ success: true, status: newStatus })
  } catch (err) {
    console.error('Verify slip error:', err.message)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
