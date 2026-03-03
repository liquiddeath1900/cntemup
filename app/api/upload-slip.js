import { createClient } from '@supabase/supabase-js'
import { IncomingForm } from 'formidable'
import { readFileSync } from 'fs'

export const config = { api: { bodyParser: false } }

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

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

  try {
    const { fields, files } = await parseForm(req)
    const sessionId = Array.isArray(fields.session_id) ? fields.session_id[0] : fields.session_id
    const file = Array.isArray(files.file) ? files.file[0] : files.file

    if (!file || !sessionId) {
      return res.status(400).json({ error: 'Missing file or session_id' })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify session exists
    const { data: session, error: sessErr } = await supabase
      .from('counting_sessions')
      .select('id, user_id')
      .eq('id', sessionId)
      .single()

    if (sessErr || !session) {
      return res.status(404).json({ error: 'Session not found' })
    }

    // Upload to Supabase Storage
    const ext = file.originalFilename?.split('.').pop() || 'jpg'
    const storagePath = `${session.user_id}/${sessionId}.${ext}`
    const fileBuffer = readFileSync(file.filepath)

    const { error: uploadErr } = await supabase.storage
      .from('verification-slips')
      .upload(storagePath, fileBuffer, {
        contentType: file.mimetype || 'image/jpeg',
        upsert: true,
      })

    if (uploadErr) throw uploadErr

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('verification-slips')
      .getPublicUrl(storagePath)

    // Create verification record
    const { error: insertErr } = await supabase
      .from('session_verifications')
      .insert({
        session_id: sessionId,
        user_id: session.user_id,
        image_url: urlData.publicUrl,
        status: 'pending',
      })

    if (insertErr) throw insertErr

    return res.status(200).json({ success: true, image_url: urlData.publicUrl })
  } catch (err) {
    console.error('Upload slip error:', err)
    return res.status(500).json({ error: 'Upload failed' })
  }
}
