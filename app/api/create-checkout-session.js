// Vercel Serverless Function — Create Stripe Checkout Session
// POST /api/create-checkout-session (requires Bearer token)
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, clientIp } from './_ratelimit.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Pin redirect URLs to the apex — never trust the forgeable req.headers.origin.
const ORIGIN = process.env.PUBLIC_ORIGIN || 'https://cntemup.com'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Rate limit by IP first — burns one Upstash command per request, fails open.
  // Blocks unauth spam before we even hit Supabase auth.
  const ip = clientIp(req)
  const rl = await checkRateLimit(`ip:${ip}`)
  if (!rl.allowed) {
    res.setHeader('Retry-After', Math.ceil((rl.reset - Date.now()) / 1000))
    return res.status(429).json({ error: 'Too many requests. Try again later.' })
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
    // Use verified user identity — never trust request body
    const userId = user.id
    const email = user.email

    if (!userId || !email) {
      return res.status(400).json({ error: 'Authenticated account required' })
    }

    // Verify user actually exists in Supabase before creating checkout
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('user_id', userId)
      .single()

    if (profileErr || !profile) {
      return res.status(400).json({ error: 'User not found' })
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: email,
      client_reference_id: userId,
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      success_url: `${ORIGIN}/settings?upgraded=true`,
      cancel_url: `${ORIGIN}/settings`,
    })

    res.status(200).json({ url: session.url })
  } catch (err) {
    console.error('Checkout error:', err.message)
    res.status(500).json({ error: 'Internal server error' })
  }
}
