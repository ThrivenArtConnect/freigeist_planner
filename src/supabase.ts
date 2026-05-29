import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export function getUserId(): string {
  let uid = localStorage.getItem('freigeist_user_id')
  if (!uid) { uid = crypto.randomUUID(); localStorage.setItem('freigeist_user_id', uid) }
  return uid
}
