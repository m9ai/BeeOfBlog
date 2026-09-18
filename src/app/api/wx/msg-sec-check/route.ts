import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/wx/msg-sec-check
 *
 * 小程序文本内容安全检测代理接口。
 * 后端调用微信 `wxa/msg_sec_check` 接口，避免在小程序端暴露 access_token / appsecret。
 *
 * 请求体：
 * {
 *   "content": string,  // 待检测文本（必填，<= 2500 字）
 *   "scene"?: number,   // 可选：1 资料 2 评论 3 论坛 4 社交日志，默认 1
 * }
 *
 * 响应体（透传并包装微信结果）：
 * {
 *   "success": boolean,
 *   "pass": boolean,           // true 表示通过；false 表示违规
 *   "errcode": number,
 *   "errmsg": string,
 *   "detail"?: Array<{ errcode: number; err_msg?: string; suggest?: string; label?: number }>,
 *   "trace_id"?: string,
 * }
 */

// ---------- access_token 缓存 ----------
// access_token 有效期 7200 秒，提前 300 秒刷新；Vercel 实例复用时复用 token
type TokenCacheEntry = { token: string; expireAt: number }
let tokenCache: TokenCacheEntry | null = null

async function getAccessToken(appid: string, secret: string): Promise<string> {
  const now = Date.now()
  if (tokenCache && tokenCache.expireAt > now) {
    return tokenCache.token
  }

  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(appid)}&secret=${encodeURIComponent(secret)}`
  const res = await fetch(url, { method: 'GET', cache: 'no-store' })
  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string
    expires_in?: number
    errcode?: number
    errmsg?: string
  }

  if (!data.access_token) {
    const errMsg = `获取 access_token 失败: errcode=${data.errcode} errmsg=${data.errmsg}`
    throw new Error(errMsg)
  }

  const ttl = (data.expires_in || 7200) * 1000
  tokenCache = {
    token: data.access_token,
    expireAt: now + ttl - 5 * 60 * 1000, // 提前 5 分钟刷新
  }
  return data.access_token
}

// ---------- 主路由 ----------

export async function POST(request: NextRequest) {
  try {
    const appid = process.env.WX_APPID
    const secret = process.env.WX_SECRET

    if (!appid || !secret) {
      console.error('[msg-sec-check] 缺少环境变量 WX_APPID 或 WX_SECRET')
      return NextResponse.json(
        { success: false, errcode: -1, errmsg: '服务端未配置微信凭证' },
        { status: 500 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const content: string = (body?.content || '').toString()
    const scene: number = Number.isFinite(body?.scene) ? Number(body.scene) : 1

    if (!content || !content.trim()) {
      return NextResponse.json(
        { success: true, pass: true, errcode: 0, errmsg: 'ok', detail: [] },
        { status: 200 }
      )
    }

    if (content.length > 2500) {
      return NextResponse.json(
        { success: false, errcode: -2, errmsg: 'content 长度超过 2500' },
        { status: 400 }
      )
    }

    // 1) 获取 access_token
    let accessToken: string
    try {
      accessToken = await getAccessToken(appid, secret)
    } catch (err) {
      console.error('[msg-sec-check] getAccessToken error:', err)
      // 凭证失效：fail-open，避免影响正常用户；但日志告警
      return NextResponse.json(
        {
          success: true,
          pass: true,
          errcode: -3,
          errmsg: (err as Error).message || 'access_token 获取失败',
          degraded: true,
        },
        { status: 200 }
      )
    }

    // 2) 调用微信内容安全检测
    const checkUrl = `https://api.weixin.qq.com/wxa/msg_sec_check?access_token=${encodeURIComponent(accessToken)}`
    const wxRes = await fetch(checkUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        version: 2,
        scene,
      }),
      cache: 'no-store',
    })

    const wxData = (await wxRes.json().catch(() => ({}))) as {
      errcode?: number
      errmsg?: string
      result?: { suggest?: string; label?: number }
      detail?: Array<{ errcode: number; err_msg?: string; suggest?: string; label?: number }>
      trace_id?: string
    }

    const errcode = typeof wxData.errcode === 'number' ? wxData.errcode : -1

    // errcode != 0 且 errcode != 87014（内容违规）视为服务端异常，走 fail-open
    if (errcode !== 0 && errcode !== 87014) {
      console.error('[msg-sec-check] wechat api error:', wxData)
      return NextResponse.json(
        {
          success: true,
          pass: true,
          errcode,
          errmsg: wxData.errmsg || 'wechat api error',
          degraded: true,
        },
        { status: 200 }
      )
    }

    // 微信 suggest: 'risky' / 'pass' / 'review'
    // errcode=87014 强制视为不通过
    const suggest = wxData.result?.suggest
    const pass = errcode === 0 && suggest !== 'risky'

    return NextResponse.json(
      {
        success: true,
        pass,
        errcode,
        errmsg: wxData.errmsg || 'ok',
        detail: wxData.detail,
        trace_id: wxData.trace_id,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('[msg-sec-check] unexpected error:', error)
    return NextResponse.json(
      {
        success: true,
        pass: true,
        errcode: -99,
        errmsg: (error as Error).message || 'unexpected error',
        degraded: true,
      },
      { status: 200 }
    )
  }
}

// 仅允许 POST
export async function GET() {
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 })
}