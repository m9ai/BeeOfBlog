import { NextRequest, NextResponse } from 'next/server'
import { createWatchTask, listWatchTasks } from '@/lib/watch'
import { wxFailure, wxSuccess } from '@/lib/wx-response'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/wx/watch/tasks
 *
 * 提交「盯」事项。
 * 请求体：{ code, appid?, title(<=40), location(<=100), detail?(<=300), fileKeys?(<=9) }
 * 响应：{ success, enabled, id, taskNo, title, location, detail, status,
 *         createdAt, updatedAt, attachments[], message }
 *
 * 流程：code 换 openid → 文本微信内容安全检测 → 落库（编号冲突自动重试）
 *      → 绑定本人未绑定的附件 → 企微机器人通知主理人。
 * 业务失败（含审核不通过）一律 HTTP 200 + success:false。
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))

    const code: string = (body?.code || '').toString()
    if (!code) {
      return NextResponse.json(
        { success: false, errcode: -1, errmsg: '缺少登录 code' },
        { status: 400 }
      )
    }

    const title: string = (body?.title || '').toString()
    if (!title.trim()) {
      return NextResponse.json(
        { success: false, errcode: -2, errmsg: '缺少事项名称' },
        { status: 400 }
      )
    }

    const location: string = (body?.location || '').toString()
    if (!location.trim()) {
      return NextResponse.json(
        { success: false, errcode: -3, errmsg: '缺少地点' },
        { status: 400 }
      )
    }

    const fileKeys = Array.isArray(body?.fileKeys)
      ? body.fileKeys.map((key: unknown) => (key || '').toString())
      : []

    return NextResponse.json(
      wxSuccess(
        await createWatchTask({
          appid: (body?.appid || '').toString().trim() || undefined,
          code,
          title,
          location,
          detail: (body?.detail || '').toString(),
          fileKeys,
        })
      ),
      { status: 200 }
    )
  } catch (error) {
    console.error('[api/wx/watch/tasks POST]', error)
    return NextResponse.json(wxFailure(error, '提交事项失败'), { status: 200 })
  }
}

/**
 * GET /api/wx/watch/tasks?code=...&appid=...&cursor=...&limit=...
 *
 * 我的盯事项列表（游标分页，按创建时间倒序，最大 50 条/页）。
 * cursor 取上一页最后一条的 createdAt 毫秒。
 * 响应：{ success, enabled, items[], nextCursor }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code') || ''
    const appid = searchParams.get('appid') || ''

    if (!code) {
      return NextResponse.json(
        { success: false, errcode: -1, errmsg: '缺少登录 code' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      wxSuccess(
        await listWatchTasks({
          appid: appid || undefined,
          code,
          cursor: readInt(searchParams, 'cursor'),
          limit: readInt(searchParams, 'limit'),
        })
      ),
      { status: 200 }
    )
  } catch (error) {
    console.error('[api/wx/watch/tasks GET]', error)
    return NextResponse.json(wxFailure(error, '查询事项失败'), { status: 200 })
  }
}

/** 非法 / 缺失的数值参数一律当作「未传」，交给服务端取默认值 */
function readInt(searchParams: URLSearchParams, name: string): number | undefined {
  const raw = searchParams.get(name)

  if (!raw) {
    return undefined
  }

  const parsed = Number.parseInt(raw, 10)

  return Number.isFinite(parsed) ? parsed : undefined
}
