/**
 * service_role 客户端（服务端专用）
 *
 * 用途：绕过 RLS 读写受保护的表与私有存储桶。
 * 与 lib/wx-wish.ts / lib/wx-xpay.ts 内联的 getDb() 行为一致，这里抽成共享模块，
 * 供「小蜜蜂盯」等新模块复用，避免每处重复实现。
 *
 * 注意：只能在服务端（Route Handler / Server Component）引用，绝不可打进客户端包。
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export function getServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('缺少 Supabase 配置（NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY）')
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
