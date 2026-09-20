import { NextRequest, NextResponse } from 'next/server'
import {
  code2Session,
  getAccessToken,
  invalidateAccessToken,
  resolveWxCredential,
  type WxCredential,
} from '@/lib/wx-apps'

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
 *   "appid"?: string,   // 可选：调用方小程序 appid（多小程序共用本接口时必传，
 *                       //        用于选择对应的 code2Session / stable_token 凭证）
 *   "code"?: string,    // 可选：wx.login() 返回的登录 code
 *   "openid"?: string,  // 可选：已知 openid（优先于 code 使用）
 * }
 *
 * 响应体（透传并包装微信结果）：
 * {
 *   "success": boolean,
 *   "pass": boolean,           // true 表示通过；false 表示需拦截（见下方「拦截策略」）
 *   "errcode": number,
 *   "errmsg": string,          // 拦截时为用户可读提示语
 *   "suggest"?: string,        // 微信判定：'pass' / 'risky' / 'review'
 *   "openid"?: string,         // 回传 openid，便于客户端缓存复用
 *   "detail"?: Array<{ strategy?: string; errcode: number; err_msg?: string; suggest?: string; label?: number; prob?: number }>,
 *   "trace_id"?: string,
 * }
 *
 * 拦截策略（收紧）：
 *   本接口生成的内容可被用户分享出去，因此对「疑似违规」也拦截：
 *   - errcode = 87014      → 拦截
 *   - suggest = 'risky'    → 拦截
 *   - suggest = 'review'   → 拦截（需人工复核，不放行）
 *   仅 suggest = 'pass' 视为通过。
 *
 * 降级策略（fail-open，有意为之）：
 *   token 获取失败、code2Session 失败、微信接口异常、网络超时等情况下，
 *   统一返回 pass=true + degraded=true，不阻断用户。
 *   理由：本业务的产物（如电子手牌）由用户自行分享给熟人，并非公开广场，
 *   外流面可控；若改为 fail-closed，微信侧抖动会直接导致用户无法生成内容。
 *   降级事件均会打 error/warn 日志（含 errcode），可据此监控漏放情况。
 */

// ---------- 多小程序凭证解析 ----------
// 本接口同时服务多个小程序（如「金铁班次助手」「洋泾小蜜蜂」「健康笔记」）。
// code2Session 的 code 只能由签发它的同一 appid 换取 openid，因此必须
// 按请求方的小程序选择对应凭证。
//
// 凭证解析（resolveWxCredential）与 access_token 缓存已下沉到共享模块
// @/lib/wx-apps，与虚拟支付（wx-xpay）共用——同一 appid 的 token 只取一份。
// 凭证来源与回退规则详见 wx-apps.ts 头部注释：
//   WX_SECRET_<appid>（推荐） / WX_APPS JSON 表 / WX_APPID + WX_SECRET（默认小程序回退）。
//
// 客户端请求体携带 `appid`（公开信息，可从 wx.getAccountInfoSync() 获取），
// secret 永远只存在服务端环境变量中。

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
// 用 wx.login() 返回的 code 调用 code2Session（共享模块 wx-apps）换取 openid。
// 注意：code 仅能使用一次，有效期约 5 分钟。

// ---------- 主路由 ----------

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const content: string = (body?.content || '').toString()
    const scene: number = Number.isFinite(body?.scene) ? Number(body.scene) : 1
    const code: string = (body?.code || '').toString()
    let openid: string = (body?.openid || '').toString()
    // 可选：调用方小程序的 appid（wx.getAccountInfoSync().miniProgram.appId）。
    // 多小程序共用本接口时必传，用于选择对应的 code2Session / stable_token 凭证。
    const requestAppid: string = (body?.appid || '').toString().trim()

    let cred: WxCredential
    try {
      cred = resolveWxCredential(requestAppid)
    } catch (err) {
      console.error('[msg-sec-check] resolveWxCredential error:', err)
      return NextResponse.json(
        { success: false, errcode: -1, errmsg: (err as Error).message },
        { status: 500 }
      )
    }
    const { appid, secret } = cred

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
          openid = (await code2Session(appid, secret, code)).openid
        } catch (err) {
          console.error('[msg-sec-check] code2Session error:', err)
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
      invalidateAccessToken(appid)
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

    // 微信 suggest: 'risky'（确定违规）/ 'review'（疑似违规，需人工复核）/ 'pass'
    //
    // 判定为「不通过」的情况：
    //   - errcode = 87014：微信直接判定内容违规
    //   - suggest = 'risky'：命中违规模型
    //   - suggest = 'review'：疑似违规。本业务生成的内容可被用户分享出去，
    //     故对 review 也采取拦截策略（收紧策略，避免疑似违规内容外流）。
    const suggest = wxData.result?.suggest
    const blocked = errcode === 87014 || suggest === 'risky' || suggest === 'review'
    const pass = !blocked

    if (blocked) {
      console.warn(
        `[msg-sec-check] blocked: errcode=${errcode} suggest=${suggest ?? '-'} label=${wxData.result?.label ?? '-'} trace_id=${wxData.trace_id ?? '-'}`
      )
    } else {
      console.log(
        `[msg-sec-check] ok: errcode=${errcode} suggest=${suggest ?? '-'} pass=${pass} scene=${scene} trace_id=${wxData.trace_id ?? '-'}`
      )
    }

    // 拦截时给出用户可读的提示（微信 errcode=0 时 errmsg 为 'ok'，不能直接透传给用户）
    let errmsg = wxData.errmsg || 'ok'
    if (blocked) {
      if (wxData.errmsg && wxData.errmsg !== 'ok') {
        errmsg = wxData.errmsg
      } else if (suggest === 'review') {
        errmsg = '您输入的内容需人工复核，请修改后再试'
      } else {
        errmsg = '您输入的内容涉嫌违规，请修改后再试'
      }
    }

    return NextResponse.json(
      {
        success: true,
        pass,
        errcode,
        errmsg,
        suggest,
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
