import { NextRequest, NextResponse } from 'next/server'
import { adminErrorResponse, checkAdmin } from '@/lib/admin-guard'
import { resolveAttachmentUrlForAdmin } from '@/lib/watch-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/watch/attachments/:id
 *
 * 后台查看「小蜜蜂盯」附件（图片直接作为 <img src> 使用）。
 * 校验管理员身份后跳过归属判断，重定向到对象存储短时效签名 URL。
 *
 * query：disposition=download 时强制下载。
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const guard = await checkAdmin()
  const denied = adminErrorResponse(guard)

  if (denied) {
    return NextResponse.json({ error: denied.error }, { status: denied.status })
  }

  try {
    const { searchParams } = new URL(request.url)

    const { attachment, url } = await resolveAttachmentUrlForAdmin(
      params.id,
      searchParams.get('disposition') === 'download' ? 'download' : 'inline'
    )

    return NextResponse.redirect(url, {
      status: 307,
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Type': attachment.mime_type,
      },
    })
  } catch (error) {
    console.error('[api/admin/watch/attachments/[id] GET]', error)
    return NextResponse.json({ error: (error as Error).message || '读取附件失败' }, { status: 400 })
  }
}
