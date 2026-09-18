import { NextRequest, NextResponse } from 'next/server'
import {
  XPAY_DELIVER_EVENT,
  XPAY_REFUND_EVENT,
  decryptWxMessage,
  getMsgToken,
  parseDeliverNotify,
  parseWxPushMessage,
  verifyMsgSignature,
  xpayNotifyXml,
  type WxPushMessage,
} from '@/lib/wx-msg'
import { deliverByNotify } from '@/lib/wx-xpay'

/**
 * POST/GET /api/wx/push
 *
 * 小程序「消息推送」服务器接口（微信开放平台 → 开发管理 → 消息推送配置）。
 * 文档：https://developers.weixin.qq.com/miniprogram/dev/framework/server-ability/message-push.html
 *
 * ## 配置项对应关系（微信公众平台消息推送配置页）
 *   URL(服务器地址)      → https://yangjing.m9ai.work/api/wx/push
 *   Token(令牌)          → 环境变量 WX_MSG_TOKEN（未配置时使用 lib/wx-msg 的默认值）
 *   EncodingAESKey       → 页面上「随机生成」即可；若使用「兼容模式/安全模式」，
 *                          必须把同一个 key 配置到环境变量 WX_MSG_AES_KEY
 *   消息加密方式          → 建议明文模式；兼容/安全模式已支持（自动解密）
 *   数据格式              → 建议 JSON；XML 也已兼容
 *
 * ## 微信接入验证（GET）
 *   微信服务器提交 signature / timestamp / nonce / echostr，
 *   校验算法：将 token、timestamp、nonce 三个参数字典序排序后拼接，
 *   计算 sha1 与 signature 比对；通过则原样返回 echostr（纯文本）。
 *
 * ## 消息/事件推送（POST）
 *   - 5 秒内必须应答，否则微信会重试（最多 3 次）。
 *   - 普通消息/事件：统一返回字符串 "success" 表示「已收到、无需回复」。
 *   - 虚拟支付发货推送（Event = xpay_goods_deliver_notify）：必须完成发货并返回
 *     `<xml><ErrCode>0</ErrCode>...</xml>`，故此处按事件分流（见下方 handleVirtualPaymentEvent）。
 */

// ---------- 主路由 ----------

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
    console.error('[wx-push] GET 接入校验失败: signature 不匹配')
    return new NextResponse('fail', { status: 403 })
  }

  // 必须原样返回 echostr 纯文本，微信不认 JSON
  return new NextResponse(echostr, {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

export async function POST(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const timestamp = sp.get('timestamp') || ''
    const nonce = sp.get('nonce') || ''
    const msgSignature = sp.get('msg_signature') || ''

    const rawBody = await request.text()

    // 1) 解析最外层报文，判断是否为密文
    const outer = parseWxPushMessage(rawBody)
    if (!outer) {
      console.warn('[wx-push] 无法解析推送报文，已忽略。body 前 200 字:', rawBody.slice(0, 200))
      return new NextResponse('success')
    }

    let payload: WxPushMessage = outer
    // 参与业务判断的「有效报文原文」：明文模式就是 body，密文模式是解密后的明文
    let effectiveRaw = rawBody

    // 2) 密文模式（兼容/安全模式）：JSON 报文 Encrypt 字段，或 XML <Encrypt> 节点
    const encrypt = outer.Encrypt
    if (encrypt) {
      const aesKey = process.env.WX_MSG_AES_KEY
      if (!aesKey) {
        console.error('[wx-push] 收到加密消息但未配置 WX_MSG_AES_KEY，无法解密')
        return new NextResponse('success')
      }
      if (!verifyMsgSignature(getMsgToken(), timestamp, nonce, msgSignature, encrypt)) {
        console.error('[wx-push] POST msg_signature 校验失败')
        return new NextResponse('success')
      }
      const decrypted = decryptWxMessage(encrypt, aesKey)
      if (!decrypted) {
        return new NextResponse('success')
      }
      const inner = parseWxPushMessage(decrypted.message)
      if (!inner) {
        console.warn('[wx-push] 解密后的报文无法解析:', decrypted.message.slice(0, 200))
        return new NextResponse('success')
      }
      payload = inner
      effectiveRaw = decrypted.message
    }

    const event = payload.Event || ''

    // 3) 虚拟支付发货推送：必须发货 + 返回 ErrCode=0，否则平台会重推（最多 15 次）
    if (event === XPAY_DELIVER_EVENT) {
      return handleDeliverEvent(effectiveRaw)
    }

    if (event === XPAY_REFUND_EVENT) {
      // 退款推送：本业务仅有一个 1 元道具，退款由 MP 后台发起，这里只做记录便于对账
      console.warn('[wx-push] 收到退款推送:', JSON.stringify(payload))
      return new NextResponse('success')
    }

    // 4) 其它消息仅记录日志（订阅消息等事件回调也从这里进入，可在 Vercel Logs 中检索 [wx-push]）
    console.log(
      `[wx-push] msg: type=${payload.MsgType || '-'}${event ? ` event=${event}` : ''} from=${
        payload.FromUserName || '-'
      } to=${payload.ToUserName || '-'}`,
      JSON.stringify(payload)
    )

    return new NextResponse('success', {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  } catch (error) {
    // 任何异常都不能抛 5xx，否则微信会反复重试推送
    console.error('[wx-push] 处理推送消息异常:', error)
    return new NextResponse('success')
  }
}

/** 发货推送：解析字段（含嵌套节点）→ 幂等发货 → 返回 XML 应答 */
async function handleDeliverEvent(raw: string): Promise<NextResponse> {
  const notify = parseDeliverNotify(raw)
  if (!notify) {
    console.error('[wx-push] 发货推送报文无法解析:', raw.slice(0, 200))
    // 返回非 0，让平台重推，避免漏记用户已支付的助力
    return new NextResponse(xpayNotifyXml(-1, 'unparsable deliver notify'), {
      status: 200,
      headers: { 'Content-Type': 'application/xml; charset=utf-8' },
    })
  }

  const result = await deliverByNotify(notify)
  return new NextResponse(xpayNotifyXml(result.ok ? 0 : -1, result.errmsg), {
    status: 200,
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  })
}
