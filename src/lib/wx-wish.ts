import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  code2Session,
  getAccessToken,
  resolveWxCredential,
} from './wx-apps'

/**
 * 小程序许愿池服务端模块
 *
 * 负责：
 *   1. 用户身份鉴权（wx.login code → openid）
 *   2. 心愿内容安全审核（wxa/msg_sec_check）
 *   3. 校验虚拟支付订单（防止伪造已支付记录）
 *   4. mini_wishes 表的读写
 *
 * 安全约束：
 *   - 所有写操作必须通过 code 换取 openid，不可信任前端传入 openid。
 *   - 心愿内容与 xpay_orders 订单均按 openid + appid 做归属校验。
 *   - Supabase 使用 service_role key（RLS 已关闭 anon 写入）。
 */

const TABLE = 'mini_wishes'
const XPAY_TABLE = 'xpay_orders'

export type MiniWishStatus = 'pending' | 'fulfilled' | 'deleted'

export type MiniWishRow = {
  id: string
  openid: string
  appid: string
  content: string
  status: MiniWishStatus
  make_trade_no: string
  fulfill_trade_no: string | null
  fulfilled_at: string | null
  created_at: string
  updated_at: string
}

export type CreateWishInput = {
  /** 请求方小程序 appid；空字符串表示默认小程序 */
  appid: string
  code: string
  content: string
  makeTradeNo: string
}

export type FulfillWishInput = {
  /** 请求方小程序 appid；空字符串表示默认小程序 */
  appid: string
  code: string
  wishId: string
  fulfillTradeNo: string
}

export type AuthContext = {
  appid: string
  secret: string
  openid: string
}

// ---------------------------------------------------------------- 数据库

function getDb(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('缺少 Supabase 配置（NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY）')
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// ---------------------------------------------------------------- 认证

/**
 * 解析请求方小程序凭证并换取 openid。
 * requestAppid 来自 wx.getAccountInfoSync().miniProgram.appId（公开信息）。
 */
export async function authByCode(
  requestAppid: string | undefined,
  code: string
): Promise<AuthContext> {
  if (!code) {
    throw new Error('缺少登录 code')
  }
  const { appid, secret } = resolveWxCredential(requestAppid)
  const { openid } = await code2Session(appid, secret, code)
  return { appid, secret, openid }
}

// ---------------------------------------------------------------- 内容安全审核

type WxSecCheckResult = {
  errcode?: number
  errmsg?: string
  result?: { suggest?: string; label?: number }
  trace_id?: string
}

async function callMsgSecCheck(
  accessToken: string,
  content: string,
  openid: string
): Promise<WxSecCheckResult> {
  const url = `https://api.weixin.qq.com/wxa/msg_sec_check?access_token=${encodeURIComponent(accessToken)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content,
      version: 2,
      scene: 1,
      openid,
    }),
    cache: 'no-store',
  })
  return (await res.json().catch(() => ({}))) as WxSecCheckResult
}

/**
 * 文本内容安全检测。
 *
 * 拦截策略（收紧）：
 *   - errcode = 87014      → 拦截
 *   - suggest = 'risky'    → 拦截
 *   - suggest = 'review'   → 拦截（疑似违规需人工复核，不放行）
 *
 * 降级策略（fail-open）：
 *   token / code2Session / 微信接口异常时返回 pass=true，不阻断正常用户，
 *   但会打 warn/error 日志便于监控漏放。
 */
export async function checkWishContent(
  content: string,
  auth: AuthContext
): Promise<{ pass: boolean; errmsg?: string; degraded?: boolean }> {
  if (!content || !content.trim()) {
    return { pass: false, errmsg: '心愿内容不能为空' }
  }
  if (content.length > 120) {
    return { pass: false, errmsg: '心愿内容不能超过 120 字' }
  }

  let accessToken: string
  try {
    accessToken = await getAccessToken(auth.appid, auth.secret)
  } catch (err) {
    console.warn('[wish-sec-check] access_token 获取失败，降级放行:', err)
    return { pass: true, degraded: true }
  }

  let wxData: WxSecCheckResult
  try {
    wxData = await callMsgSecCheck(accessToken, content, auth.openid)
  } catch (err) {
    console.warn('[wish-sec-check] 微信接口异常，降级放行:', err)
    return { pass: true, degraded: true }
  }

  const errcode = typeof wxData.errcode === 'number' ? wxData.errcode : -1
  const suggest = wxData.result?.suggest
  const blocked = errcode === 87014 || suggest === 'risky' || suggest === 'review'

  if (errcode !== 0 && errcode !== 87014) {
    // 其他微信服务端异常，降级放行
    console.warn(
      `[wish-sec-check] wechat api error，降级放行: errcode=${errcode} errmsg=${wxData.errmsg}`
    )
    return { pass: true, degraded: true }
  }

  if (blocked) {
    console.warn(
      `[wish-sec-check] blocked: errcode=${errcode} suggest=${suggest ?? '-'} trace_id=${wxData.trace_id ?? '-'}`
    )
    let errmsg = '您输入的内容涉嫌违规，请修改后再试'
    if (suggest === 'review') errmsg = '您输入的内容需人工复核，请修改后再试'
    if (wxData.errmsg && wxData.errmsg !== 'ok') errmsg = wxData.errmsg
    return { pass: false, errmsg }
  }

  return { pass: true }
}

// ---------------------------------------------------------------- 订单校验

async function assertOrderValid(
  auth: AuthContext,
  outTradeNo: string,
  productId: string
): Promise<void> {
  const { data, error } = await getDb()
    .from(XPAY_TABLE)
    .select('*')
    .eq('out_trade_no', outTradeNo)
    .maybeSingle()

  if (error) {
    throw new Error(`查询订单失败: ${error.message}`)
  }
  if (!data) {
    throw new Error('未找到对应支付订单')
  }

  const order = data as {
    openid: string
    appid: string | null
    product_id: string
    status: string
  }

  if (order.openid !== auth.openid) {
    throw new Error('支付订单与用户不匹配')
  }
  const orderAppid = order.appid || ''
  if (orderAppid && orderAppid !== auth.appid) {
    throw new Error('支付订单与小程序不匹配')
  }
  if (order.product_id !== productId) {
    throw new Error('支付订单类型不匹配')
  }
  if (order.status !== 'delivered') {
    throw new Error('订单尚未支付完成，请稍后再试')
  }
}

// ---------------------------------------------------------------- CRUD

export async function createWish(input: CreateWishInput): Promise<MiniWishRow> {
  const auth = await authByCode(input.appid, input.code)
  const content = input.content.trim()

  const sec = await checkWishContent(content, auth)
  if (!sec.pass) {
    throw new Error(sec.errmsg || '内容审核未通过')
  }

  await assertOrderValid(auth, input.makeTradeNo, 'make_a_wish')

  const db = getDb()
  const { data, error } = await db
    .from(TABLE)
    .insert({
      openid: auth.openid,
      appid: auth.appid,
      content,
      status: 'pending',
      make_trade_no: input.makeTradeNo,
    })
    .select('*')
    .single()

  if (error) {
    // 唯一键冲突说明该订单已创建过心愿，视为幂等成功
    if (error.code === '23505') {
      const existing = await db
        .from(TABLE)
        .select('*')
        .eq('make_trade_no', input.makeTradeNo)
        .maybeSingle()
      if (existing.data) return existing.data as MiniWishRow
    }
    throw new Error(`保存心愿失败: ${error.message}`)
  }

  return data as MiniWishRow
}

export async function fulfillWish(input: FulfillWishInput): Promise<MiniWishRow> {
  const auth = await authByCode(input.appid, input.code)

  await assertOrderValid(auth, input.fulfillTradeNo, 'fulfill_vow')

  const db = getDb()

  // 先确认心愿归属与状态
  const { data: wish, error: findError } = await db
    .from(TABLE)
    .select('*')
    .eq('id', input.wishId)
    .eq('openid', auth.openid)
    .eq('appid', auth.appid)
    .neq('status', 'deleted')
    .maybeSingle()

  if (findError) {
    throw new Error(`查询心愿失败: ${findError.message}`)
  }
  if (!wish) {
    throw new Error('未找到可还愿的心愿')
  }
  if ((wish as MiniWishRow).status === 'fulfilled') {
    throw new Error('该心愿已还愿')
  }

  const { data, error } = await db
    .from(TABLE)
    .update({
      status: 'fulfilled',
      fulfill_trade_no: input.fulfillTradeNo,
      fulfilled_at: new Date().toISOString(),
    })
    .eq('id', input.wishId)
    .select('*')
    .single()

  if (error) {
    throw new Error(`更新还愿状态失败: ${error.message}`)
  }

  return data as MiniWishRow
}

export async function deleteWish(
  requestAppid: string | undefined,
  code: string,
  wishId: string
): Promise<void> {
  const auth = await authByCode(requestAppid, code)

  const { error } = await getDb()
    .from(TABLE)
    .update({ status: 'deleted' })
    .eq('id', wishId)
    .eq('openid', auth.openid)
    .eq('appid', auth.appid)

  if (error) {
    throw new Error(`删除心愿失败: ${error.message}`)
  }
}

export async function listWishes(
  requestAppid: string | undefined,
  code: string
): Promise<MiniWishRow[]> {
  const auth = await authByCode(requestAppid, code)

  const { data, error } = await getDb()
    .from(TABLE)
    .select('*')
    .eq('openid', auth.openid)
    .eq('appid', auth.appid)
    .neq('status', 'deleted')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`查询心愿失败: ${error.message}`)
  }

  return (data as MiniWishRow[]) || []
}
