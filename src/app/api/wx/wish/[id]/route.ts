import { NextRequest, NextResponse } from 'next/server'
import { deleteWish, fulfillWish } from '@/lib/wx-wish'

/**
 * PATCH /api/wx/wish/:id
 *
 * 还愿：更新指定心愿为 fulfilled 状态。
 *
 * 请求体：
 * {
 *   "code": string,              // 必填
 *   "fulfillTradeNo": string,    // 必填，还愿支付订单号
 *   "appid"?: string             // 可选
 * }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json().catch(() => ({}))
    const code: string = (body?.code || '').toString()
    const fulfillTradeNo: string = (body?.fulfillTradeNo || '').toString()
    const requestAppid: string = (body?.appid || '').toString().trim()

    if (!code) {
      return NextResponse.json(
        { success: false, errcode: -1, errmsg: '缺少登录 code' },
        { status: 400 }
      )
    }
    if (!fulfillTradeNo) {
      return NextResponse.json(
        { success: false, errcode: -2, errmsg: '缺少还愿支付订单号' },
        { status: 400 }
      )
    }

    const wish = await fulfillWish({
      appid: requestAppid,
      code,
      wishId: id,
      fulfillTradeNo,
    })

    return NextResponse.json({ success: true, wish }, { status: 200 })
  } catch (error) {
    const message = (error as Error).message || '还愿失败'
    console.error('[api/wx/wish PATCH]', error)
    return NextResponse.json({ success: false, errcode: -99, errmsg: message }, { status: 400 })
  }
}

/**
 * DELETE /api/wx/wish/:id?code=...&appid=...
 *
 * 软删除当前用户的心愿。
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code') || ''
    const requestAppid = searchParams.get('appid') || ''

    if (!code) {
      return NextResponse.json(
        { success: false, errcode: -1, errmsg: '缺少登录 code' },
        { status: 400 }
      )
    }

    await deleteWish(requestAppid || undefined, code, id)

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    const message = (error as Error).message || '删除心愿失败'
    console.error('[api/wx/wish DELETE]', error)
    return NextResponse.json({ success: false, errcode: -99, errmsg: message }, { status: 400 })
  }
}
