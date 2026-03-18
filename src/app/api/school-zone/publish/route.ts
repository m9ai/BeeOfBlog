import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir, readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

export async function POST(request: NextRequest) {
  try {
    // 读取处理结果
    const tmpDir = join(tmpdir(), 'school-zone')
    const resultPath = join(tmpDir, 'result.json')
    
    if (!existsSync(resultPath)) {
      return NextResponse.json(
        { error: '没有可发布的数据，请先上传并处理Excel文件' },
        { status: 400 }
      )
    }

    const resultContent = await readFile(resultPath, 'utf-8')
    const data = JSON.parse(resultContent)

    // 确保目标目录存在
    const targetDir = join(process.cwd(), 'public', 'feeds', 'school_data')
    if (!existsSync(targetDir)) {
      await mkdir(targetDir, { recursive: true })
    }

    // 写入各街镇的JSON文件
    let fileCount = 0
    for (const [streetName, streetData] of Object.entries(data)) {
      const fileName = `${streetName}.json`
      const filePath = join(targetDir, fileName)
      
      await writeFile(
        filePath, 
        JSON.stringify(streetData, null, 2), 
        'utf-8'
      )
      fileCount++
    }

    return NextResponse.json({
      success: true,
      fileCount,
      message: `成功发布 ${fileCount} 个街镇的学区数据`
    })

  } catch (error) {
    console.error('Publish error:', error)
    return NextResponse.json(
      { error: '发布失败: ' + (error as Error).message },
      { status: 500 }
    )
  }
}
