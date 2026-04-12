import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'

interface PriceItem {
  id: string
  name: string
  description?: string
  unit?: string
  price?: string
  priceTable?: {
    headers: string[]
    rows: string[]
  }
  notes?: string
}

interface PriceCategory {
  id: string
  name: string
  icon: string
  items: PriceItem[]
}

interface PriceGuideData {
  updateDate: string
  categories: PriceCategory[]
}

export async function POST(request: NextRequest) {
  try {
    const data: PriceGuideData = await request.json()

    if (!data.categories || data.categories.length === 0) {
      return NextResponse.json(
        { error: '数据不能为空' },
        { status: 400 }
      )
    }

    // 保存到 public/feeds 目录
    const feedsDir = join(process.cwd(), 'public', 'feeds')
    if (!existsSync(feedsDir)) {
      await mkdir(feedsDir, { recursive: true })
    }

    const filePath = join(feedsDir, 'price_guide.json')
    // 使用压缩格式（去除空格和换行）
    await writeFile(filePath, JSON.stringify(data))

    return NextResponse.json({
      success: true,
      message: '价格指南已发布',
      filePath: '/feeds/price_guide.json'
    })

  } catch (error) {
    console.error('Save error:', error)
    return NextResponse.json(
      { error: '保存失败: ' + (error as Error).message },
      { status: 500 }
    )
  }
}

// 获取当前价格指南数据
export async function GET() {
  try {
    const { existsSync, readFileSync } = require('fs')
    const { join } = require('path')
    
    const filePath = join(process.cwd(), 'public', 'feeds', 'price_guide.json')
    
    if (!existsSync(filePath)) {
      return NextResponse.json({
        updateDate: '',
        categories: []
      })
    }

    const data = JSON.parse(readFileSync(filePath, 'utf-8'))
    return NextResponse.json(data)

  } catch (error) {
    console.error('Get error:', error)
    return NextResponse.json(
      { error: '获取失败: ' + (error as Error).message },
      { status: 500 }
    )
  }
}
