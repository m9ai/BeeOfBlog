import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir, unlink, rmdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { createWorker } from 'tesseract.js'

// 使用 dynamic import 来避免构建时加载 pdfjs-dist
let pdfjs: any = null

async function getPdfjs() {
  if (!pdfjs) {
    pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const path = await import('path')
    const workerPath = path.join(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')
    pdfjs.GlobalWorkerOptions.workerSrc = 'file://' + workerPath
  }
  return pdfjs
}

interface PriceItem {
  id: string
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

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  '水电气': ['自来水', '电力', '燃气', '水费', '电费', '煤气', '天然气'],
  '公共汽（电）车、轨道交通': ['公交', '地铁', '轨道交通', '公共汽车', '电车'],
  '市域巡游出租车': ['出租车', '的士', '出租汽车', '起租价', '公里价'],
  '黄浦江过江轮渡': ['轮渡', '过江', '黄浦江', '渡轮'],
  '有线电视': ['有线电视', '收视费', '机顶盒'],
  '证件申领': ['证件', '身份证', '护照', '驾照', '驾驶证'],
  '医疗服务': ['医疗', '挂号', '诊查', '床位', '手术'],
  '教育': ['教育', '学费', '幼儿园', '小学', '中学', '高校'],
  '景区门票': ['景区', '门票', '公园', '博物馆', '展览'],
  '高速公路': ['高速', '公路', '通行费', '收费站'],
  '高速公路清障救援': ['清障', '救援', '拖车', '抢修'],
  '机动车停放': ['停车', '停放', '停车费', '泊位', '车库'],
  '不动产登记': ['不动产', '登记', '房产', '契税', '印花税']
}

export async function POST(request: NextRequest) {
  const tempDir = join(tmpdir(), `pdf-ocr-${Date.now()}`)
  let worker: Awaited<ReturnType<typeof createWorker>> | null = null
  
  try {
    console.log('[OCR] 开始处理...')
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: '请选择 PDF 文件' }, { status: 400 })
    }

    if (!file.name.endsWith('.pdf')) {
      return NextResponse.json({ error: '请上传 PDF 文件' }, { status: 400 })
    }

    await mkdir(tempDir, { recursive: true })

    const buffer = Buffer.from(await file.arrayBuffer())
    const pdfPath = join(tempDir, 'input.pdf')
    await writeFile(pdfPath, buffer)
    console.log('[OCR] PDF 已保存，大小:', buffer.length)

    // 使用 pdfjs-dist 渲染 PDF
    const pdfjsLib = await getPdfjs()
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise
    const pageCount = pdf.numPages
    console.log('[OCR] PDF 页数:', pageCount)

    // 只处理前2页
    const pagesToProcess = Math.min(pageCount, 2)
    const allText: string[] = []

    console.log('[OCR] 初始化 Tesseract...')
    worker = await createWorker('chi_sim+eng')
    console.log('[OCR] Tesseract 就绪')

    for (let i = 1; i <= pagesToProcess; i++) {
      try {
        console.log(`[OCR] 处理第 ${i} 页...`)
        const page = await pdf.getPage(i)
        
        const scale = 1.5
        const viewport = page.getViewport({ scale })
        
        // 使用 node-canvas
        const { createCanvas } = await import('canvas')
        const canvas = createCanvas(viewport.width, viewport.height)
        const context = canvas.getContext('2d')
        
        await page.render({ canvasContext: context as any, viewport }).promise
        
        const imageBuffer = canvas.toBuffer('image/png')
        console.log(`[OCR] 第 ${i} 页渲染完成，图片大小:`, imageBuffer.length)
        
        const { data: { text } } = await worker.recognize(imageBuffer)
        allText.push(text)
        console.log(`[OCR] 第 ${i} 页识别完成，字数:`, text.length)
      } catch (err) {
        console.error(`[OCR] 第 ${i} 页失败:`, err)
      }
    }

    await worker.terminate()
    console.log('[OCR] Worker 已终止')

    const fullText = allText.join('\n')
    console.log('[OCR] 识别文本长度:', fullText.length)

    const categories = parsePriceText(fullText)
    const totalItems = categories.reduce((sum, c) => sum + c.items.length, 0)
    console.log('[OCR] 解析结果:', totalItems, '条')

    // 清理临时文件
    try {
      if (existsSync(pdfPath)) await unlink(pdfPath)
      if (existsSync(tempDir)) await rmdir(tempDir)
    } catch (e) {
      console.log('[OCR] 清理失败:', e)
    }

    return NextResponse.json({
      success: true,
      categories,
      rawText: fullText.substring(0, 2000),
      message: `成功识别 ${totalItems} 条价格信息`
    })

  } catch (error) {
    console.error('[OCR] 错误:', error)
    if (worker) await worker.terminate().catch(() => {})
    return NextResponse.json(
      { error: '识别失败: ' + (error as Error).message },
      { status: 500 }
    )
  }
}

function parsePriceText(text: string): PriceCategory[] {
  const lines = text.split('\n').filter(line => line.trim())
  
  const categories: PriceCategory[] = Object.entries(CATEGORY_KEYWORDS).map(([name], index) => ({
    id: `cat-${index}`,
    name,
    icon: getIconForCategory(name),
    items: []
  }))

  let currentCategory: PriceCategory | null = null
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    
    for (const cat of categories) {
      if (isCategoryMatch(line, cat.name)) {
        currentCategory = cat
        break
      }
    }
    
    if (currentCategory) {
      const item = extractPriceItem(line, lines[i + 1], lines[i - 1])
      if (item && !isDuplicate(currentCategory.items, item)) {
        currentCategory.items.push(item)
      }
    }
  }

  return categories.filter(cat => cat.items.length > 0)
}

function isCategoryMatch(line: string, categoryName: string): boolean {
  if (line.includes(categoryName)) return true
  const keywords = CATEGORY_KEYWORDS[categoryName]
  if (!keywords) return false
  let count = 0
  for (const kw of keywords) {
    if (line.includes(kw)) count++
    if (count >= 2) return true
  }
  return false
}

function extractPriceItem(line: string, nextLine?: string, prevLine?: string): PriceItem | null {
  const pricePatterns = [
    /(\d+\.?\d*)\s*元/,
    /(\d+\.?\d*)\s*元\/\w+/,
    /(\d+\.?\d*)\s*-\s*(\d+\.?\d*)\s*元/,
    /¥(\d+\.?\d*)/,
    /(\d+\.?\d*)\s*\/\s*\w+/,
    /首?\s*(\d+)\s*公里/,
    /起租价\s*(\d+\.?\d*)/
  ]
  
  let price: string | undefined
  for (const pattern of pricePatterns) {
    const match = line.match(pattern)
    if (match) { price = match[0]; break }
  }
  
  if (!price && nextLine) {
    for (const pattern of pricePatterns) {
      const match = nextLine.match(pattern)
      if (match) { price = match[0]; break }
    }
  }
  
  let name = line.replace(/\d+\.?\d*\s*[元¥\/\-].*$/, '').trim()
  if (name.length < 3 && prevLine) name = prevLine + ' ' + name
  if (!name || name.length < 2 || /\d{4}年|第\d+页|来源：/.test(name)) return null
  
  const unitMatch = line.match(/\/(立方米|度|次|人|天|月|年|小时|公里|张|件|床)/)
  const unit = unitMatch ? unitMatch[1] : undefined
  
  const notes = line.length > 30 ? line.substring(30).trim().substring(0, 100) : undefined
  
  return {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    name: name.substring(0, 50),
    unit,
    price,
    notes
  }
}

function isDuplicate(items: PriceItem[], newItem: PriceItem): boolean {
  return items.some(item => item.name === newItem.name && item.price === newItem.price)
}

function getIconForCategory(name: string): string {
  const icons: Record<string, string> = {
    '水电气': '💧', '公共汽（电）车、轨道交通': '🚌', '市域巡游出租车': '🚕',
    '黄浦江过江轮渡': '⛴️', '有线电视': '📺', '证件申领': '🪪',
    '医疗服务': '🏥', '教育': '🎓', '景区门票': '🏞️',
    '高速公路': '🛣️', '高速公路清障救援': '🚑', '机动车停放': '🅿️', '不动产登记': '🏠'
  }
  return icons[name] || '📋'
}
