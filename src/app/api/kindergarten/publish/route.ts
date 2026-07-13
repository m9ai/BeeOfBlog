import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir, readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

export async function POST(request: NextRequest) {
  try {
    // 读取处理结果
    const tmpDir = join(tmpdir(), 'kindergarten-zone')
    const resultPath = join(tmpDir, 'result.json')

    if (!existsSync(resultPath)) {
      return NextResponse.json(
        { error: '没有可发布的幼儿园数据，请先上传并处理Excel文件' },
        { status: 400 }
      )
    }

    const resultContent = await readFile(resultPath, 'utf-8')
    const data = JSON.parse(resultContent)

    // 确保目标目录存在
    const targetDir = join(process.cwd(), 'public', 'feeds')
    if (!existsSync(targetDir)) {
      await mkdir(targetDir, { recursive: true })
    }

    // 写入幼儿园数据文件
    const filePath = join(targetDir, 'kindergarten_data.json')
    await writeFile(filePath, JSON.stringify(data), 'utf-8')

    return NextResponse.json({
      success: true,
      fileName: 'kindergarten_data.json',
      message: `成功发布幼儿园学区数据，共 ${data.kindergartenSchools.length} 所幼儿园`
    })

  } catch (error) {
    console.error('Kindergarten publish error:', error)
    return NextResponse.json(
      { error: '发布失败: ' + (error as Error).message },
      { status: 500 }
    )
  }
}
