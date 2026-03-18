import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

export async function GET() {
  try {
    const tmpDir = join(tmpdir(), 'school-zone')
    const detailPath = join(tmpDir, 'detail.json')
    
    if (!existsSync(detailPath)) {
      return NextResponse.json(
        { error: '没有可预览的数据，请先上传并处理Excel文件' },
        { status: 404 }
      )
    }

    const detailContent = await readFile(detailPath, 'utf-8')
    const data = JSON.parse(detailContent)

    return NextResponse.json({
      success: true,
      data
    })

  } catch (error) {
    console.error('Preview error:', error)
    return NextResponse.json(
      { error: '获取预览数据失败: ' + (error as Error).message },
      { status: 500 }
    )
  }
}
