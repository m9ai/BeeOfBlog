import { NextRequest, NextResponse } from 'next/server'
import { getWatchTask } from '@/lib/watch'
import { wxFailure, wxSuccess } from '@/lib/wx-response'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/wx/watch/tasks/:id?code=...&appid=...
 *
 * 盯事项详情（含附件列表）。只能查看本人提交的事项，
 * 非本人 / 已删除一律返回 success:false。
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
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
        await getWatchTask({
          appid: appid || undefined,
          code,
          id: params.id,
        })
      ),
      { status: 200 }
    )
  } catch (error) {
    console.error('[api/wx/watch/tasks/[id] GET]', error)
    return NextResponse.json(wxFailure(error, '查询事项失败'), { status: 200 })
  }
}
