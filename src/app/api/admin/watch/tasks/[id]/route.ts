import { NextRequest, NextResponse } from 'next/server'
import { adminErrorResponse, checkAdmin } from '@/lib/admin-guard'
import {
  getWatchTaskForAdmin,
  softDeleteWatchTask,
  updateWatchTaskStatus,
} from '@/lib/watch-admin'
import type { WatchStatus } from '@/lib/watch'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED_STATUSES: WatchStatus[] = [
  'submitted',
  'watching',
  'resolved',
  'closed',
  'deleted',
]

/**
 * GET /api/admin/watch/tasks/:id —— 事项详情（含附件）
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const guard = await checkAdmin()
  const denied = adminErrorResponse(guard)

  if (denied) {
    return NextResponse.json({ error: denied.error }, { status: denied.status })
  }

  try {
    const task = await getWatchTaskForAdmin(params.id)

    if (!task) {
      return NextResponse.json({ error: '未找到该事项' }, { status: 404 })
    }

    return NextResponse.json(task)
  } catch (error) {
    console.error('[api/admin/watch/tasks/[id] GET]', error)
    return NextResponse.json({ error: (error as Error).message || '查询失败' }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/watch/tasks/:id —— 改状态
 * 请求体：{ status: 'submitted'|'watching'|'resolved'|'closed'|'deleted' }
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const guard = await checkAdmin()
  const denied = adminErrorResponse(guard)

  if (denied) {
    return NextResponse.json({ error: denied.error }, { status: denied.status })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const status = body?.status as WatchStatus

    if (!ALLOWED_STATUSES.includes(status)) {
      return NextResponse.json({ error: '状态值不合法' }, { status: 400 })
    }

    await updateWatchTaskStatus(params.id, status)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[api/admin/watch/tasks/[id] PATCH]', error)
    return NextResponse.json({ error: (error as Error).message || '更新失败' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/watch/tasks/:id —— 软删除（状态置 deleted，可恢复）
 */
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const guard = await checkAdmin()
  const denied = adminErrorResponse(guard)

  if (denied) {
    return NextResponse.json({ error: denied.error }, { status: denied.status })
  }

  try {
    await softDeleteWatchTask(params.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[api/admin/watch/tasks/[id] DELETE]', error)
    return NextResponse.json({ error: (error as Error).message || '删除失败' }, { status: 500 })
  }
}
