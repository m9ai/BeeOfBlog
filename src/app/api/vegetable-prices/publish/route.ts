import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

export async function POST(request: NextRequest) {
  try {
    // 读取临时文件
    const tmpDir = join(tmpdir(), 'vegetable-prices')
    const resultPath = join(tmpDir, 'result.json')

    if (!existsSync(resultPath)) {
      return NextResponse.json(
        { error: '没有找到已处理的数据，请先上传并处理文件' },
        { status: 400 }
      )
    }

    // 读取处理后的数据
    const data = await readFile(resultPath, 'utf-8')
    const priceData = JSON.parse(data)

    // 确定输出路径
    const outputDir = join(process.cwd(), 'public', 'feeds')
    if (!existsSync(outputDir)) {
      await mkdir(outputDir, { recursive: true })
    }

    const publishedFiles: string[] = []

    // 为每个区县生成单独的JSON文件
    if (priceData.districts && Array.isArray(priceData.districts)) {
      for (const districtData of priceData.districts) {
        const districtName = districtData.district
        // 生成文件名：将区县名称中的特殊字符替换
        const safeFileName = districtName.replace(/[\\/:*?"<>|]/g, '_')
        const fileName = `vegetable_prices_${safeFileName}.json`
        const outputPath = join(outputDir, fileName)
        
        // 单个区县的数据结构
        const singleDistrictData = {
          updateDate: priceData.updateDate,
          district: districtName,
          markets: districtData.markets || []
        }
        
        await writeFile(outputPath, JSON.stringify(singleDistrictData, null, 2), 'utf-8')
        publishedFiles.push(fileName)
      }
    }

    // 同时生成一个包含所有区县的完整数据文件（供后台使用）
    const fullOutputPath = join(outputDir, 'vegetable_prices_full.json')
    await writeFile(fullOutputPath, JSON.stringify(priceData, null, 2), 'utf-8')
    publishedFiles.push('vegetable_prices_full.json')

    // 清理临时文件
    try {
      const { unlink } = await import('fs/promises')
      await unlink(resultPath)
    } catch {
      // 忽略清理错误
    }

    return NextResponse.json({
      success: true,
      message: '发布成功',
      data: {
        updateDate: priceData.updateDate,
        districtCount: priceData.districts?.length || 0,
        publishedFiles: publishedFiles
      }
    })

  } catch (error) {
    console.error('Publish error:', error)
    return NextResponse.json(
      { error: '发布失败: ' + (error as Error).message },
      { status: 500 }
    )
  }
}
