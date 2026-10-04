import { NextRequest, NextResponse } from 'next/server'
import { resolveAttachmentUrl } from '@/lib/watch'
import { wxFailure } from '@/lib/wx-response'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/wx/watch/attachments/:id
 *
 * 读取附件本体。两种凭据取一：
 *   1) code + appid：小程序内预览，校验归属（openid + appid 必须匹配）；
 *   2) sig + exp：企微通知里的临时链接，主理人无账号也能看（HMAC-SHA256，默认 7 天）。
 *
 * query：code / appid / sig / exp / disposition(inline|download)
 *
 * 实现说明：校验通过后重定向（307）到对象存储的短时效签名 URL，而不是在本进程内回传字节。
 * 原因有二：
 *   1) Serverless 响应体有体积上限，附件最大 10MB 会被平台截断；
 *   2) 对象存储原生支持 Range，<video> 拖动播放无需本服务参与。
 *
 * 失败：HTTP 400 + { success: false, enabled, errcode, errmsg }
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { searchParams } = new URL(request.url)

    const sig = searchParams.get('sig') || undefined
    const expRaw = searchParams.get('exp')
    const dispositionRaw = searchParams.get('disposition')

    const { attachment, url } = await resolveAttachmentUrl({
      id: params.id,
      query: {
        code: searchParams.get('code') || undefined,
        appid: searchParams.get('appid') || undefined,
        sig,
        exp: expRaw ? Number.parseInt(expRaw, 10) : undefined,
        disposition: dispositionRaw === 'download' ? 'download' : 'inline',
      },
    })

    // 目标 URL 是短时效签名地址，本响应不可被长期缓存，否则客户端会复用已过期的 Location
    return NextResponse.redirect(url, {
      status: 307,
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Type': attachment.mime_type,
      },
    })
  } catch (error) {
    console.error('[api/wx/watch/attachments/[id] GET]', error)
    return NextResponse.json(wxFailure(error, '读取附件失败'), { status: 400 })
  }
}
