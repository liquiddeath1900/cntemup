// Vercel Serverless Function — Create Stripe Customer Portal Session
// POST /api/create-portal-session { customerId }
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { customerId } = req.body

    if (!customerId) {
      return res.status(400).json({ error: 'Customer ID required' })
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${req.headers.origin}/settings`,
    })

    res.status(200).json({ url: session.url })
  } catch (err) {
    console.error('Portal session error:', err.message)
    res.status(500).json({ error: err.message })
  }
}
