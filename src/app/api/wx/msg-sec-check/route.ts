import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/wx/msg-sec-check
 *
 * 小程序文本内容安全检测代理接口。
 * 后端调用微信 `wxa/msg_sec_check` 接口，避免在小程序端暴露 access_token / appsecret。
 *
 * 两个必要条件（缺一不可）：
 *   A. access_token：通过官方 `POST /cgi-bin/stable_token` 获取（普通模式），
 *      必须来自与 openid 相同的 appid。
 *   B. openid：msg_sec_check 请求体必填。
 *
 * 微信要求 msg_sec_check 的请求体必须携带 openid（提交内容的用户 openid），
 * 因此本接口支持两种提供 openid 的方式：
 *   1) 传 `code`（wx.login() 返回值），后端调用 code2Session 换取 openid（推荐）；
 *   2) 直接传 `openid`（客户端换取成功后缓存复用，可减少一次 code2Session 调用）。
 *
 * 请求体：
 * {
 *   "content": string,  // 待检测文本（必填，<= 2500 字）
 *   "scene"?: number,   // 可选：1 资料 2 评论 3 论坛 4 社交日志，默认 1
 *   "code"?: string,    // 可选：wx.login() 返回的登录 code
 *   "openid"?: string,  // 可选：已知 openid（优先于 code 使用）
 * }
 *
 * 响应体（透传并包装微信结果）：
 * {
 *   "success": boolean,
 *   "pass": boolean,           // true 表示通过；false 表示违规
 *   "errcode": number,
 *   "errmsg": string,
 *   "openid"?: string,         // 回传 openid，便于客户端缓存复用
 *   "detail"?: Array<{ strategy?: string; errcode: number; err_msg?: string; suggest?: string; label?: number; prob?: number }>,
 *   "trace_id"?: string,
 * }
 */

// ---------- access_token 缓存 ----------
// 使用官方推荐的「稳定版接口调用凭据」获取 token：
//   POST https://api.weixin.qq.com/cgi-bin/stable_token
//   https://developers.weixin.qq.com/miniprogram/dev/server/API/mp-access-token/api_getstableaccesstoken.html
//
// 为什么不用 GET /cgi-bin/token：
//   旧接口每次调用都会生成新的 access_token 并（在短暂宽限期后）使旧 token 失效。
//   在 Vercel 等多实例 Serverless 环境下，多个实例并发刷新会互相顶掉 token，
//   导致部分请求拿着已失效的 token 调用 msg_sec_check，出现 40001 / 40003 等错误。
//   stable_token 普通模式（force_refresh=false）在有效期内重复调用返回同一个 token，
//   天然适合无中心化存储的多实例部署。
type TokenCacheEntry = { token: string; expireAt: number }
let tokenCache: TokenCacheEntry | null = null

function invalidateAccessToken() {
  tokenCache = null
}

async function getAccessToken(appid: string, secret: string): Promise<string> {
  const now = Date.now()
  if (tokenCache && tokenCache.expireAt > now) {
    return tokenCache.token
  }

  const res = await fetch('https://api.weixin.qq.com/cgi-bin/stable_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credential',
      appid,
      secret,
      force_refresh: false, // 普通模式：有效期内不更新 token
    }),
    cache: 'no-store',
  })

  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string
    expires_in?: number
    errcode?: number
    errmsg?: string
  }

  if (!data.access_token) {
    throw new Error(`获取 access_token 失败: errcode=${data.errcode} errmsg=${data.errmsg}`)
  }

  // 普通模式下 expires_in >= 300（若 token 仍有效会返回剩余有效时间）。
  // stable_token 与 cgi-bin/token 的 token 互相隔离，缓存仅在本模块内复用。
  const ttlSec = Math.max((data.expires_in || 7200) - 300, 60)

  tokenCache = {
    token: data.access_token,
    expireAt: now + ttlSec * 1000,
  }
  return data.access_token
}

// ---------- 调用 msg_sec_check ----------
type WxSecCheckDetail = {
  strategy?: string
  errcode: number
  err_msg?: string
  suggest?: string
  label?: number
  prob?: number
}

async function callMsgSecCheck(
  accessToken: string,
  payload: { content: string; scene: number; openid: string }
): Promise<{
  errcode?: number
  errmsg?: string
  result?: { suggest?: string; label?: number }
  detail?: WxSecCheckDetail[]
  trace_id?: string
}> {
  const checkUrl = `https://api.weixin.qq.com/wxa/msg_sec_check?access_token=${encodeURIComponent(accessToken)}`
  const res = await fetch(checkUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: payload.content,
      version: 2,
      scene: payload.scene,
      openid: payload.openid,
    }),
    cache: 'no-store',
  })
  return (await res.json().catch(() => ({}))) as {
    errcode?: number
    errmsg?: string
    result?: { suggest?: string; label?: number }
    detail?: Array<{ errcode: number; err_msg?: string; suggest?: string; label?: number }>
    trace_id?: string
  }
}

// ---------- openid 换取 ----------
// 用 wx.login() 返回的 code 调用 code2Session 换取 openid
// 注意：code 仅能使用一次，有效期约 5 分钟
async function getOpenidByCode(appid: string, secret: string, code: string): Promise<string> {
  const url =
    `https://api.weixin.qq.com/sns/jscode2session?appid=${encodeURIComponent(appid)}` +
    `&secret=${encodeURIComponent(secret)}&js_code=${encodeURIComponent(code)}` +
    `&grant_type=authorization_code`
  const res = await fetch(url, { method: 'GET', cache: 'no-store' })
  const data = (await res.json().catch(() => ({}))) as {
    openid?: string
    session_key?: string
    unionid?: string
    errcode?: number
    errmsg?: string
  }

  if (!data.openid) {
    throw new Error(`code2Session 失败: errcode=${data.errcode} errmsg=${data.errmsg}`)
  }
  return data.openid
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
    const code: string = (body?.code || '').toString()
    let openid: string = (body?.openid || '').toString()

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

    // 1) 解析 openid（msg_sec_check 必填）
    if (!openid) {
      if (code) {
        try {
          openid = await getOpenidByCode(appid, secret, code)
        } catch (err) {
          console.error('[msg-sec-check] getOpenidByCode error:', err)
          // 换取 openid 失败：fail-open，避免影响正常用户；但日志告警
          return NextResponse.json(
            {
              success: true,
              pass: true,
              errcode: -4,
              errmsg: (err as Error).message || 'code2Session 失败',
              degraded: true,
            },
            { status: 200 }
          )
        }
      } else {
        // 既没有 openid 也没有 code，无法满足微信接口必填项
        console.error('[msg-sec-check] 缺少 openid / code 参数，无法进行内容安全检测')
        return NextResponse.json(
          {
            success: true,
            pass: true,
            errcode: -4,
            errmsg: '缺少 openid/code，无法进行内容安全检测',
            degraded: true,
          },
          { status: 200 }
        )
      }
    }

    // 2) 获取 access_token
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

    // 3) 调用微信内容安全检测（带 openid）
    let wxData = await callMsgSecCheck(accessToken, { content, scene, openid })

    // token 过期/无效（40001 invalid credential、42001 token expired）时，
    // 清空缓存并用 stable_token 重新获取一次后重试（stable_token 普通模式下
    // 连续调用不会顶掉 token，重试是安全的）。
    if (wxData.errcode === 40001 || wxData.errcode === 42001) {
      console.warn('[msg-sec-check] access_token 失效，刷新后重试:', wxData.errcode)
      invalidateAccessToken()
      try {
        accessToken = await getAccessToken(appid, secret)
        wxData = await callMsgSecCheck(accessToken, { content, scene, openid })
      } catch (err) {
        console.error('[msg-sec-check] token 刷新重试失败:', err)
      }
    }

    const errcode = typeof wxData.errcode === 'number' ? wxData.errcode : -1

    // errcode != 0 且 errcode != 87014（内容违规）视为服务端异常，走 fail-open
    if (errcode !== 0 && errcode !== 87014) {
      console.error(
        `[msg-sec-check] wechat api error: errcode=${errcode} errmsg=${wxData.errmsg} appid=${appid} openid=${openid}`
      )
      return NextResponse.json(
        {
          success: true,
          pass: true,
          errcode,
          errmsg: wxData.errmsg || 'wechat api error',
          openid,
          degraded: true,
        },
        { status: 200 }
      )
    }

    // 微信 suggest: 'risky' / 'pass' / 'review'
    // errcode=87014 强制视为不通过
    const suggest = wxData.result?.suggest
    const pass = errcode === 0 && suggest !== 'risky'

    console.log(
      `[msg-sec-check] ok: errcode=${errcode} suggest=${suggest ?? '-'} pass=${pass} scene=${scene} trace_id=${wxData.trace_id ?? '-'}`
    )

    return NextResponse.json(
      {
        success: true,
        pass,
        errcode,
        errmsg: wxData.errmsg || 'ok',
        openid,
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
