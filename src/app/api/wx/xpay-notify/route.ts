import { NextRequest, NextResponse } from 'next/server'
import {
  XPAY_DELIVER_EVENT,
  getMsgTokenFor,
  parseDeliverNotify,
  verifyAndDecryptPush,
  verifyMsgSignature,
  xpayNotifyXml,
} from '@/lib/wx-msg'
import { deliverByNotify } from '@/lib/wx-xpay'

/**
 * POST/GET /api/wx/xpay-notify
 *
 * 虚拟支付「发货推送」接收地址（MP 后台 → 虚拟支付 → 基本配置 → 发货推送地址）。
 *
 * ## 多租户
 *   每个小程序的推送用各自的 Token / EncodingAESKey 签名加密，环境变量按 appid 区分：
 *     WX_MSG_TOKEN_<appid>   该小程序的推送 Token
 *     WX_MSG_AES_KEY_<appid> 该小程序的 EncodingAESKey（密文模式必需）
 *   - POST：验签时按报文 ToUserName 指向的租户优先、其余租户遍历匹配
 *     （错误 Token 必然验签失败，遍历安全；见 wx-msg.ts verifyAndDecryptPush）。
 *   - GET（接入验证）：报文不带 appid，各小程序回调地址需带 query 参数区分：
 *       https://yangjing.m9ai.work/api/wx/xpay-notify?appid=wxc9edff70eb75f100
 *     不带 appid 的地址默认金铁（兼容存量配置）。
 *
 * 与 /api/wx/push 的关系：
 *   若后台把虚拟支付推送也配到「消息推送」地址，事件会走 /api/wx/push，
 *   那条链路同样识别 xpay_goods_deliver_notify 并返回 ErrCode=0；
 *   本地址用于「虚拟支付里单独填写回调地址」的配置方式，两者能力等价、处理逻辑共用。
 *
 * 应答规则（决定平台是否重推，最多 15 次）：
 *   XML 推送 → <xml><ErrCode>0</ErrCode><ErrMsg><![CDATA[success]]></ErrMsg></xml>
 *   JSON 推送 → {"ErrCode":0,"ErrMsg":"success"}
 *   发货失败必须返回非 0，让平台重推，避免用户付了钱、助力没记上。
 */

const ERRCODE_SUCCESS = 0
const ERRCODE_RETRY = -1

function respond(isJson: boolean, errcode: number, errmsg: string): NextResponse {
  if (isJson) {
    return NextResponse.json({ ErrCode: errcode, ErrMsg: errmsg })
  }
  return new NextResponse(xpayNotifyXml(errcode, errmsg), {
    status: 200,
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  })
}

/** 接入验证：微信配置回调地址时会发 GET（与消息推送同一套校验算法）。
 *  多租户：query 参数 appid 指定验签用哪个小程序的 Token；缺省为默认小程序（金铁）。 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const signature = sp.get('signature') || ''
  const timestamp = sp.get('timestamp') || ''
  const nonce = sp.get('nonce') || ''
  const echostr = sp.get('echostr') || ''
  const appid = sp.get('appid') || ''

  if (!echostr) {
    return NextResponse.json({ error: 'missing echostr' }, { status: 400 })
  }
  const token = getMsgTokenFor(appid)
  if (!token || !verifyMsgSignature(token, timestamp, nonce, signature)) {
    console.error(
      `[wx-xpay-notify] GET 接入校验失败 appid=${appid || '(默认)'}：Token 不匹配（未配置 WX_MSG_TOKEN_${appid || '<appid>'}？）`
    )
    return new NextResponse('fail', { status: 403 })
  }
  return new NextResponse(echostr, {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  // 应答格式跟随推送格式：JSON 推送回 JSON，XML 推送回 XML
  let isJson = rawBody.trim().startsWith('{')

  try {
    const sp = request.nextUrl.searchParams
    // 多租户统一验签/解密：ToUserName 指向的租户优先，其余租户遍历匹配
    const verified = await verifyAndDecryptPush({
      rawBody,
      timestamp: sp.get('timestamp') || '',
      nonce: sp.get('nonce') || '',
      signature: sp.get('signature') || '',
      msgSignature: sp.get('msg_signature') || '',
    })
    if (!verified) {
      console.error('[wx-xpay-notify] 推送验签失败：所有已配置小程序的 Token 均不匹配')
      return respond(isJson, ERRCODE_RETRY, 'invalid signature')
    }

    const effectiveRaw = verified.effectiveRaw
    isJson = effectiveRaw.trim().startsWith('{')

    // 只有发货推送需要真发货；其它事件（退款等）记录后直接应答成功
    const notify = parseDeliverNotify(effectiveRaw)
    if (!notify) {
      console.warn('[wx-xpay-notify] 无法解析推送报文，已忽略。body 前 200 字:', effectiveRaw.slice(0, 200))
      return respond(isJson, ERRCODE_SUCCESS, 'success')
    }

    if (notify.event !== XPAY_DELIVER_EVENT) {
      console.warn(
        `[wx-xpay-notify] 收到非发货事件 appid=${notify.appid || verified.tenant.appid} event=${notify.event}`,
        JSON.stringify(notify.flat)
      )
      return respond(isJson, ERRCODE_SUCCESS, 'success')
    }

    // 发货处理按报文 appid（ToUserName）路由租户，兜底验签命中的租户
    if (!notify.appid) notify.appid = verified.tenant.appid
    const result = await deliverByNotify(notify)
    return respond(isJson, result.ok ? ERRCODE_SUCCESS : ERRCODE_RETRY, result.errmsg)
  } catch (error) {
    console.error('[wx-xpay-notify] 处理推送异常:', error)
    return respond(isJson, ERRCODE_RETRY, 'internal error')
  }
}
