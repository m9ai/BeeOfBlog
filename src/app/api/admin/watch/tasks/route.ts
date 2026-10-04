import { NextRequest, NextResponse } from 'next/server'
import { adminErrorResponse, checkAdmin } from '@/lib/admin-guard'
import { listWatchTasksForAdmin, type WatchStatusFilter } from '@/lib/watch-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/watch/tasks
 *
 * 后台「小蜜蜂盯」事项列表。
 * query：page（默认 1）/ pageSize（默认 20）/ status（active|all|具体状态）/ keyword / appid
 *
 * 响应：{ items[], total, totalPages, stats }
 *
 * 说明：watch_tasks 开了 RLS 且不对 anon/authenticated 授权，
 * 故这里鉴权后用 service_role 读取（见 lib/watch-admin.ts）。
 */
export async function GET(request: NextRequest) {
  const guard = await checkAdmin()
  const denied = adminErrorResponse(guard)

  if (denied) {
    return NextResponse.json({ error: denied.error }, { status: denied.status })
  }

  try {
    const { searchParams } = new URL(request.url)

    const page = Math.max(Number.parseInt(searchParams.get('page') || '1', 10) || 1, 1)
    const pageSizeRaw = Number.parseInt(searchParams.get('pageSize') || '', 10)
    const status = (searchParams.get('status') || 'active') as WatchStatusFilter

    const result = await listWatchTasksForAdmin({
      page,
      pageSize: Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? pageSizeRaw : undefined,
      status,
      keyword: searchParams.get('keyword') || undefined,
      appid: searchParams.get('appid') || undefined,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('[api/admin/watch/tasks GET]', error)
    return NextResponse.json({ error: (error as Error).message || '查询失败' }, { status: 500 })
  }
}
