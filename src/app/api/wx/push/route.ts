import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

/**
 * POST/GET /api/wx/push
 *
 * 小程序「消息推送」服务器接口（微信开放平台 → 开发管理 → 消息推送配置）。
 * 文档：https://developers.weixin.qq.com/miniprogram/dev/framework/server-ability/message-push.html
 *
 * ## 配置项对应关系（微信公众平台消息推送配置页）
 *   URL(服务器地址)      → https://yangjing.m9ai.work/api/wx/push
 *   Token(令牌)          → 环境变量 WX_MSG_TOKEN（未配置时使用下方 DEFAULT_TOKEN）
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
 *   - 暂不回复任何客服消息，统一返回字符串 "success" 表示「已收到、无需回复」。
 *   - 支持明文模式（直接解析 JSON / XML 报文）与兼容/安全模式
 *     （先校验 msg_signature，再按微信协议 AES-256-CBC 解密）。
 *   - 所有消息仅记录日志，便于在 Vercel Logs 中排查虚拟支付等事件回调。
 *
 * ## 密文解密协议（微信消息加解密）
 *   cipher = base64 decode(Encrypt)
 *   plain  = AES-256-CBC-decrypt(cipher, key = base64decode(EncodingAESKey + '='), iv = cipher 前 16 字节)
 *   plain  = 16 字节随机串 + 4 字节消息长度(网络序) + 消息体 + receiveid(小程序为 appid)
 *   msg_signature = sha1(sort(token, timestamp, nonce, Encrypt) 拼接)
 */

// Token：3-32 位英文或数字。默认值需与公众平台「消息推送配置」页填写的 Token 完全一致。
const DEFAULT_TOKEN = 'BeeOfYangjingMsg2026'

function getToken(): string {
  return process.env.WX_MSG_TOKEN || DEFAULT_TOKEN
}

// ---------- 签名校验 ----------

function sha1(...parts: string[]): string {
  return crypto.createHash('sha1').update(parts.sort().join('')).digest('hex')
}

function verifySignature(token: string, timestamp: string, nonce: string, signature: string, encrypt?: string): boolean {
  if (!signature) return false
  const expected = encrypt ? sha1(token, timestamp, nonce, encrypt) : sha1(token, timestamp, nonce)
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  } catch {
    return false
  }
}

// ---------- 密文解密（兼容模式 / 安全模式） ----------

function decryptMessage(encryptB64: string, aesKey: string): { message: string; appId: string } | null {
  try {
    // EncodingAESKey 为 43 位，补一个 '=' 后 base64 解码得到 32 字节 AES 密钥
    const key = Buffer.from(aesKey + '=', 'base64')
    if (key.length !== 32) {
      console.error('[wx-push] EncodingAESKey 非法：解码后不是 32 字节')
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
    console.error('[wx-push] 消息解密失败:', err)
    return null
  }
}

// ---------- 报文解析（JSON / XML 均兼容） ----------

type WxPushMessage = Record<string, string>

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

// 微信 XML 报文为单层结构，值多为 CDATA 包裹，用正则提取即可，无需引入 XML 库
function parseXmlMessage(raw: string): WxPushMessage | null {
  const out: WxPushMessage = {}
  const re = /<([A-Za-z][A-Za-z0-9_]*)>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([^<]*))<\/\1>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(raw)) !== null) {
    out[m[1]] = (m[2] ?? m[3] ?? '').trim()
  }
  return Object.keys(out).length > 0 ? out : null
}

function parseMessage(raw: string): WxPushMessage | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('{')) return parseJsonMessage(trimmed)
  if (trimmed.startsWith('<')) return parseXmlMessage(trimmed)
  return null
}

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

  if (!verifySignature(getToken(), timestamp, nonce, signature)) {
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
    const outer = parseMessage(rawBody)
    if (!outer) {
      console.warn('[wx-push] 无法解析推送报文，已忽略。body 前 200 字:', rawBody.slice(0, 200))
      return new NextResponse('success')
    }

    let payload: WxPushMessage = outer

    // 2) 密文模式（兼容/安全模式）：JSON 报文 Encrypt 字段，或 XML <Encrypt> 节点
    const encrypt = outer.Encrypt
    if (encrypt) {
      const aesKey = process.env.WX_MSG_AES_KEY
      if (!aesKey) {
        console.error('[wx-push] 收到加密消息但未配置 WX_MSG_AES_KEY，无法解密')
        return new NextResponse('success')
      }
      if (!verifySignature(getToken(), timestamp, nonce, msgSignature, encrypt)) {
        console.error('[wx-push] POST msg_signature 校验失败')
        return new NextResponse('success')
      }
      const decrypted = decryptMessage(encrypt, aesKey)
      if (!decrypted) {
        return new NextResponse('success')
      }
      const inner = parseMessage(decrypted.message)
      if (!inner) {
        console.warn('[wx-push] 解密后的报文无法解析:', decrypted.message.slice(0, 200))
        return new NextResponse('success')
      }
      payload = inner
    }

    // 3) 记录消息（暂不自动回复客服消息，统一返回 success）
    //    虚拟支付、订阅消息等事件回调也会从这里进入，可在 Vercel Logs 中检索 [wx-push]
    const msgType = payload.MsgType || '-'
    const event = payload.Event || ''
    console.log(
      `[wx-push] msg: type=${msgType}${event ? ` event=${event}` : ''} from=${payload.FromUserName || '-'} to=${payload.ToUserName || '-'}`,
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
