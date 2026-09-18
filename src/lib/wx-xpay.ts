import crypto from 'crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { DeliverNotifyPayload } from './wx-msg'

/**
 * 微信小程序「虚拟支付 - 道具直购」服务端实现
 *
 * 参考文档：
 *  - 虚拟支付（个人）        https://developers.weixin.qq.com/miniprogram/dev/platform-capabilities/business-capabilities/virtual-payment/person.html
 *  - wx.requestVirtualPayment https://developers.weixin.qq.com/miniprogram/dev/api/payment/wx.requestVirtualPayment.html
 *  - 查询创建的订单           https://developers.weixin.qq.com/miniprogram/dev/server/API/VirtualPayment/api_query_order.html
 *  - 通知已发货完成           https://developers.weixin.qq.com/miniprogram/dev/server/API/VirtualPayment/api_notify_provide_goods.html
 *
 * ## 签名规则（两把钥匙、两种签名，缺一不可）
 *
 *   paySig    = HMAC-SHA256(AppKey,     uri + '&' + postBody)   → 支付签名（证明是商户自己在收款）
 *   signature = HMAC-SHA256(sessionKey, postBody)               → 用户态签名（证明是当前用户在支付）
 *
 *   - C 端下单（wx.requestVirtualPayment）：uri 固定为 'requestVirtualPayment'
 *   - B 端接口（/xpay/*）：uri 为该接口路径，如 '/xpay/query_order'
 *   - postBody 必须与实际发送的原始字符串**逐字节一致**（不可重新序列化、不可改键顺序）
 *   - sessionKey 直接按 utf-8 字符串参与 HMAC，**禁止 base64 解码**（解码必然 -15005）
 *
 * ## 金额单位
 *   全程为「分」，不做换算；goodsPrice 必须与 MP 后台【道具管理】配置的价格一致，
 *   否则下单报 -15013（goodsPrice 道具价格错误）。
 *
 * ## 发货
 *   主链路：平台推送 xpay_goods_deliver_notify → 我们发货 → 返回 ErrCode=0
 *   兜底：前端支付成功后立刻调 /api/wx/xpay-query，服务端调 /xpay/query_order，
 *         查到 status >= 2（已支付）即补发货，并调 /xpay/notify_provide_goods 把平台单改成已发货。
 *   幂等以 out_trade_no / wx_order_id 为准。
 */

// ---------------------------------------------------------------- 商品定义

/**
 * 道具商品注册表：唯一事实来源（代码即配置），支持任意多个道具。
 *
 * 新增道具两步：
 *   1) MP 后台【虚拟支付 → 道具管理】创建道具，记下道具 ID 和价格；
 *   2) 在这里加一项，保持 productId / priceFen 与后台完全一致
 *      （价格不一致下单会报 -15013 goodsPrice 道具价格错误）。
 *
 * 安全约束：端上下单只传 productId，不传也不信任何金额字段——
 * 价格、名称一律以本表为准，篡改端上参数最多买到注册表内已有的道具。
 */
export type XpayProduct = {
  /** 必须与 MP 后台道具管理里的道具 ID 完全一致 */
  productId: string
  name: string
  desc: string
  /** 单价（分），必须与 MP 后台配置一致，否则下单报 -15013 */
  priceFen: number
  /** 购买入口标记，便于对账区分流量来源 */
  attach: string
}

export const XPAY_PRODUCTS: XpayProduct[] = [
  {
    productId: 'jinshan_train_award',
    name: '期盼火箭',
    desc: '为「期盼金山通地铁」助力一次',
    priceFen: 100, // ¥1.00，低价降低试水阶段的决策门槛
    attach: 'train-home',
  },
]

export function findXpayProduct(productId: string): XpayProduct | null {
  return XPAY_PRODUCTS.find(p => p.productId === productId) || null
}

// ---------------------------------------------------------------- 配置

export type XpayConfig = {
  appid: string
  secret: string
  offerId: string
  appKey: string
  env: number
  supabaseUrl: string
  supabaseKey: string
}

export type XpayConfigResult = {
  config: XpayConfig | null
  /** 缺失的必需配置项（用于日志与前端提示，不下发给端上敏感信息） */
  missing: string[]
}

/**
 * 读取虚拟支付配置。任何一个必需项缺失都返回 config = null，
 * 前端据此展示「功能准备中」，保证代码可以先上线、后开通。
 */
export function getXpayConfig(): XpayConfigResult {
  const env = Number(process.env.WX_XPAY_ENV ?? '0') === 1 ? 1 : 0
  // 沙箱与现网是两把不同的 AppKey，禁止互相回退：
  // 沙箱误用现网 key 会全量 -15005（签名校验失败），排查成本远高于「配置缺失」
  const appKeyEnvName = env === 1 ? 'WX_XPAY_APP_KEY_SANDBOX' : 'WX_XPAY_APP_KEY'
  const appKey = process.env[appKeyEnvName] || ''

  const required: Array<[string, string]> = [
    ['WX_APPID', process.env.WX_APPID || ''],
    ['WX_SECRET', process.env.WX_SECRET || ''],
    ['WX_XPAY_OFFER_ID', process.env.WX_XPAY_OFFER_ID || ''],
    [appKeyEnvName, appKey],
    ['NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL || ''],
    ['SUPABASE_SERVICE_ROLE_KEY', getServiceRoleKey()],
  ]
  const missing = required.filter(([, v]) => !v).map(([k]) => k)

  if (missing.length > 0) {
    return { config: null, missing }
  }

  return {
    config: {
      appid: process.env.WX_APPID as string,
      secret: process.env.WX_SECRET as string,
      offerId: process.env.WX_XPAY_OFFER_ID as string,
      appKey,
      env,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      supabaseKey: getServiceRoleKey(),
    },
    missing: [],
  }
}

/**
 * 写订单必须用 service_role（RLS 全关闭），因此这里只认 SUPABASE_SERVICE_ROLE_KEY。
 * 不用 anon key：anon key 是公开的，订单表一旦对 anon 开放读写，
 * 任何人都能伪造「已支付」记录把助力数刷起来。
 */
function getServiceRoleKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || ''
}

// ---------------------------------------------------------------- 签名

export function hmacSha256Hex(key: string, message: string): string {
  return crypto.createHmac('sha256', Buffer.from(key, 'utf8')).update(message, 'utf8').digest('hex')
}

/** 支付签名：HMAC-SHA256(AppKey, uri + '&' + postBody) */
export function buildPaySig(appKey: string, uri: string, postBody: string): string {
  return hmacSha256Hex(appKey, `${uri}&${postBody}`)
}

/** 用户态签名：HMAC-SHA256(sessionKey, postBody)，sessionKey 不做任何解码 */
export function buildSignature(sessionKey: string, postBody: string): string {
  return hmacSha256Hex(sessionKey, postBody)
}

/** 业务单号：8-32 位，仅数字/大小写字母/_-|*@，且不能以下划线开头 */
export function genOutTradeNo(): string {
  return `JK${Date.now().toString(36)}${crypto.randomBytes(4).toString('hex')}`.slice(0, 32)
}

// ---------------------------------------------------------------- 微信服务端接口

type Code2SessionResult = { openid: string; sessionKey: string }

/** wx.login() 的 code 换 openid + session_key（code 一次性、约 5 分钟有效） */
export async function code2Session(appid: string, secret: string, code: string): Promise<Code2SessionResult> {
  const url =
    `https://api.weixin.qq.com/sns/jscode2session?appid=${encodeURIComponent(appid)}` +
    `&secret=${encodeURIComponent(secret)}&js_code=${encodeURIComponent(code)}` +
    `&grant_type=authorization_code`
  const res = await fetch(url, { method: 'GET', cache: 'no-store' })
  const data = (await res.json().catch(() => ({}))) as {
    openid?: string
    session_key?: string
    errcode?: number
    errmsg?: string
  }
  if (!data.openid || !data.session_key) {
    throw new Error(`code2Session 失败: errcode=${data.errcode} errmsg=${data.errmsg}`)
  }
  return { openid: data.openid, sessionKey: data.session_key }
}

// access_token 缓存（stable_token 普通模式：有效期内重复调用返回同一个 token，
// 适配 Vercel 多实例部署；与 msg-sec-check 各自持有缓存互不影响）
type TokenCacheEntry = { token: string; expireAt: number }
let tokenCache: TokenCacheEntry | null = null

export async function getXpayAccessToken(appid: string, secret: string): Promise<string> {
  const now = Date.now()
  if (tokenCache && tokenCache.expireAt > now) {
    return tokenCache.token
  }

  const res = await fetch('https://api.weixin.qq.com/cgi-bin/stable_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credential', appid, secret, force_refresh: false }),
    cache: 'no-store',
  })
  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string
    expires_in?: number
    errcode?: number
    errmsg?: string
  }
  if (!data.access_token) {
    throw new Error(`获取 access_token 失败: errcode=${data.errcode} errmsg=${data.errmsg}`)
  }
  const ttlSec = Math.max((data.expires_in || 7200) - 300, 60)
  tokenCache = { token: data.access_token, expireAt: now + ttlSec * 1000 }
  return data.access_token
}

export type XpayOrderStatus = {
  order_id?: string
  status?: number
  order_type?: number
  order_fee?: number
  paid_fee?: number
  paid_time?: number
  wx_order_id?: string
}

/**
 * 查询创建的订单（现金单）。status：0 初始化 / 1 创建成功 / 2 已支付待发货 /
 * 3 发货中 / 4 已发货 / 5 已退款 / 6 已关闭 / 7 退款失败。
 */
export async function queryXpayOrder(
  config: XpayConfig,
  accessToken: string,
  params: { openid: string; orderId?: string; wxOrderId?: string }
): Promise<{ errcode: number; errmsg: string; order?: XpayOrderStatus }> {
  const body = JSON.stringify({
    openid: params.openid,
    env: config.env,
    order_id: params.orderId || '',
    wx_order_id: params.wxOrderId || '',
  })
  const uri = '/xpay/query_order'
  const paySig = buildPaySig(config.appKey, uri, body)
  const url = `https://api.weixin.qq.com${uri}?access_token=${encodeURIComponent(accessToken)}&pay_sig=${paySig}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    cache: 'no-store',
  })
  const data = (await res.json().catch(() => ({}))) as {
    errcode?: number
    errmsg?: string
    order?: XpayOrderStatus
  }
  return { errcode: data.errcode ?? -1, errmsg: data.errmsg || '', order: data.order }
}

/** 通知平台该订单已发货完成（正常走推送成功则无需调用，仅兜底补发货后调用） */
export async function notifyProvideGoods(
  config: XpayConfig,
  accessToken: string,
  params: { orderId?: string; wxOrderId?: string }
): Promise<{ errcode: number; errmsg: string }> {
  const body = JSON.stringify({
    order_id: params.orderId || '',
    wx_order_id: params.wxOrderId || '',
    env: config.env,
  })
  const uri = '/xpay/notify_provide_goods'
  const paySig = buildPaySig(config.appKey, uri, body)
  const url = `https://api.weixin.qq.com${uri}?access_token=${encodeURIComponent(accessToken)}&pay_sig=${paySig}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    cache: 'no-store',
  })
  const data = (await res.json().catch(() => ({}))) as { errcode?: number; errmsg?: string }
  return { errcode: data.errcode ?? -1, errmsg: data.errmsg || '' }
}

// ---------------------------------------------------------------- 订单存储

export type XpayOrderStatusText = 'created' | 'paid' | 'delivered' | 'closed'

export type XpayOrderRow = {
  out_trade_no: string
  wx_order_id: string | null
  openid: string
  product_id: string
  quantity: number
  goods_price: number
  total_fee: number
  status: XpayOrderStatusText
  attach: string | null
  env: number
  paid_at: string | null
  delivered_at: string | null
  created_at: string
  updated_at: string
}

function getDb(config: XpayConfig): SupabaseClient {
  return createClient(config.supabaseUrl, config.supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

const TABLE = 'xpay_orders'

export async function insertOrder(
  config: XpayConfig,
  row: {
    outTradeNo: string
    openid: string
    productId: string
    quantity: number
    goodsPrice: number
    attach: string
  }
): Promise<void> {
  const { error } = await getDb(config)
    .from(TABLE)
    .insert({
      out_trade_no: row.outTradeNo,
      openid: row.openid,
      product_id: row.productId,
      quantity: row.quantity,
      goods_price: row.goodsPrice,
      total_fee: row.goodsPrice * row.quantity,
      status: 'created',
      attach: row.attach,
      env: config.env,
    })
  if (error) {
    throw new Error(`写入订单失败: ${error.message}`)
  }
}

export async function findOrder(config: XpayConfig, outTradeNo: string): Promise<XpayOrderRow | null> {
  const { data, error } = await getDb(config)
    .from(TABLE)
    .select('*')
    .eq('out_trade_no', outTradeNo)
    .maybeSingle()
  if (error) {
    throw new Error(`查询订单失败: ${error.message}`)
  }
  return (data as XpayOrderRow) || null
}

export async function markOrderPaid(
  config: XpayConfig,
  outTradeNo: string,
  extra: { wxOrderId?: string; paidFee?: number } = {}
): Promise<void> {
  const payload: Record<string, unknown> = { status: 'paid', paid_at: new Date().toISOString() }
  if (extra.wxOrderId) payload.wx_order_id = extra.wxOrderId
  if (typeof extra.paidFee === 'number' && extra.paidFee > 0) payload.total_fee = extra.paidFee
  const { error } = await getDb(config).from(TABLE).update(payload).eq('out_trade_no', outTradeNo)
  if (error) {
    throw new Error(`更新订单状态失败: ${error.message}`)
  }
}

/**
 * 标记已发货（幂等：已经是 delivered 直接返回 false 表示没重复计数）。
 * 若订单不存在（例如推送先于写入到达、或本地数据被清过），
 * 以推送内容补建一条 delivered 记录，避免漏记用户的助力。
 */
export async function deliverOrder(
  config: XpayConfig,
  params: {
    outTradeNo: string
    wxOrderId: string
    openid: string
    productId: string
    quantity: number
  }
): Promise<{ counted: boolean; order: XpayOrderRow | null }> {
  const db = getDb(config)
  const existing = await findOrder(config, params.outTradeNo)

  if (!existing) {
    if (!params.outTradeNo) {
      return { counted: false, order: null }
    }
    // 推送先于下单落库（极端时序）或本地数据被清过：按注册表补齐价格，仅供对账展示
    const product = findXpayProduct(params.productId || '')
    const quantity = params.quantity || 1
    const { data, error } = await db
      .from(TABLE)
      .insert({
        out_trade_no: params.outTradeNo,
        wx_order_id: params.wxOrderId || null,
        openid: params.openid,
        product_id: params.productId,
        quantity,
        goods_price: product?.priceFen ?? 0,
        total_fee: (product?.priceFen ?? 0) * quantity,
        status: 'delivered',
        attach: 'push-created',
        env: config.env,
        paid_at: new Date().toISOString(),
        delivered_at: new Date().toISOString(),
      })
      .select('*')
      .maybeSingle()
    if (error) {
      throw new Error(`补建订单失败: ${error.message}`)
    }
    return { counted: true, order: (data as XpayOrderRow) || null }
  }

  if (existing.status === 'delivered') {
    return { counted: false, order: existing }
  }

  const { data, error } = await db
    .from(TABLE)
    .update({
      status: 'delivered',
      wx_order_id: params.wxOrderId || existing.wx_order_id,
      delivered_at: new Date().toISOString(),
    })
    .eq('out_trade_no', params.outTradeNo)
    .select('*')
    .maybeSingle()
  if (error) {
    throw new Error(`更新发货状态失败: ${error.message}`)
  }
  return { counted: true, order: (data as XpayOrderRow) || null }
}

/**
 * 处理平台发货推送：幂等发货 + 累计助力数。
 * 返回 ok=false 时调用方必须回一个非 0 的 ErrCode，让微信重推。
 */
export async function deliverByNotify(
  payload: DeliverNotifyPayload
): Promise<{ ok: boolean; errmsg: string; counted: boolean; totalCount?: number }> {
  const { config, missing } = getXpayConfig()
  if (!config) {
    // 配置缺失属于「我们这边的问题」，返回失败让平台重推，避免漏记用户已支付的助力
    console.error('[wx-xpay] 发货推送到达但配置缺失:', missing.join(', '))
    return { ok: false, errmsg: 'server not configured', counted: false }
  }

  // 幂等：优先用平台单号，其次用业务单号
  const identity = payload.wxOrderId || payload.outTradeNo
  if (!identity) {
    console.error('[wx-xpay] 发货推送缺少单号，无法幂等:', JSON.stringify(payload.flat))
    return { ok: false, errmsg: 'missing order id', counted: false }
  }

  try {
    const { counted, order } = await deliverOrder(config, {
      outTradeNo: payload.outTradeNo || payload.wxOrderId,
      wxOrderId: payload.wxOrderId,
      openid: payload.openid,
      productId: payload.productId,
      quantity: payload.quantity,
    })

    const statsProductId = order?.product_id || payload.productId
    const stats = statsProductId ? await getSupportStats(config, statsProductId) : null
    console.log(
      `[wx-xpay] 发货${counted ? '成功' : '幂等跳过'} outTradeNo=${payload.outTradeNo || '-'} wxOrderId=${
        payload.wxOrderId || '-'
      } openid=${payload.openid || '-'} productId=${payload.productId || '-'} qty=${payload.quantity} total=${
        stats?.totalCount ?? '-'
      }`
    )
    return { ok: true, errmsg: 'success', counted, totalCount: stats?.totalCount }
  } catch (err) {
    console.error('[wx-xpay] 发货失败:', err)
    return { ok: false, errmsg: (err as Error).message || 'deliver failed', counted: false }
  }
}

export type SupportStats = {
  /** 累计助力份数（去重订单） */
  totalCount: number
  /** 参与助力的用户数（去重 openid） */
  supporterCount: number
  /** 当前用户的助力份数 */
  myCount: number
}

export async function getSupportStats(
  config: XpayConfig,
  productId: string,
  openid?: string
): Promise<SupportStats> {
  const db = getDb(config)
  const { data, error } = await db.from(TABLE).select('openid,quantity').eq('product_id', productId).eq('status', 'delivered')
  if (error) {
    throw new Error(`统计助力数失败: ${error.message}`)
  }
  const rows = (data || []) as Array<{ openid: string; quantity: number }>
  const totalCount = rows.reduce((sum, r) => sum + (r.quantity || 1), 0)
  const supporterCount = new Set(rows.map(r => r.openid)).size
  const myCount = openid ? rows.filter(r => r.openid === openid).reduce((sum, r) => sum + (r.quantity || 1), 0) : 0
  return { totalCount, supporterCount, myCount }
}
