import { NextRequest, NextResponse } from 'next/server'
import {
  XPAY_DELIVER_EVENT,
  XPAY_REFUND_EVENT,
  getMsgTokenFor,
  parseDeliverNotify,
  parseWxPushMessage,
  verifyAndDecryptPush,
  verifyMsgSignature,
  xpayNotifyXml,
} from '@/lib/wx-msg'
import { deliverByNotify } from '@/lib/wx-xpay'

/**
 * POST/GET /api/wx/push
 *
 * 小程序「消息推送」服务器接口（微信开放平台 → 开发管理 → 消息推送配置）。
 * 文档：https://developers.weixin.qq.com/miniprogram/dev/framework/server-ability/message-push.html
 *
 * ## 多租户
 *   本服务端同时服务多款小程序（金铁班次助手 / 洋泾小蜜蜂 / 健康笔记），
 *   每个小程序在各自 MP 后台配置消息推送，Token / EncodingAESKey 各不相同，
 *   服务端用扁平环境变量区分：
 *     WX_MSG_TOKEN_<appid>    该小程序的推送 Token
 *     WX_MSG_AES_KEY_<appid>  该小程序的 EncodingAESKey（密文模式必需）
 *   默认小程序（金铁）兼容旧的无后缀变量 WX_MSG_TOKEN / WX_MSG_AES_KEY。
 *
 * ## 配置项对应关系（各小程序的公众平台消息推送配置页）
 *   URL(服务器地址)      → https://yangjing.m9ai.work/api/wx/push?appid=<你的appid>
 *                          （不带 appid 参数的地址默认金铁，兼容存量配置）
 *   Token(令牌)          → 对应小程序的环境变量 WX_MSG_TOKEN_<appid>
 *   EncodingAESKey       → 页面上「随机生成」；密文模式下必须配到 WX_MSG_AES_KEY_<appid>
 *   消息加密方式          → 明文模式已支持验签；兼容/安全模式自动按租户解密
 *   数据格式              → JSON / XML 均已兼容
 *
 * ## 微信接入验证（GET）
 *   微信服务器提交 signature / timestamp / nonce / echostr，
 *   校验算法：将 token、timestamp、nonce 三个参数字典序排序后拼接，
 *   计算 sha1 与 signature 比对；通过则原样返回 echostr（纯文本）。
 *
 * ## 消息/事件推送（POST）
 *   - 5 秒内必须应答，否则微信会重试（最多 3 次）。
 *   - 验签按报文 ToUserName（接收方 appid）路由租户，ToUserName 缺失时遍历
 *     已配置租户匹配（错误 Token 必然验签失败，遍历安全）。
 *   - 普通消息/事件：统一返回字符串 "success" 表示「已收到、无需回复」。
 *   - 虚拟支付发货推送（Event = xpay_goods_deliver_notify）：必须完成发货并返回
 *     `<xml><ErrCode>0</ErrCode>...</xml>`，故此处按事件分流（见下方 handleDeliverEvent）。
 */

// ---------- 主路由 ----------

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const signature = sp.get('signature') || ''
  const timestamp = sp.get('timestamp') || ''
  const nonce = sp.get('nonce') || ''
  const echostr = sp.get('echostr') || ''
  // 多租户：各小程序的回调地址带 ?appid=<appid> 区分验签 Token
  const appid = sp.get('appid') || ''

  if (!echostr) {
    return NextResponse.json({ error: 'missing echostr' }, { status: 400 })
  }

  const token = getMsgTokenFor(appid)
  if (!token || !verifyMsgSignature(token, timestamp, nonce, signature)) {
    console.error(
      `[wx-push] GET 接入校验失败 appid=${appid || '(默认)'}：Token 不匹配（未配置 WX_MSG_TOKEN_${appid || '<appid>'}？）`
    )
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
    const rawBody = await request.text()

    // 1) 多租户统一验签/解密：明文模式校验 signature（按 ToUserName 路由租户），
    //    密文模式校验 msg_signature 并用对应租户的 EncodingAESKey 解密
    const verified = await verifyAndDecryptPush({
      rawBody,
      timestamp: sp.get('timestamp') || '',
      nonce: sp.get('nonce') || '',
      signature: sp.get('signature') || '',
      msgSignature: sp.get('msg_signature') || '',
    })
    if (!verified) {
      // 验签失败：应答 success 防止微信无限重试无意义请求，日志已告警
      return new NextResponse('success')
    }

    const effectiveRaw = verified.effectiveRaw

    // 2) 解析报文（明文模式即 body；密文模式为解密后的明文）
    const payload = parseWxPushMessage(effectiveRaw)
    if (!payload) {
      console.warn('[wx-push] 无法解析推送报文，已忽略。body 前 200 字:', effectiveRaw.slice(0, 200))
      return new NextResponse('success')
    }

    const event = payload.Event || ''

    // 3) 虚拟支付发货推送：必须发货 + 返回 ErrCode=0，否则平台会重推（最多 15 次）
    if (event === XPAY_DELIVER_EVENT) {
      return handleDeliverEvent(effectiveRaw)
    }

    if (event === XPAY_REFUND_EVENT) {
      // 退款推送：退款由各小程序 MP 后台发起，这里只做记录便于对账
      console.warn(
        `[wx-push] 收到退款推送 appid=${payload.ToUserName || verified.tenant.appid}:`,
        JSON.stringify(payload)
      )
      return new NextResponse('success')
    }

    // 4) 其它消息仅记录日志（订阅消息等事件回调也从这里进入，可在 Vercel Logs 中检索 [wx-push]）
    console.log(
      `[wx-push] msg: app=${payload.ToUserName || verified.tenant.appid} type=${payload.MsgType || '-'}${
        event ? ` event=${event}` : ''
      } from=${payload.FromUserName || '-'} to=${payload.ToUserName || '-'}`,
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

/** 发货推送：解析字段（含嵌套节点与接收方 appid）→ 幂等发货 → 返回 XML 应答 */
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
