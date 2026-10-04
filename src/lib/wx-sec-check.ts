/**
 * 微信小程序文本内容安全检测（wxa/msg_sec_check）共享模块
 *
 * 被许愿池（wx-wish）与「小蜜蜂盯」（watch）共用：两者都需要提交前过一遍微信审核，
 * 只是文本长度上限与提示语不同，判定/降级策略必须保持一致，故下沉到这里。
 *
 * 拦截策略（收紧）：
 *   - errcode = 87014      → 拦截
 *   - suggest = 'risky'    → 拦截
 *   - suggest = 'review'   → 拦截（疑似违规需人工复核，不放行）
 *
 * 降级策略（fail-open，有意为之）：
 *   access_token 获取失败 / 微信接口异常时返回 pass=true + degraded=true，
 *   不阻断正常用户，但会打 warn 日志便于监控漏放。
 */

import { getAccessToken } from './wx-apps'

export type SecCheckAuth = {
  appid: string
  secret: string
  openid: string
}

export type SecCheckResult = {
  pass: boolean
  errmsg?: string
  /** true 表示微信侧不可用、已降级放行 */
  degraded?: boolean
}

type WxSecCheckResponse = {
  errcode?: number
  errmsg?: string
  result?: { suggest?: string; label?: number }
  trace_id?: string
}

async function callMsgSecCheck(
  accessToken: string,
  content: string,
  openid: string
): Promise<WxSecCheckResponse> {
  const url = `https://api.weixin.qq.com/wxa/msg_sec_check?access_token=${encodeURIComponent(accessToken)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, version: 2, scene: 1, openid }),
    cache: 'no-store',
  })
  return (await res.json().catch(() => ({}))) as WxSecCheckResponse
}

/**
 * 通用文本内容安全检测。
 *
 * @param content  待检测文本（调用方负责拼接）
 * @param auth     已换到 openid 的身份上下文
 * @param maxLength 文本长度上限，超过直接判定不通过（微信接口本身也有上限）
 * @param label    日志标签，便于区分业务来源
 */
export async function checkTextContent(
  content: string,
  auth: SecCheckAuth,
  maxLength: number,
  label = '文本'
): Promise<SecCheckResult> {
  if (!content || !content.trim()) {
    return { pass: false, errmsg: `${label}不能为空` }
  }
  if (content.length > maxLength) {
    return { pass: false, errmsg: `${label}不能超过 ${maxLength} 字` }
  }

  let accessToken: string
  try {
    accessToken = await getAccessToken(auth.appid, auth.secret)
  } catch (err) {
    console.warn(`[sec-check:${label}] access_token 获取失败，降级放行:`, err)
    return { pass: true, degraded: true }
  }

  let wxData: WxSecCheckResponse
  try {
    wxData = await callMsgSecCheck(accessToken, content, auth.openid)
  } catch (err) {
    console.warn(`[sec-check:${label}] 微信接口异常，降级放行:`, err)
    return { pass: true, degraded: true }
  }

  const errcode = typeof wxData.errcode === 'number' ? wxData.errcode : -1
  const suggest = wxData.result?.suggest
  const blocked = errcode === 87014 || suggest === 'risky' || suggest === 'review'

  if (errcode !== 0 && errcode !== 87014) {
    // 其他微信服务端异常，降级放行
    console.warn(
      `[sec-check:${label}] wechat api error，降级放行: errcode=${errcode} errmsg=${wxData.errmsg}`
    )
    return { pass: true, degraded: true }
  }

  if (blocked) {
    console.warn(
      `[sec-check:${label}] blocked: errcode=${errcode} suggest=${suggest ?? '-'} trace_id=${wxData.trace_id ?? '-'}`
    )
    let errmsg = '您输入的内容涉嫌违规，请修改后再试'
    if (suggest === 'review') errmsg = '您输入的内容需人工复核，请修改后再试'
    if (wxData.errmsg && wxData.errmsg !== 'ok') errmsg = wxData.errmsg
    return { pass: false, errmsg }
  }

  return { pass: true }
}
