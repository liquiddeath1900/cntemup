// Vercel Serverless Function — Create Stripe Customer Portal Session
// POST /api/create-portal-session (requires Bearer token)
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // JWT auth — verify caller identity
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const token = authHeader.split(' ')[1]
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    // Look up stripe_customer_id server-side — never trust the client
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single()

    if (profileErr || !profile?.stripe_customer_id) {
      return res.status(400).json({ error: 'No subscription found' })
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${req.headers.origin}/settings`,
    })

    res.status(200).json({ url: session.url })
  } catch (err) {
    console.error('Portal session error:', err.message)
    res.status(500).json({ error: 'Internal server error' })
  }
}
