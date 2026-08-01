// Vercel Cron target — keeps the free-tier Supabase project from auto-pausing
// after 7 days of inactivity. A paused project goes offline (its host stops
// resolving), which breaks Google sign-in and every other DB call. Running a
// query on a schedule keeps the project counted as "active".
//
// Configured to run daily via the "crons" entry in vercel.json.
//
// Uses the PUBLIC publishable (anon) key — the same one shipped in the client
// bundle at cntemup.com. It is intentionally public, NOT a secret.

const SUPABASE_URL = 'https://swweixlboynzfsguabva.supabase.co'
const ANON_KEY = 'sb_publishable_6dvJl6W-ZrKp9d_7aAB6Tg_NbT413J8'

export default async function handler(req, res) {
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?select=user_id&limit=1`,
      { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } },
    )
    // Any HTTP status means the DB was reached = activity registered.
    return res.status(200).json({
      ok: true,
      supabase: r.status,
      at: new Date().toISOString(),
    })
  } catch (err) {
    // A network error means the project is paused/unreachable — the cron still
    // ran, so we report it without failing the invocation.
    return res.status(200).json({
      ok: false,
      error: String(err?.message || err),
      at: new Date().toISOString(),
    })
  }
}
