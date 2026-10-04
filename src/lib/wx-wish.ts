import type { SupabaseClient } from '@supabase/supabase-js'
import { getServiceClient } from './supabase/admin'
import { code2Session, resolveWxCredential } from './wx-apps'
import { checkTextContent } from './wx-sec-check'

/** 心愿内容长度上限（与 mini_wishes 表的 CHECK 约束一致） */
const MAX_WISH_CONTENT_LENGTH = 120

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

// 复用共享的 service_role 客户端（与 wx-xpay / watch 系列一致）
const getDb = getServiceClient

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

/**
 * 心愿内容安全检测。
 *
 * 判定与降级策略见 @/lib/wx-sec-check（与「小蜜蜂盯」共用同一套策略）。
 */
export async function checkWishContent(
  content: string,
  auth: AuthContext
): Promise<{ pass: boolean; errmsg?: string; degraded?: boolean }> {
  return checkTextContent(content, auth, MAX_WISH_CONTENT_LENGTH, '心愿内容')
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
