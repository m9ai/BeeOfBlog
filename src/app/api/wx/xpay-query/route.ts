import { NextRequest, NextResponse } from 'next/server'
import {
  code2Session,
  deliverOrder,
  findOrder,
  getSupportStats,
  getXpayAccessToken,
  getXpayConfig,
  notifyProvideGoods,
  queryXpayOrder,
} from '@/lib/wx-xpay'
import { notifyDevOfSale } from '@/lib/notify'

/**
 * POST /api/wx/xpay-query
 *
 * 支付结果确认 + 兜底补发货（多小程序租户路由）。
 *
 * ## 多租户
 *   请求体携带 `appid`（wx.getAccountInfoSync().miniProgram.appId，公开信息），
 *   服务端据此选择该小程序的凭证；未传时回退默认小程序（金铁，WX_APPID）。
 *
 * ## 为什么需要它
 *   wx.requestVirtualPayment 的 success 回调可能丢失（微信异常退出等），
 *   官方明确要求：前端 success 回调不能作为发货依据，发货以「平台推送 + 主动查单」为准。
 *   本接口在支付返回后由端上立刻调用一次，既能让用户马上看到助力数变化，
 *   也顺手把「推送丢失」的订单补上（发货幂等，重复调用无副作用）。
 *
 * ## 请求体
 *   { code: string, appid?: string, outTradeNo: string }
 *
 * ## 响应体
 *   { success: true, enabled: true, paid: boolean, platformStatus: number,
 *     delivered: boolean, totalCount, supporterCount, myCount, errmsg? }
 *   platformStatus（微信侧订单状态）：
 *     0 初始化 / 1 创建成功 / 2 已支付待发货 / 3 发货中 / 4 已发货 /
 *     5 已退款 / 6 已关闭 / 7 退款失败
 */

export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {}
  try {
    body = await request.json().catch(() => ({}))
  } catch {
    body = {}
  }
  const requestAppid: string = (body?.appid || '').toString().trim()

  const { config, missing } = getXpayConfig(requestAppid || undefined)
  if (!config) {
    console.warn(
      `[wx-xpay-query] 虚拟支付未配置 appid=${requestAppid || '(默认)'}，缺失:`,
      missing.join(', ')
    )
    return NextResponse.json(
      { success: false, enabled: false, errcode: -100, errmsg: '功能准备中，敬请期待' },
      { status: 200 }
    )
  }

  try {
    const code: string = (body?.code || '').toString()
    const outTradeNo: string = (body?.outTradeNo || '').toString()

    if (!code || !outTradeNo) {
      return NextResponse.json(
        { success: false, enabled: true, errcode: -1, errmsg: '缺少 code 或 outTradeNo' },
        { status: 400 }
      )
    }

    // 1) 归属校验：只能查自己的单（outTradeNo 是随机串，但仍然不靠它做鉴权）
    const order = await findOrder(config, outTradeNo)
    if (!order) {
      return NextResponse.json(
        { success: false, enabled: true, errcode: -2, errmsg: '订单不存在' },
        { status: 404 }
      )
    }

    const { openid } = await code2Session(config.appid, config.secret, code)
    if (openid !== order.openid) {
      console.warn(`[wx-xpay-query] 越权查询被拒绝 outTradeNo=${outTradeNo} openid=${openid}`)
      return NextResponse.json(
        { success: false, enabled: true, errcode: -3, errmsg: '无权查询该订单' },
        { status: 403 }
      )
    }

    const statsFor = async (myOpenid: string) => getSupportStats(config, order.product_id, myOpenid)

    // 2) 本地已发货：直接返回，省掉一次微信调用
    if (order.status === 'delivered') {
      const stats = await statsFor(openid)
      return NextResponse.json({
        success: true,
        enabled: true,
        paid: true,
        delivered: true,
        platformStatus: 4,
        ...stats,
      })
    }

    // 3) 向微信查单
    const accessToken = await getXpayAccessToken(config.appid, config.secret)
    const res = await queryXpayOrder(config, accessToken, { openid, orderId: outTradeNo })
    const platformStatus = res.order?.status ?? -1

    console.log(
      `[wx-xpay-query] query_order outTradeNo=${outTradeNo} errcode=${res.errcode} status=${platformStatus} wxOrderId=${
        res.order?.wx_order_id || '-'
      }`
    )

    if (res.errcode !== 0) {
      // 查单失败（网络/签名/频率限制）：不阻断前端，返回未确认状态，端上提示「稍后自动同步」
      return NextResponse.json(
        {
          success: false,
          enabled: true,
          errcode: res.errcode,
          errmsg: res.errmsg || '订单查询失败',
          paid: false,
          delivered: order.status !== 'created',
          platformStatus,
        },
        { status: 200 }
      )
    }

    // 4) status >= 2 表示用户已完成支付（2 待发货 / 3 发货中 / 4 已发货）
    if (platformStatus < 2 || platformStatus > 4) {
      const stats = await statsFor(openid)
      return NextResponse.json({
        success: true,
        enabled: true,
        paid: false,
        delivered: false,
        platformStatus,
        errmsg: platformStatus === 6 ? '订单已关闭' : platformStatus === 5 || platformStatus === 7 ? '订单已退款' : '支付未完成',
        ...stats,
      })
    }

    // 5) 补发货（幂等）
    const { counted, order: delivered } = await deliverOrder(config, {
      outTradeNo,
      wxOrderId: res.order?.wx_order_id || '',
      openid,
      productId: order.product_id,
      quantity: order.quantity,
    })

    // 6) 通知平台该单已发货完成（走推送成功时无需调用，这里是兜底路径）
    //    失败只记日志，不影响用户侧计数
    if (counted) {
      try {
        const notify = await notifyProvideGoods(config, accessToken, {
          orderId: outTradeNo,
          wxOrderId: res.order?.wx_order_id || '',
        })
        if (notify.errcode !== 0) {
          console.warn(`[wx-xpay-query] notify_provide_goods 失败: ${notify.errcode} ${notify.errmsg}`)
        }
      } catch (err) {
        console.warn('[wx-xpay-query] notify_provide_goods 异常:', err)
      }
    }

    const stats = await statsFor(openid)

    // 7) 开发者售出通知（群机器人）。
    //    本接口是「支付成功后端上立刻调用」的兜底发货路径，通常先于平台推送完成发货；
    //    若这里不推送，后续到达的平台推送会因幂等（counted=false）跳过通知，
    //    导致道具明明卖出去了却收不到消息。
    //    deliverOrder 幂等，推送链路与本路径至多一处拿到 counted=true，不会重复打扰。
    if (counted && delivered) {
      await notifyDevOfSale({
        appid: delivered.appid || config.appid,
        productId: delivered.product_id,
        outTradeNo: delivered.out_trade_no,
        wxOrderId: delivered.wx_order_id,
        openid: delivered.openid,
        env: delivered.env,
        paidAt: delivered.paid_at,
        totalCount: stats.totalCount,
      })
    }

    return NextResponse.json({
      success: true,
      enabled: true,
      paid: true,
      delivered: true,
      platformStatus,
      counted,
      ...stats,
    })
  } catch (error) {
    console.error('[wx-xpay-query] 查询异常:', error)
    return NextResponse.json(
      {
        success: false,
        enabled: true,
        errcode: -99,
        errmsg: (error as Error).message || '查询失败',
        paid: false,
        delivered: false,
        platformStatus: -1,
      },
      { status: 200 }
    )
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 })
}
