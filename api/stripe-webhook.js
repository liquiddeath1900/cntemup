// Vercel Serverless Function — Stripe Webhook Handler
// POST /api/stripe-webhook (raw body, signature verified)
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

// Service role client — bypasses RLS for webhook updates
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Statuses that count as "premium" — don't kill access on payment retry
const PREMIUM_STATUSES = new Set(['active', 'past_due', 'trialing'])

// Read raw body from request stream (Vercel serverless, NOT Next.js)
async function getRawBody(req) {
  const chunks = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks)
}

// Helper — update profile with error checking, returns 500 on failure
async function updateProfile(filter, updates) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq(filter.column, filter.value)
    .select()

  if (error) {
    console.error(`Supabase update failed [${filter.column}=${filter.value}]:`, error.message)
    throw new Error(`Supabase update failed: ${error.message}`)
  }
  if (!data || data.length === 0) {
    console.error(`No profile found for ${filter.column}=${filter.value}`)
    throw new Error(`No profile matched ${filter.column}=${filter.value}`)
  }
  return data
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  let event

  try {
    const rawBody = await getRawBody(req)
    const sig = req.headers['stripe-signature']

    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message)
    return res.status(400).json({ error: 'Invalid signature' })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        const userId = session.client_reference_id
        const customerId = session.customer

        if (!userId || userId === 'local') {
          console.error('Checkout missing valid user ID:', userId)
          return res.status(400).json({ error: 'Missing user ID' })
        }

        await updateProfile(
          { column: 'user_id', value: userId },
          {
            is_premium: true,
            stripe_customer_id: customerId,
            subscription_status: 'active',
            premium_since: new Date().toISOString(),
          }
        )
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object
        const customerId = subscription.customer

        await updateProfile(
          { column: 'stripe_customer_id', value: customerId },
          {
            is_premium: false,
            subscription_status: 'canceled',
          }
        )
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object
        const customerId = subscription.customer
        const status = subscription.status

        await updateProfile(
          { column: 'stripe_customer_id', value: customerId },
          {
            is_premium: PREMIUM_STATUSES.has(status),
            subscription_status: status,
          }
        )
        break
      }
    }

    res.status(200).json({ received: true })
  } catch (err) {
    console.error('Webhook handler error:', err.message)
    // Return 500 so Stripe retries — user won't lose their money
    res.status(500).json({ error: 'Webhook processing failed' })
  }
}
