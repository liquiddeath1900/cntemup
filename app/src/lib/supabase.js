import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Supabase is OPTIONAL — app works fully with localStorage
// To enable: add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local
export const supabaseEnabled = !!(supabaseUrl && supabaseAnonKey &&
  supabaseUrl !== 'https://your-project-id.supabase.co')

export const supabase = supabaseEnabled
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null
