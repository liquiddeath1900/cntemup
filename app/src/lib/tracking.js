import { supabase, supabaseEnabled } from './supabase'

const VISITORS_KEY = 'cntemup_visitors'
const VISITOR_ID_KEY = 'cntemup_vid'

// Get or create a persistent visitor ID
function getVisitorId() {
  let vid = localStorage.getItem(VISITOR_ID_KEY)
  if (!vid) {
    vid = crypto.randomUUID()
    localStorage.setItem(VISITOR_ID_KEY, vid)
  }
  return vid
}

// Fetch rough location from IP (free, no API key needed)
async function getGeoLocation() {
  try {
    const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(4000) })
    if (!res.ok) return {}
    const data = await res.json()
    return {
      ip: data.ip || null,
      city: data.city || null,
      region: data.region || null,
      country: data.country_name || null,
      lat: data.latitude || null,
      lon: data.longitude || null,
    }
  } catch {
    // Fallback — still track without geo
    return {}
  }
}

// Get basic device info
function getDeviceInfo() {
  const ua = navigator.userAgent
  let device = 'unknown'
  if (/iPhone/i.test(ua)) device = 'iPhone'
  else if (/iPad/i.test(ua)) device = 'iPad'
  else if (/Android/i.test(ua)) device = 'Android'
  else if (/Mac/i.test(ua)) device = 'Mac'
  else if (/Windows/i.test(ua)) device = 'Windows'
  else if (/Linux/i.test(ua)) device = 'Linux'

  return {
    device,
    screen: `${screen.width}x${screen.height}`,
    referrer: document.referrer || null,
  }
}

// Track a page visit — runs once on landing page load
export async function trackVisit(page = '/') {
  const visitorId = getVisitorId()
  const deviceInfo = getDeviceInfo()
  const geo = await getGeoLocation()

  const visit = {
    visitor_id: visitorId,
    ip: geo.ip || null,
    city: geo.city || null,
    region: geo.region || null,
    country: geo.country || null,
    lat: geo.lat || null,
    lon: geo.lon || null,
    device: deviceInfo.device,
    screen: deviceInfo.screen,
    referrer: deviceInfo.referrer,
    page,
    created_at: new Date().toISOString(),
  }

  if (supabaseEnabled && supabase) {
    try {
      await supabase.from('visitors').insert(visit)
    } catch (err) {
      console.warn('[Tracking] Supabase insert failed, saving locally', err)
      saveLocal(visit)
    }
  } else {
    saveLocal(visit)
  }

  return { visitorId, geo }
}

function saveLocal(visit) {
  const visits = JSON.parse(localStorage.getItem(VISITORS_KEY) || '[]')
  visits.push(visit)
  localStorage.setItem(VISITORS_KEY, JSON.stringify(visits))
}

// Get visitor's geo data (for pre-filling forms, showing local info)
export async function getVisitorGeo() {
  return getGeoLocation()
}
