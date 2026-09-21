/**
 * 开发者通知通道：把服务端发生的事情主动推到开发者手机上。
 *
 * 当前实现：企业微信群机器人 Webhook（最简单、零授权、不限频）。
 * 备选方案：Server酱 / 公众号模板消息 / 自建 SMTP；
 *          微信侧的客服消息/订阅消息限制太严，不适合做告警通道。
 *
 * 配置：在 Vercel / .env.local 加 DEV_WECHAT_WORK_WEBHOOK（企业微信群机器人 Webhook URL）
 *       留空则整个通知通道关闭，仅打日志，不影响发货主链路。
 */

import { appDisplayName } from './wx-apps'
import { findXpayProduct } from './wx-xpay'

export type SaleNotifyInfo = {
  /** 售出订单所属小程序 appid（多租户标注来源） */
  appid?: string | null
  productId: string
  outTradeNo: string
  wxOrderId?: string | null
  openid: string
  env: number
  paidAt?: string | null
  totalCount?: number
}

/**
 * webhook 地址必须「调用时」读取，不能在模块顶层求值成常量：
 * Next.js 会在构建期静态内联 process.env.X，顶层常量一旦在构建时为空就永久为空，
 * 部署之后再补环境变量也不会生效（必须重新部署）。
 * 与 wx-apps / wx-xpay 的写法保持一致，统一惰性读取。
 *
 * 多租户：目前所有小程序共用同一个群机器人（DEV_WECHAT_WORK_WEBHOOK），
 * 消息体里用「小程序」一栏标注来源；如需按租户分群，再扩成
 * DEV_WECHAT_WORK_WEBHOOK_<appid>（findFlatEnv）+ 全局兜底。
 */
function webhookUrl(): string {
  return (process.env.DEV_WECHAT_WORK_WEBHOOK || '').trim()
}

function envLabel(env: number): '现网' | '沙箱' {
  return env === 1 ? '沙箱' : '现网'
}

function fmtTime(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  // 用本地化时间，便于跨时区排查；非 UTC 且不带 Z 的环境也能正常显示
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/**
 * 道具售出后给开发者推送一条群机器人消息。
 * 最佳努力：调用失败/未配置均不影响发货主链路。
 */
export async function notifyDevOfSale(info: SaleNotifyInfo): Promise<void> {
  const WEBHOOK = webhookUrl()
  if (!WEBHOOK) {
    console.log('[notify] DEV_WECHAT_WORK_WEBHOOK 未配置，跳过开发者通知 (outTradeNo=' + info.outTradeNo + ')')
    return
  }

  const product = findXpayProduct(info.appid || undefined, info.productId)
  const productName = product?.name || info.productId
  const priceText = product ? `¥${(product.priceFen / 100).toFixed(2)}` : ''

  const lines: string[] = [
    `## 🎯 虚拟支付 · 道具售出`,
    '',
    `- **小程序**：${appDisplayName(info.appid)}`,
    `- **道具**：${productName} (\`${info.productId}\`)${priceText ? ' ' + priceText : ''}`,
    `- **环境**：<font color="info">${envLabel(info.env)}</font>`,
    `- **商户单号**：\`${info.outTradeNo}\``,
  ]
  if (info.wxOrderId) lines.push(`- **微信单号**：\`${info.wxOrderId}\``)
  lines.push(`- **买家 openid**：\`${info.openid}\``)
  const t = fmtTime(info.paidAt)
  if (t) lines.push(`- **支付时间**：${t}`)
  if (typeof info.totalCount === 'number') lines.push(`- **累计售出**：${info.totalCount}`)

  const payload = { msgtype: 'markdown', markdown: { content: lines.join('\n') } }

  try {
    const res = await fetch(WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const text = await res.text()
    // 企业微信返回 {"errcode":0,"errmsg":"ok"}；任何 errcode != 0 视为失败
    const failed = !res.ok || /"errcode"\s*:\s*[1-9]\d*/.test(text)
    if (failed) {
      console.error(`[notify] 开发者通知推送失败 status=${res.status} body=${text.slice(0, 200)} outTradeNo=${info.outTradeNo}`)
    } else {
      console.log(`[notify] 开发者通知推送成功 outTradeNo=${info.outTradeNo}`)
    }
  } catch (err) {
    console.error('[notify] 开发者通知推送异常:', err)
  }
}