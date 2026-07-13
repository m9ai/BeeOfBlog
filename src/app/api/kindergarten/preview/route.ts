import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

export async function GET() {
  try {
    const tmpDir = join(tmpdir(), 'kindergarten-zone')
    const resultPath = join(tmpDir, 'result.json')

    if (!existsSync(resultPath)) {
      return NextResponse.json(
        { error: '没有可预览的幼儿园数据，请先上传并处理Excel文件' },
        { status: 404 }
      )
    }

    const resultContent = await readFile(resultPath, 'utf-8')
    const data = JSON.parse(resultContent)

    return NextResponse.json({
      success: true,
      data
    })

  } catch (error) {
    console.error('Kindergarten preview error:', error)
    return NextResponse.json(
      { error: '获取预览数据失败: ' + (error as Error).message },
      { status: 500 }
    )
  }
}
