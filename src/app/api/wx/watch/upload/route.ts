import { NextRequest, NextResponse } from 'next/server'
import { uploadWatchAttachment } from '@/lib/watch'
import { wxFailure, wxSuccess } from '@/lib/wx-response'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/wx/watch/upload
 *
 * multipart/form-data 单文件上传。
 * 字段：file（文件，必填）、code（wx.login 凭证，必填）、appid（可选）、
 *      width / height / duration（视频毫秒，可选）。
 *
 * 响应：{ success, enabled, id, fileKey, kind, mimeType, size }
 * 业务失败：HTTP 200 + { success: false, enabled, errcode, errmsg }
 * 参数缺失：HTTP 400 + { success: false, errcode, errmsg }
 *
 * 说明：文件类型按内容（magic bytes）判定，不采信客户端声明的 MIME。
 * 上传后附件处于「未绑定」状态，提交事项时通过 fileKey 挂到事项上。
 */
export async function POST(request: NextRequest) {
  let formData: FormData
  try {
    formData = await request.formData()
  } catch (error) {
    return NextResponse.json(
      { success: false, errcode: -1, errmsg: '请求不是合法的 multipart/form-data' },
      { status: 400 }
    )
  }

  const file = formData.get('file') as (Blob & { name?: string; type?: string }) | null

  if (!file || typeof file.arrayBuffer !== 'function') {
    return NextResponse.json(
      { success: false, errcode: -1, errmsg: '缺少文件字段 file' },
      { status: 400 }
    )
  }

  const code = readField(formData, 'code')

  if (!code) {
    return NextResponse.json(
      { success: false, errcode: -2, errmsg: '缺少登录 code' },
      { status: 400 }
    )
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer())

    return NextResponse.json(
      wxSuccess(
        await uploadWatchAttachment({
          appid: readField(formData, 'appid'),
          code,
          bytes,
          declaredType: file.type || '',
          width: readNumber(formData, 'width'),
          height: readNumber(formData, 'height'),
          durationMs: readNumber(formData, 'duration'),
        })
      ),
      { status: 200 }
    )
  } catch (error) {
    console.error('[api/wx/watch/upload POST]', error)
    return NextResponse.json(wxFailure(error, '附件上传失败'), { status: 200 })
  }
}

/** multipart 字段统一按字符串读取 */
function readField(formData: FormData, name: string): string | undefined {
  const value = formData.get(name)

  if (typeof value === 'string' && value.trim()) {
    return value.trim()
  }

  return undefined
}

function readNumber(formData: FormData, name: string): number | undefined {
  const raw = readField(formData, name)

  if (!raw) {
    return undefined
  }

  const parsed = Number.parseInt(raw, 10)

  return Number.isFinite(parsed) ? parsed : undefined
}
