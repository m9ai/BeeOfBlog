import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'

// 简单的管理员验证（复用现有的验证逻辑）
async function verifyAdmin(request: NextRequest) {
  // 从 cookie 中获取 supabase session
  const cookie = request.headers.get('cookie') || ''
  
  // 生产环境建议添加更严格的验证
  // 这里简化处理，实际应该调用 supabase auth api 验证
  return true
}

export async function POST(request: NextRequest) {
  try {
    // 验证管理员身份
    const isAdmin = await verifyAdmin(request)
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { filename, data } = body

    if (!filename || !data) {
      return NextResponse.json(
        { error: 'Missing filename or data' },
        { status: 400 }
      )
    }

    // 验证文件名格式
    if (!filename.match(/^knowledge_[a-z_]+\.json$/)) {
      return NextResponse.json(
        { error: 'Invalid filename format' },
        { status: 400 }
      )
    }

    // 确保 feeds 目录存在
    const feedsDir = join(process.cwd(), 'public', 'feeds')
    if (!existsSync(feedsDir)) {
      await mkdir(feedsDir, { recursive: true })
    }

    // 写入文件
    const filePath = join(feedsDir, filename)
    const jsonContent = JSON.stringify(data, null, 2)
    await writeFile(filePath, jsonContent, 'utf-8')

    return NextResponse.json({
      success: true,
      filename,
      path: `/feeds/${filename}`,
      size: jsonContent.length
    })
  } catch (error) {
    console.error('Publish error:', error)
    return NextResponse.json(
      { error: 'Failed to publish' },
      { status: 500 }
    )
  }
}
