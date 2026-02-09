import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// 用于静态生成的客户端，不需要 cookies
export function createStaticClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!url || !key) {
    console.warn('Supabase environment variables are missing, returning null client')
    return null
  }
  
  return createSupabaseClient(url, key)
}
