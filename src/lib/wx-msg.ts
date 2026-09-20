import crypto from 'crypto'
import {
  appDisplayName,
  findFlatEnv,
  getDefaultAppid,
  listAppidsByEnvBase,
} from './wx-apps'

/**
 * 微信小程序「消息推送」通用处理：签名校验、密文解密、报文解析。
 *
 * 被 /api/wx/push（消息/事件回调）与 /api/wx/xpay-notify（虚拟支付发货推送）共用。
 * 文档：https://developers.weixin.qq.com/miniprogram/dev/framework/server-ability/message-push.html
 *
 * 多租户：每个小程序在 MP 后台各自配置消息推送（Token / EncodingAESKey 各不相同），
 * 服务端用扁平环境变量区分：
 *   WX_MSG_TOKEN_<appid>    该小程序的推送 Token
 *   WX_MSG_AES_KEY_<appid>  该小程序的 EncodingAESKey（密文模式必需）
 * 默认小程序（金铁）兼容旧的无后缀变量 WX_MSG_TOKEN / WX_MSG_AES_KEY。
 */

// Token：3-32 位英文或数字。默认值需与公众平台「消息推送配置」页填写的 Token 完全一致。
const DEFAULT_TOKEN = 'BeeOfYangjingMsg2026'

/**
 * 按 appid 取推送 Token。
 * - appid 缺省 / 等于默认小程序 → WX_MSG_TOKEN_<appid> 优先，回退旧变量 WX_MSG_TOKEN
 * - 其它小程序 → 只认 WX_MSG_TOKEN_<appid>；未配置返回空串（验签必然失败，
 *   避免拿金铁的 Token 校验其它小程序的推送导致永远验不过）
 */
export function getMsgTokenFor(appid?: string): string {
  const wanted = (appid || '').trim()
  const isDefault = !wanted || wanted === getDefaultAppid()
  const flat = findFlatEnv(wanted, 'WX_MSG_TOKEN')
  if (flat) return flat
  return isDefault ? process.env.WX_MSG_TOKEN || DEFAULT_TOKEN : ''
}

/** 按 appid 取 EncodingAESKey（密文模式用）。规则同 getMsgTokenFor */
export function getMsgAesKeyFor(appid?: string): string {
  const wanted = (appid || '').trim()
  const isDefault = !wanted || wanted === getDefaultAppid()
  const flat = findFlatEnv(wanted, 'WX_MSG_AES_KEY')
  if (flat) return flat
  return isDefault ? process.env.WX_MSG_AES_KEY || '' : ''
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
  for (const tag of ['Event', 'ToUserName', 'OpenId', 'OutTradeNo', 'MchOrderNo', 'ProductId', 'Quantity']) {
    const v = pickXmlTag(raw, tag)
    if (v) flat[tag.toLowerCase()] = v
  }
  return flat
}

// ---------- 虚拟支付发货推送 ----------

export type DeliverNotifyPayload = {
  event: string
  /** 接收方小程序 appid（报文 ToUserName）——多租户路由的关键字段 */
  appid: string
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
    appid: flat.tousername || '',
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

// ---------------------------------------------------------------- 多租户推送验签

export type PushTenant = {
  /** 该租户的 appid；默认小程序（金铁）为 WX_APPID 的值 */
  appid: string
  token: string
  aesKey: string
}

/**
 * 列出所有「已配置推送凭证」的小程序租户：
 *   - 默认小程序（金铁）：WX_MSG_TOKEN / WX_MSG_AES_KEY（兼容旧部署）
 *   - 其余小程序：WX_MSG_TOKEN_<appid>（或 WX_MSG_AES_KEY_<appid>）扫出
 */
export function getPushTenants(): PushTenant[] {
  const tenants: PushTenant[] = []
  const seen = new Set<string>()

  const push = (appid: string, token: string, aesKey: string) => {
    const key = appid.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    tenants.push({ appid, token, aesKey })
  }

  // 默认小程序始终是候选（历史配置可能没有专属变量）
  push(getDefaultAppid(), getMsgTokenFor(''), getMsgAesKeyFor(''))

  for (const appid of listAppidsByEnvBase('WX_MSG_TOKEN')) {
    push(appid, getMsgTokenFor(appid), getMsgAesKeyFor(appid))
  }
  for (const appid of listAppidsByEnvBase('WX_MSG_AES_KEY')) {
    push(appid, getMsgTokenFor(appid), getMsgAesKeyFor(appid))
  }
  return tenants
}

/** 从 XML / JSON 报文外层提取 <Encrypt> 密文字段 */
export function extractEncrypt(raw: string): string {
  const m = raw.match(/<Encrypt>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([^<]*))<\/Encrypt>/i)
  if (m) return (m?.[1] ?? m?.[2] ?? '').trim()
  const trimmed = raw.trim()
  if (trimmed.startsWith('{')) {
    try {
      const obj = JSON.parse(trimmed) as { Encrypt?: string }
      return (obj?.Encrypt || '').toString().trim()
    } catch {
      return ''
    }
  }
  return ''
}

export type PushVerifyResult = {
  /** 验签命中的租户（决定后续业务处理用哪套小程序凭证） */
  tenant: PushTenant
  /** 参与业务判断的报文原文：明文模式即 body，密文模式为解密后的明文 */
  effectiveRaw: string
}

/**
 * 推送报文统一验签/解密入口（/api/wx/push 与 /api/wx/xpay-notify 共用）。
 *
 * 多租户策略：微信给每个小程序的推送带各自的 signature（明文）或 msg_signature（密文），
 * 验签钥匙（Token/AESKey）按小程序各配一套。这里以「报文 ToUserName 指向的租户优先，
 * 其余租户按序补试」的方式遍历——错误的 Token 必然验签失败，遍历是安全的。
 *
 * 明文模式：带 signature 参数时必须通过任一租户验签；不带则放行（兼容历史配置），
 * 租户按 ToUserName 选择，兜底默认小程序。
 * 密文模式：msg_signature 验签 + EncodingAESKey 解密必须同时成功，且解密出的
 * receiveid（appid）与租户一致。
 *
 * 返回 null 表示验签失败（调用方按各自策略应答）。
 */
export async function verifyAndDecryptPush(opts: {
  rawBody: string
  timestamp: string
  nonce: string
  /** 明文模式签名（query 参数 signature） */
  signature?: string
  /** 密文模式签名（query 参数 msg_signature） */
  msgSignature?: string
}): Promise<PushVerifyResult | null> {
  const { rawBody, timestamp, nonce } = opts
  const signature = (opts.signature || '').trim()
  const msgSignature = (opts.msgSignature || '').trim()

  // 报文指向的接收方 appid（密文模式外层没有，需解密后才知道）
  const outer = parseWxPushMessage(rawBody)
  const hintedAppid = (outer?.ToUserName || '').trim().toLowerCase()

  const tenants = getPushTenants()
  // 候选顺序：ToUserName 指向的租户优先
  const ordered = [...tenants].sort(
    (a, b) => Number(b.appid.toLowerCase() === hintedAppid) - Number(a.appid.toLowerCase() === hintedAppid)
  )

  const encrypt = extractEncrypt(rawBody)

  if (encrypt) {
    // 密文模式（兼容 / 安全模式）
    for (const tenant of ordered) {
      if (!tenant.aesKey) continue
      if (!verifyMsgSignature(tenant.token, timestamp, nonce, msgSignature, encrypt)) continue
      const decrypted = decryptWxMessage(encrypt, tenant.aesKey)
      if (!decrypted) continue
      // 解密报文尾部自带 receiveid（appid），与租户二次核对，防止 Token 撞库误配
      if (
        decrypted.appId &&
        tenant.appid &&
        decrypted.appId.toLowerCase() !== tenant.appid.toLowerCase()
      ) {
        continue
      }
      return { tenant, effectiveRaw: decrypted.message }
    }
    console.error('[wx-msg] 密文推送验签/解密失败：无租户匹配')
    return null
  }

  // 明文模式
  if (signature) {
    for (const tenant of ordered) {
      if (tenant.token && verifyMsgSignature(tenant.token, timestamp, nonce, signature)) {
        return { tenant, effectiveRaw: rawBody }
      }
    }
    console.error('[wx-msg] 明文推送验签失败：无租户 Token 匹配')
    return null
  }

  // 历史/模拟环境可能不带 signature：放行，租户按 ToUserName 兜底
  const tenant =
    ordered.find(t => t.appid.toLowerCase() === hintedAppid) ||
    ordered.find(t => t.appid === getDefaultAppid()) ||
    ordered[0]
  if (tenant && tenant.appid !== getDefaultAppid() && outer?.ToUserName) {
    console.log(`[wx-msg] 推送（未带签名）来自 ${appDisplayName(tenant.appid)} appid=${tenant.appid}`)
  }
  return tenant ? { tenant, effectiveRaw: rawBody } : null
}
