import crypto from 'crypto'

/**
 * 微信小程序「消息推送」通用处理：签名校验、密文解密、报文解析。
 *
 * 被 /api/wx/push（消息/事件回调）与 /api/wx/xpay-notify（虚拟支付发货推送）共用。
 * 文档：https://developers.weixin.qq.com/miniprogram/dev/framework/server-ability/message-push.html
 */

// Token：3-32 位英文或数字。默认值需与公众平台「消息推送配置」页填写的 Token 完全一致。
const DEFAULT_TOKEN = 'BeeOfYangjingMsg2026'

export function getMsgToken(): string {
  return process.env.WX_MSG_TOKEN || DEFAULT_TOKEN
}

// ---------- 签名校验 ----------

function sha1(...parts: string[]): string {
  return crypto.createHash('sha1').update(parts.sort().join('')).digest('hex')
}

export function verifyMsgSignature(
  token: string,
  timestamp: string,
  nonce: string,
  signature: string,
  encrypt?: string
): boolean {
  if (!signature) return false
  const expected = encrypt ? sha1(token, timestamp, nonce, encrypt) : sha1(token, timestamp, nonce)
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  } catch {
    return false
  }
}

// ---------- 密文解密（兼容模式 / 安全模式） ----------

export function decryptWxMessage(encryptB64: string, aesKey: string): { message: string; appId: string } | null {
  try {
    // EncodingAESKey 为 43 位，补一个 '=' 后 base64 解码得到 32 字节 AES 密钥
    const key = Buffer.from(aesKey + '=', 'base64')
    if (key.length !== 32) {
      console.error('[wx-msg] EncodingAESKey 非法：解码后不是 32 字节')
      return null
    }
    const cipher = Buffer.from(encryptB64, 'base64')
    // 微信协议：IV = AESKey 的前 16 字节（不是密文前缀！）
    const iv = key.subarray(0, 16)
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
    decipher.setAutoPadding(false)
    const plain = Buffer.concat([decipher.update(cipher), decipher.final()])

    // plain: 16 字节随机串 + 4 字节消息长度(网络序) + 消息体 + receiveid(appid)
    const msgLen = plain.readUInt32BE(16)
    const message = plain.subarray(20, 20 + msgLen).toString('utf8')
    const appId = plain.subarray(20 + msgLen).toString('utf8')
    return { message, appId }
  } catch (err) {
    console.error('[wx-msg] 消息解密失败:', err)
    return null
  }
}

// ---------- 报文解析（JSON / XML 均兼容） ----------

export type WxPushMessage = Record<string, string>

function parseJsonMessage(raw: string): WxPushMessage | null {
  try {
    const obj = JSON.parse(raw)
    if (!obj || typeof obj !== 'object') return null
    const out: WxPushMessage = {}
    for (const [k, v] of Object.entries(obj)) {
      out[k] = typeof v === 'string' ? v : JSON.stringify(v)
    }
    return out
  } catch {
    return null
  }
}

/** 微信 XML 报文多为单层结构，值由 CDATA 包裹，用正则提取即可，无需引入 XML 库 */
function parseXmlMessage(raw: string): WxPushMessage | null {
  const out: WxPushMessage = {}
  const re = /<([A-Za-z][A-Za-z0-9_]*)>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([^<]*))<\/\1>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(raw)) !== null) {
    out[m[1]] = (m[2] ?? m[3] ?? '').trim()
  }
  return Object.keys(out).length > 0 ? out : null
}

export function parseWxPushMessage(raw: string): WxPushMessage | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('{')) return parseJsonMessage(trimmed)
  if (trimmed.startsWith('<')) return parseXmlMessage(trimmed)
  return null
}

// ---------- 嵌套字段提取 ----------
// 发货推送是嵌套结构（WeChatPayInfo.MchOrderNo、GoodsInfo.ProductId），
// 上面的扁平解析拿不到内层节点，这里做一次大小写无关的扁平化。

function flattenObject(obj: unknown, out: Record<string, string>): void {
  if (!obj || typeof obj !== 'object') return
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      flattenObject(v, out)
    } else if (Array.isArray(v)) {
      out[k.toLowerCase()] = v.map(x => String(x)).join(',')
    } else {
      out[k.toLowerCase()] = String(v ?? '')
    }
  }
}

/** 按标签名取值（大小写无关，兼容 CDATA） */
function pickXmlTag(raw: string, tag: string): string {
  const re = new RegExp(`<${tag}>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([^<]*))</${tag}>`, 'i')
  const m = raw.match(re)
  return (m?.[1] ?? m?.[2] ?? '').trim()
}

/** 把 XML 或（已解密的）JSON 报文统一读成一张小写 key 的扁平表 */
export function toFlatFields(raw: string): Record<string, string> {
  const trimmed = raw.trim()
  if (trimmed.startsWith('{')) {
    try {
      const out: Record<string, string> = {}
      flattenObject(JSON.parse(trimmed), out)
      return out
    } catch {
      return {}
    }
  }
  const flat: Record<string, string> = {}
  for (const tag of ['Event', 'OpenId', 'OutTradeNo', 'MchOrderNo', 'ProductId', 'Quantity']) {
    const v = pickXmlTag(raw, tag)
    if (v) flat[tag.toLowerCase()] = v
  }
  return flat
}

// ---------- 虚拟支付发货推送 ----------

export type DeliverNotifyPayload = {
  event: string
  openid: string
  outTradeNo: string
  /** 平台单号（微信内部单号），幂等去重以此为准 */
  wxOrderId: string
  productId: string
  quantity: number
  flat: Record<string, string>
}

export const XPAY_DELIVER_EVENT = 'xpay_goods_deliver_notify'
export const XPAY_REFUND_EVENT = 'xpay_refund_notify'

export function parseDeliverNotify(raw: string): DeliverNotifyPayload | null {
  const flat = toFlatFields(raw)
  const event = flat.event || ''
  if (!event) return null
  const quantity = Number(flat.quantity || '1') || 1
  return {
    event,
    openid: flat.openid || '',
    outTradeNo: flat.outtradeno || '',
    wxOrderId: flat.mchorderno || '',
    productId: flat.productid || '',
    quantity,
    flat,
  }
}

/** 发货推送的标准应答：微信只认 ErrCode=0，否则最多重推 15 次 */
export function xpayNotifyXml(errcode: number, errmsg: string): string {
  return `<xml><ErrCode>${errcode}</ErrCode><ErrMsg><![CDATA[${errmsg}]]></ErrMsg></xml>`
}
