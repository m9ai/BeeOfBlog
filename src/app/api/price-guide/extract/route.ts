import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir, readFile, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import pdfplumber from 'pdfplumber'

interface PriceItem {
  name: string
  description?: string
  unit?: string
  price?: string
  notes?: string
}

interface PriceCategory {
  id: string
  name: string
  icon: string
  items: PriceItem[]
}

// PDF 页码到类别的映射（根据目录）
const PAGE_CATEGORIES: Record<number, { id: string; name: string; icon: string }> = {
  3: { id: 'water', name: '水电气', icon: '💧' },
  4: { id: 'transport', name: '公共汽（电）车、轨道交通', icon: '🚌' },
  5: { id: 'taxi', name: '市域巡游出租车', icon: '🚕' },
  6: { id: 'ferry', name: '黄浦江过江轮渡', icon: '⛴️' },
  7: { id: 'tv', name: '有线电视', icon: '📺' },
  8: { id: 'certificate', name: '证件申领', icon: '🪪' },
  9: { id: 'medical', name: '医疗服务', icon: '🏥' },
  13: { id: 'education', name: '教育', icon: '🎓' },
  17: { id: 'scenic', name: '景区门票', icon: '🏞️' },
  18: { id: 'highway', name: '高速公路', icon: '🛣️' },
  20: { id: 'rescue', name: '高速公路清障救援', icon: '🚑' },
  21: { id: 'parking', name: '机动车停放', icon: '🅿️' },
  22: { id: 'property', name: '不动产登记', icon: '🏠' },
}

// 使用 Gemini API 识别图像中的表格数据
async function extractWithGemini(imageBase64: string, categoryName: string): Promise<PriceItem[]> {
  const apiKey = process.env.GEMINI_API_KEY
  
  if (!apiKey) {
    throw new Error('未配置 GEMINI_API_KEY 环境变量')
  }

  const prompt = `请识别图片中的价格表格数据，这是《上海市市民价格信息指南》中的"${categoryName}"部分。

请仔细识别表格中的每一行，提取以下信息：
1. 项目名称（如：居民生活用水、普通门诊诊查费等）
2. 说明/描述（如有，如：市属供排水企业服务区域）
3. 单位（如：元/立方米、元/次）
4. 价格（如：2.25、18）
5. 备注（如分档信息、适用条件等）

请以 JSON 数组格式返回，格式如下：
[
  {
    "name": "项目名称",
    "description": "说明描述（可选）",
    "unit": "单位（可选）",
    "price": "价格（可选，保持原始文本）",
    "notes": "备注（可选）"
  }
]

如果无法识别某些字段，可以留空或省略。请确保返回有效的 JSON 格式，不要添加任何解释文字。`

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: 'image/png',
                  data: imageBase64
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 4096
        }
      })
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Gemini API 错误: ${error}`)
  }

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text

  if (!text) {
    throw new Error('Gemini 返回空结果')
  }

  // 提取 JSON
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) {
    throw new Error('无法从响应中解析 JSON')
  }

  try {
    const items = JSON.parse(jsonMatch[0])
    return items.map((item: any) => ({
      name: item.name || '未命名项目',
      description: item.description || '',
      unit: item.unit || '',
      price: item.price || '',
      notes: item.notes || ''
    }))
  } catch (e) {
    throw new Error(`JSON 解析失败: ${e}`)
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: '请选择 PDF 文件' },
        { status: 400 }
      )
    }

    // 保存临时文件
    const tmpDir = join(tmpdir(), 'price-guide')
    if (!existsSync(tmpDir)) {
      await mkdir(tmpDir, { recursive: true })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const pdfPath = join(tmpDir, 'input.pdf')
    await writeFile(pdfPath, buffer)

    // 提取日期（从第3页）
    let updateDate = new Date().getFullYear() + '年'
    
    // 处理每一页
    const categories: PriceCategory[] = []
    
    with pdfplumber.open(pdfPath) as pdf:
      // 从第3页获取日期
      try {
        const datePage = pdf.pages[2]
        const dateText = datePage.extract_text() || ''
        const dateMatch = dateText.match(/(\d{4})年/)
        if (dateMatch) {
          updateDate = dateMatch[1] + '年'
        }
      } catch {}

      // 处理需要提取的页面
      for (const [pageNumStr, categoryInfo] of Object.entries(PAGE_CATEGORIES)) {
        const pageNum = parseInt(pageNumStr)
        if (pageNum >= pdf.pages.length) continue

        const page = pdf.pages[pageNum]
        
        // 将页面转为图像
        try {
          const image = page.to_image(resolution=200)
          const pngBytes = image.original
          const base64Image = Buffer.from(pngBytes).toString('base64')

          // 使用 Gemini 提取数据
          const items = await extractWithGemini(base64Image, categoryInfo.name)

          if (items.length > 0) {
            categories.push({
              id: categoryInfo.id,
              name: categoryInfo.name,
              icon: categoryInfo.icon,
              items
            })
          }
        } catch (pageError) {
          console.error(`处理第 ${pageNum + 1} 页失败:`, pageError)
        }
      }
    }

    // 清理临时文件
    try {
      await unlink(pdfPath)
    } catch {}

    return NextResponse.json({
      success: true,
      data: {
        updateDate,
        categories
      }
    })

  } catch (error) {
    console.error('Extract error:', error)
    return NextResponse.json(
      { error: '提取失败: ' + (error as Error).message },
      { status: 500 }
    )
  }
}
