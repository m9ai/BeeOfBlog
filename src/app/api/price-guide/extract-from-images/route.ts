import { NextRequest, NextResponse } from 'next/server'
import { createWorker } from 'tesseract.js'
import * as path from 'path'

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

interface LogEntry {
  time: string
  step: string
  message: string
  details?: any
}

// 类别关键词映射
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  '水电气': ['水电气', '自来水', '电力', '燃气', '水费', '电费', '煤气', '天然气', '供排水'],
  '公共汽（电）车、轨道交通': ['公交', '地铁', '轨道交通', '公共汽车', '电车', '票价'],
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

// Tesseract worker 配置
const WORKER_PATH = path.join(process.cwd(), 'node_modules/tesseract.js/src/worker-script/node/index.js')

// 配置超时为 10 分钟
export const maxDuration = 600
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const logs: LogEntry[] = []
  const addLog = (step: string, message: string, details?: any) => {
    const entry = { time: new Date().toISOString(), step, message, details }
    logs.push(entry)
    console.log(`[OCR-${step}] ${message}`, details || '')
  }

  let worker: Awaited<ReturnType<typeof createWorker>> | null = null
  
  try {
    addLog('START', '开始处理请求')
    
    const formData = await request.formData()
    const files = formData.getAll('images') as File[]
    addLog('PARSE', `收到 ${files.length} 个文件`)

    if (!files || files.length === 0) {
      return NextResponse.json({ error: '请选择图片文件', logs }, { status: 400 })
    }

    addLog('INIT', '初始化 Tesseract worker...')
    worker = await createWorker('chi_sim+eng', 1, {
      workerPath: WORKER_PATH,
      logger: m => {
        if (m.status === 'recognizing text') {
          addLog('PROGRESS', `${(m.progress * 100).toFixed(1)}%`)
        }
      }
    })
    addLog('INIT', 'Worker 就绪')

    const allText: string[] = []
    const imageResults: any[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const imgStart = Date.now()
      
      try {
        const buffer = Buffer.from(await file.arrayBuffer())
        const { data: { text } } = await worker.recognize(buffer)
        allText.push(text)
        imageResults.push({ index: i, name: file.name, success: true, textLength: text.length, timeMs: Date.now() - imgStart })
        addLog(`IMG-${i+1}`, `完成，${text.length} 字符`)
      } catch (err) {
        imageResults.push({ index: i, name: file.name, success: false, error: (err as Error).message })
        allText.push('')
      }
    }

    await worker.terminate()

    const fullText = allText.join('\n')
    addLog('PARSE', `总文本 ${fullText.length} 字符`)

    // 解析价格信息
    const categories = parsePriceText(fullText, addLog)
    const totalItems = categories.reduce((sum, c) => sum + c.items.length, 0)
    addLog('RESULT', `${categories.length} 类别，${totalItems} 条价格`)

    return NextResponse.json({
      success: true,
      categories,
      rawText: fullText.substring(0, 3000),
      message: `识别 ${totalItems} 条价格信息`,
      debug: { logs, imageResults, totalImages: files.length, successImages: imageResults.filter(r => r.success).length }
    })

  } catch (error) {
    addLog('ERROR', (error as Error).message)
    if (worker) await worker.terminate().catch(() => {})
    return NextResponse.json({ error: '识别失败: ' + (error as Error).message, logs }, { status: 500 })
  }
}

function parsePriceText(text: string, addLog: (step: string, msg: string) => void): PriceCategory[] {
  const log = (msg: string) => {
    console.log('[Parse]', msg)
    addLog('PARSE', msg)
  }
  
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  log(`总行数: ${lines.length}`)
  
  // 初始化类别
  const categories: PriceCategory[] = Object.keys(CATEGORY_KEYWORDS).map((name, index) => ({
    id: `cat-${index}`,
    name,
    icon: getIconForCategory(name),
    items: []
  }))

  // 遍历每一行查找价格
  let currentCategory: string | null = null
  let lastCategoryLine = -1
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    // 1. 匹配类别
    for (const [catName, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      for (const kw of keywords) {
        if (line.includes(kw)) {
          currentCategory = catName
          lastCategoryLine = i
          log(`类别 "${catName}" 在行 ${i}`)
          break
        }
      }
    }
    
    // 2. 提取价格（包含 "元" 的行）
    if (line.includes('元') && /\d/.test(line)) {
      const item = extractPriceItem(line)
      if (item && currentCategory) {
        const cat = categories.find(c => c.name === currentCategory)
        if (cat && !isDuplicate(cat.items, item)) {
          cat.items.push(item)
          log(`提取: ${item.name} = ${item.price}`)
        }
      }
    }
  }

  categories.forEach(cat => log(`"${cat.name}": ${cat.items.length} 项`))
  return categories.filter(cat => cat.items.length > 0)
}

function extractPriceItem(line: string): PriceItem | null {
  // 匹配价格模式
  const priceMatch = line.match(/(\d+\.\d{1,2}|\d+)\s*元/)
  if (!priceMatch) return null
  
  const price = priceMatch[0]
  const priceIndex = line.indexOf(price)
  
  // 提取名称（价格前的文字）
  let name = priceIndex > 0 ? line.substring(0, priceIndex).trim() : line
  name = name.replace(/^[\d\s\.\-]+/, '').trim()
  
  // 过滤无效内容
  if (!name || name.length < 2) return null
  if (/^(第?\d+[页节]|\d{4}年|来源|网址|备注|说明)/.test(name)) return null
  
  // 提取单位
  const unitMatch = line.match(/\/(立方米|度|次|人|天|月|年|小时|公里|张|件)/)
  const unit = unitMatch ? unitMatch[1] : undefined
  
  return {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    name: name.substring(0, 50),
    unit,
    price,
    notes: undefined
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
