import { createClient } from '@supabase/supabase-js'
import { IncomingForm } from 'formidable'
import { readFileSync } from 'fs'
import { checkRateLimit } from './_ratelimit.js'

export const config = { api: { bodyParser: false } }

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Allowlist of accepted image types → verified extension
const ALLOWED_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = new IncomingForm({ maxFileSize: 10 * 1024 * 1024 }) // 10MB
    form.parse(req, (err, fields, files) => {
      if (err) reject(err)
      else resolve({ fields, files })
    })
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server not configured' })
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

  // Rate limit per authenticated user
  const rl = await checkRateLimit(`slip:${user.id}`)
  if (!rl.allowed) {
    res.setHeader('Retry-After', Math.ceil((rl.reset - Date.now()) / 1000))
    return res.status(429).json({ error: 'Too many requests. Try again later.' })
  }

  try {
    const { fields, files } = await parseForm(req)
    const sessionId = Array.isArray(fields.session_id) ? fields.session_id[0] : fields.session_id
    const file = Array.isArray(files.file) ? files.file[0] : files.file

    if (!file || !sessionId) {
      return res.status(400).json({ error: 'Missing file or session_id' })
    }

    // Verify session exists
    const { data: session, error: sessErr } = await supabase
      .from('counting_sessions')
      .select('id, user_id')
      .eq('id', sessionId)
      .single()

    if (sessErr || !session) {
      return res.status(404).json({ error: 'Session not found' })
    }

    // Ownership — a user may only attach a slip to their OWN session
    if (session.user_id !== user.id) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    // Validate file type against allowlist — derive extension from the
    // VERIFIED mimetype, never the client-supplied filename.
    const mimetype = file.mimetype
    const ext = ALLOWED_TYPES[mimetype]
    if (!ext) {
      return res.status(400).json({ error: 'Unsupported file type' })
    }

    // Upload to Supabase Storage
    const storagePath = `${session.user_id}/${sessionId}.${ext}`
    const fileBuffer = readFileSync(file.filepath)

    const { error: uploadErr } = await supabase.storage
      .from('verification-slips')
      .upload(storagePath, fileBuffer, {
        contentType: mimetype,
        upsert: true,
      })

    if (uploadErr) throw uploadErr

    // Store the storage PATH (bucket is private — no public URL)
    const { error: insertErr } = await supabase
      .from('session_verifications')
      .insert({
        session_id: sessionId,
        user_id: session.user_id,
        image_url: storagePath,
        status: 'pending',
      })

    if (insertErr) throw insertErr

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('Upload slip error:', err)
    return res.status(500).json({ error: 'Upload failed' })
  }
}
