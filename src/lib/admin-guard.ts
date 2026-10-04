/**
 * 后台管理员鉴权（服务端）
 *
 * 供后台 Server Component 与 /api/admin/** 路由共用。
 *
 * 关于「为什么不能在这里硬查 user_roles」：
 *   现有后台页（admin/wishlist）的 checkAdmin() 只调 supabase.auth.getSession()，
 *   这一步是纯本地 cookie 解析、不发网络请求，所以任何网络状况下都能进；
 *   而一旦在服务端补查 user_roles，就会依赖「服务端进程 -> supabase.co」的连通性，
 *   本地开发/内网受限环境下该请求会 fetch failed，守卫 fail-closed，
 *   已登录的管理员被误判为未登录并踢回 /admin/login。
 *
 * 因此这里拆成两级：
 *   1. session 缺失      → 明确未登录，跳登录页 / 401
 *   2. 角色校验
 *      - 查到且不是 admin → 明确无权限，展示 403 / 403，不跳登录
 *      - 查询本身失败      → 降级放行（与项目现状一致）并打 warn 日志，
 *                            网络恢复后自动恢复严格校验
 */

import { createClient } from './supabase/server'

export type AdminCheckResult =
  | { ok: true; degraded: boolean }
  | { ok: false; reason: 'no-session' | 'not-admin' }

export async function checkAdmin(): Promise<AdminCheckResult> {
  let supabase

  try {
    supabase = await createClient()
  } catch (error) {
    console.error('[admin-guard] 创建 Supabase 客户端失败:', error)
    return { ok: false, reason: 'no-session' }
  }

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return { ok: false, reason: 'no-session' }
  }

  try {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .maybeSingle()

    if (error) {
      console.warn(
        `[admin-guard] 角色查询失败（userId=${session.user.id}）：${error.message}，按项目现状降级放行`
      )
      return { ok: true, degraded: true }
    }

    if (data?.role !== 'admin') {
      return { ok: false, reason: 'not-admin' }
    }

    return { ok: true, degraded: false }
  } catch (error) {
    console.warn(
      `[admin-guard] 角色查询异常（userId=${session.user.id}）：${(error as Error).message}，按项目现状降级放行`
    )
    return { ok: true, degraded: true }
  }
}

/** 兼容旧调用：只要不是「明确无权限」就放行 */
export async function isAdmin(): Promise<boolean> {
  return (await checkAdmin()).ok
}

/**
 * 把鉴权结果翻译成 HTTP 错误响应体。
 * 未登录 401（前端应跳登录），已登录但非管理员 403（前端不应跳登录）。
 */
export function adminErrorResponse(
  result: AdminCheckResult
): { status: number; error: string } | null {
  if (result.ok) {
    return null
  }

  return result.reason === 'no-session'
    ? { status: 401, error: 'Unauthorized' }
    : { status: 403, error: 'Forbidden' }
}
