import { NextRequest, NextResponse } from 'next/server'
import { code2Session, findXpayProduct, getSupportStats, getXpayConfig, listXpayProducts } from '@/lib/wx-xpay'

/**
 * GET /api/wx/xpay-stats?code=xxx&appid=xxx
 *
 * 助力数据：累计助力份数 / 参与人数（可选返回「我的助力份数」）。
 *
 * ## 多租户
 *   query 参数 `appid`（wx.getAccountInfoSync().miniProgram.appId，公开信息）
 *   指定统计哪款小程序的道具；未传时回退默认小程序（金铁，WX_APPID）。
 *   统计按订单表 appid 隔离，各小程序的助力数互不污染。
 *
 * ## code 与 myCount
 *   myCount（我的助力）必须由 code2Session 解出 openid 才能计算，
 *   因此端上每次统计都会先 wx.login 带 code 上来（code 单次有效，不可复用）。
 *   code 缺失或 code2Session 失败时只返回公共数字，myCount 为 0。
 *
 * ## 限定
 *   本接口只暴露聚合数字，不返回任何 openid，避免泄露用户标识。
 */

export async function GET(request: NextRequest) {
  const requestAppid = request.nextUrl.searchParams.get('appid') || ''
  const { config, missing } = getXpayConfig(requestAppid || undefined)

  if (!config) {
    return NextResponse.json({
      success: true,
      enabled: false,
      errcode: -100,
      errmsg: '功能准备中，敬请期待',
      missing,
      totalCount: 0,
      supporterCount: 0,
      myCount: 0,
    })
  }

  try {
    const code = request.nextUrl.searchParams.get('code') || ''
    let openid = ''
    if (code) {
      try {
        openid = (await code2Session(config.appid, config.secret, code)).openid
      } catch (err) {
        // code 过期/复用：只影响 myCount，不影响公共数字
        console.warn('[wx-xpay-stats] code2Session 失败，仅返回公共统计:', (err as Error).message)
      }
    }

    // 端上可指定道具（多道具场景）；不传时默认该小程序注册表的第一个，
    // 兼容班次页 banner 的现有调用（未传 appid = 金铁 = 原默认行为）
    const productId =
      request.nextUrl.searchParams.get('productId') || listXpayProducts(config.appid)[0]?.productId || ''
    const product = findXpayProduct(config.appid, productId)
    if (!product) {
      return NextResponse.json(
        { success: false, enabled: true, errcode: -2, errmsg: '该道具暂未上架', totalCount: 0, supporterCount: 0, myCount: 0 },
        { status: 400 }
      )
    }

    const stats = await getSupportStats(config, product.productId, openid || undefined)

    return NextResponse.json({
      success: true,
      enabled: true,
      productId: product.productId,
      productName: product.name,
      productDesc: product.desc,
      priceFen: product.priceFen,
      ...stats,
    })
  } catch (error) {
    console.error('[wx-xpay-stats] 统计异常:', error)
    return NextResponse.json(
      {
        success: false,
        enabled: true,
        errcode: -99,
        errmsg: (error as Error).message || '统计失败',
        totalCount: 0,
        supporterCount: 0,
        myCount: 0,
      },
      { status: 200 }
    )
  }
}
