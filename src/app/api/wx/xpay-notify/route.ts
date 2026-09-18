import { NextRequest, NextResponse } from 'next/server'
import {
  XPAY_DELIVER_EVENT,
  decryptWxMessage,
  getMsgToken,
  parseDeliverNotify,
  verifyMsgSignature,
  xpayNotifyXml,
} from '@/lib/wx-msg'
import { deliverByNotify } from '@/lib/wx-xpay'

/**
 * POST/GET /api/wx/xpay-notify
 *
 * 虚拟支付「发货推送」接收地址（MP 后台 → 虚拟支付 → 基本配置 → 发货推送地址）。
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

function extractEncrypt(raw: string): string {
  const m = raw.match(/<Encrypt>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([^<]*))<\/Encrypt>/i)
  return (m?.[1] ?? m?.[2] ?? '').trim()
}

/** 接入验证：微信配置回调地址时会发 GET（与消息推送同一套校验算法） */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const signature = sp.get('signature') || ''
  const timestamp = sp.get('timestamp') || ''
  const nonce = sp.get('nonce') || ''
  const echostr = sp.get('echostr') || ''

  if (!echostr) {
    return NextResponse.json({ error: 'missing echostr' }, { status: 400 })
  }
  if (!verifyMsgSignature(getMsgToken(), timestamp, nonce, signature)) {
    console.error('[wx-xpay-notify] GET 接入校验失败: signature 不匹配')
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
    const timestamp = sp.get('timestamp') || ''
    const nonce = sp.get('nonce') || ''
    const msgSignature = sp.get('msg_signature') || ''

    let effectiveRaw = rawBody

    // 1) 兼容/安全模式：先解出明文报文
    let encrypt = extractEncrypt(rawBody)
    if (!encrypt && isJson) {
      try {
        const obj = JSON.parse(rawBody) as { Encrypt?: string }
        encrypt = (obj?.Encrypt || '').toString()
      } catch {
        encrypt = ''
      }
    }

    if (encrypt) {
      const aesKey = process.env.WX_MSG_AES_KEY
      if (!aesKey) {
        console.error('[wx-xpay-notify] 收到加密推送但未配置 WX_MSG_AES_KEY')
        return respond(isJson, ERRCODE_RETRY, 'aes key not configured')
      }
      if (!verifyMsgSignature(getMsgToken(), timestamp, nonce, msgSignature, encrypt)) {
        console.error('[wx-xpay-notify] msg_signature 校验失败')
        return respond(isJson, ERRCODE_RETRY, 'invalid msg_signature')
      }
      const decrypted = decryptWxMessage(encrypt, aesKey)
      if (!decrypted) {
        return respond(isJson, ERRCODE_RETRY, 'decrypt failed')
      }
      effectiveRaw = decrypted.message
      isJson = effectiveRaw.trim().startsWith('{')
    }

    // 2) 只有发货推送需要真发货；其它事件（退款等）记录后直接应答成功
    const notify = parseDeliverNotify(effectiveRaw)
    if (!notify) {
      console.warn('[wx-xpay-notify] 无法解析推送报文，已忽略。body 前 200 字:', effectiveRaw.slice(0, 200))
      return respond(isJson, ERRCODE_SUCCESS, 'success')
    }

    if (notify.event !== XPAY_DELIVER_EVENT) {
      console.warn(`[wx-xpay-notify] 收到非发货事件: ${notify.event}`, JSON.stringify(notify.flat))
      return respond(isJson, ERRCODE_SUCCESS, 'success')
    }

    const result = await deliverByNotify(notify)
    return respond(isJson, result.ok ? ERRCODE_SUCCESS : ERRCODE_RETRY, result.errmsg)
  } catch (error) {
    console.error('[wx-xpay-notify] 处理推送异常:', error)
    return respond(isJson, ERRCODE_RETRY, 'internal error')
  }
}
