import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()

    // 验证数据格式
    if (!Array.isArray(data)) {
      return NextResponse.json(
        { error: '数据格式错误' },
        { status: 400 }
      )
    }

    // 保存到 public/feeds/facilities.json
    const filePath = join(process.cwd(), 'public', 'feeds', 'facilities.json')
    await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('保存设施配置失败:', error)
    return NextResponse.json(
      { error: '保存失败' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const filePath = join(process.cwd(), 'public', 'feeds', 'facilities.json')

    if (!existsSync(filePath)) {
      return NextResponse.json([])
    }

    const { readFile } = await import('fs/promises')
    const content = await readFile(filePath, 'utf-8')
    const data = JSON.parse(content)

    return NextResponse.json(data)
  } catch (error) {
    console.error('读取设施配置失败:', error)
    return NextResponse.json([])
  }
}
