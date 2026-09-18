import { NextRequest, NextResponse } from 'next/server'
import {
  XPAY_PRODUCT_META,
  buildPaySig,
  buildSignature,
  code2Session,
  genOutTradeNo,
  getXpayConfig,
  insertOrder,
} from '@/lib/wx-xpay'

/**
 * POST /api/wx/xpay-order
 *
 * 虚拟支付「道具直购」下单签名接口。
 * 文档：https://developers.weixin.qq.com/miniprogram/dev/platform-capabilities/business-capabilities/virtual-payment/person.html
 *
 * ## 为什么 session_key 不落库、不缓存
 *   signature 的密钥就是 session_key，而 session_key 会随每次 code2Session 变化，
 *   缓存复用极易踩到 -15007（session_key 过期）/ -15005（签名无效）。
 *   所以本接口每次都要求端上传一个新 code：取到 session_key → 当场签名 → 用完即弃。
 *   好处是服务端不需要存储这个敏感值。
 *
 * ## 请求体
 *   { code: string, productId?: string }
 *
 * ## 响应体
 *   未配置虚拟支付时（配置缺失 / 尚未开通）：
 *     { success: false, enabled: false, errcode: -100, errmsg: '功能准备中，敬请期待' }
 *   正常：
 *     { success: true, enabled: true, mode: 'short_series_goods',
 *       signData, paySig, signature, outTradeNo, priceFen, productName }
 *
 * ## 错误响应
 *   400 { success: false, enabled: true, errcode, errmsg }
 */

export async function POST(request: NextRequest) {
  const { config, missing } = getXpayConfig()

  if (!config) {
    // 未开通/未配置：不是错误，是「功能未上线」，用 200 返回，避免端上误报网络异常
    console.warn('[wx-xpay-order] 虚拟支付未配置，缺失:', missing.join(', '))
    return NextResponse.json(
      { success: false, enabled: false, errcode: -100, errmsg: '功能准备中，敬请期待' },
      { status: 200 }
    )
  }

  try {
    const body = await request.json().catch(() => ({}))
    const code: string = (body?.code || '').toString()
    const productId: string = (body?.productId || '').toString() || config.productId

    if (!code) {
      return NextResponse.json(
        { success: false, enabled: true, errcode: -1, errmsg: '缺少登录 code' },
        { status: 400 }
      )
    }

    if (productId !== config.productId) {
      return NextResponse.json(
        { success: false, enabled: true, errcode: -2, errmsg: '该道具暂未上架' },
        { status: 400 }
      )
    }

    // 1) 换取 openid + session_key（code 一次性、约 5 分钟有效）
    const { openid, sessionKey } = await code2Session(config.appid, config.secret, code)

    // 2) 生成业务单号（8-32 位、全局唯一、只能用一次；重复使用会报 -15002）
    const outTradeNo = genOutTradeNo()

    // 3) 构造 signData —— 字段顺序固定，签名与下发必须是同一个字符串
    //    注意：道具直购的 signData 不允许出现 platform 字段，多字段直接 -15005
    const signDataObj = {
      offerId: config.offerId,
      buyQuantity: config.buyQuantity,
      env: config.env,
      currencyType: 'CNY',
      productId: config.productId,
      goodsPrice: config.priceFen,
      outTradeNo,
      attach: 'train-home',
    }
    const signData = JSON.stringify(signDataObj)

    // 4) 两种签名
    const paySig = buildPaySig(config.appKey, 'requestVirtualPayment', signData)
    const signature = buildSignature(sessionKey, signData)

    // 5) 先落订单（status=created），发货推送/兜底查单才有依据做幂等
    await insertOrder(config, {
      outTradeNo,
      openid,
      productId: config.productId,
      quantity: config.buyQuantity,
      goodsPrice: config.priceFen,
      attach: signDataObj.attach,
    })

    console.log(
      `[wx-xpay-order] 下单 env=${config.env} productId=${config.productId} price=${config.priceFen} outTradeNo=${outTradeNo} openid=${openid}`
    )

    return NextResponse.json({
      success: true,
      enabled: true,
      mode: 'short_series_goods',
      signData,
      paySig,
      signature,
      outTradeNo,
      priceFen: config.priceFen,
      productName: XPAY_PRODUCT_META[config.productId]?.name || config.productId,
    })
  } catch (error) {
    console.error('[wx-xpay-order] 下单异常:', error)
    return NextResponse.json(
      { success: false, enabled: true, errcode: -99, errmsg: (error as Error).message || '下单失败' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 })
}
