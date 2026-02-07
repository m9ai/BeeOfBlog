import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// 用于静态生成的客户端，不需要 cookies
export function createStaticClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
