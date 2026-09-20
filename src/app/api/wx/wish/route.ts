import { NextRequest, NextResponse } from 'next/server'
import { createWish, listWishes } from '@/lib/wx-wish'

/**
 * POST /api/wx/wish
 *
 * 小程序支付成功后创建一条心愿记录。
 *
 * 请求体：
 * {
 *   "code": string,           // 必填，wx.login() 换取 openid
 *   "content": string,        // 必填，心愿内容（<= 120 字）
 *   "makeTradeNo": string,    // 必填，许愿支付订单号
 *   "appid"?: string          // 可选，多小程序共用本接口时必传
 * }
 *
 * 响应体：
 * {
 *   "success": boolean,
 *   "wish"?: MiniWishRow,
 *   "errcode"?: number,
 *   "errmsg"?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const code: string = (body?.code || '').toString()
    const content: string = (body?.content || '').toString()
    const makeTradeNo: string = (body?.makeTradeNo || '').toString()
    const requestAppid: string = (body?.appid || '').toString().trim()

    if (!code) {
      return NextResponse.json(
        { success: false, errcode: -1, errmsg: '缺少登录 code' },
        { status: 400 }
      )
    }
    if (!content.trim()) {
      return NextResponse.json(
        { success: false, errcode: -2, errmsg: '缺少心愿内容' },
        { status: 400 }
      )
    }
    if (!makeTradeNo) {
      return NextResponse.json(
        { success: false, errcode: -3, errmsg: '缺少支付订单号' },
        { status: 400 }
      )
    }

    const wish = await createWish({ appid: requestAppid, code, content, makeTradeNo })

    return NextResponse.json({ success: true, wish }, { status: 200 })
  } catch (error) {
    const message = (error as Error).message || '创建心愿失败'
    console.error('[api/wx/wish POST]', error)
    return NextResponse.json({ success: false, errcode: -99, errmsg: message }, { status: 400 })
  }
}

/**
 * GET /api/wx/wish?code=...&appid=...
 *
 * 查询当前登录用户的心愿列表（不含已删除）。
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code') || ''
    const requestAppid = searchParams.get('appid') || ''

    if (!code) {
      return NextResponse.json(
        { success: false, errcode: -1, errmsg: '缺少登录 code' },
        { status: 400 }
      )
    }

    const wishes = await listWishes(requestAppid || undefined, code)

    return NextResponse.json({ success: true, wishes }, { status: 200 })
  } catch (error) {
    const message = (error as Error).message || '查询心愿失败'
    console.error('[api/wx/wish GET]', error)
    return NextResponse.json({ success: false, errcode: -99, errmsg: message }, { status: 400 })
  }
}
