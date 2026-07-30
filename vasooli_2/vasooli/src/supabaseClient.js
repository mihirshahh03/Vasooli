import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Missing Supabase env vars. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY ' +
    'to a local .env file, or to Environment Variables in your Vercel project settings.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Supabase Auth expects an email address. People here sign in with a username,
// so we map each username to a stable internal address. Nobody ever sees or
// types this -- it exists purely to satisfy the auth system.
export const usernameToEmail = (username) =>
  `${username.trim().toLowerCase()}@users.vasooli.app`

export const USERNAME_RULE = /^[a-z0-9_]{3,20}$/
