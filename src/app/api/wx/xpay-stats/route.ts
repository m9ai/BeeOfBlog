import { NextRequest, NextResponse } from 'next/server'
import { XPAY_PRODUCT_META, code2Session, getSupportStats, getXpayConfig } from '@/lib/wx-xpay'

/**
 * GET /api/wx/xpay-stats?code=xxx
 *
 * 助力数据：累计助力份数 / 参与人数（可选返回「我的助力份数」）。
 *
 * ## 为什么不带 code 也要能调
 *   班次页每次展示都要显示「N 人已助力」，若每次都先 wx.login 再去统计，
 *   会白白多一次 code2Session。所以统计口径全部在服务端聚合，
 *   端上不带 code 时只返回公共数字；带 code 时额外返回 myCount。
 *
 * ## 限定
 *   本接口只暴露聚合数字，不返回任何 openid，避免泄露用户标识。
 */

export async function GET(request: NextRequest) {
  const { config, missing } = getXpayConfig()

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

    const stats = await getSupportStats(config, config.productId, openid || undefined)

    return NextResponse.json({
      success: true,
      enabled: true,
      productId: config.productId,
      productName: XPAY_PRODUCT_META[config.productId]?.name || config.productId,
      productDesc: XPAY_PRODUCT_META[config.productId]?.desc || '',
      priceFen: config.priceFen,
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
