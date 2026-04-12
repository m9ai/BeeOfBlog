import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import * as XLSX from 'xlsx'

interface VegetablePrice {
  name: string
  category: string
  unit: string
  price: number
  trend: 'up' | 'down' | 'stable'
}

interface MarketPrices {
  market: string
  prices: VegetablePrice[]
}

interface DistrictData {
  district: string
  markets: MarketPrices[]
}

interface PriceData {
  updateDate: string
  districts: DistrictData[]
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: '请选择XLS文件' },
        { status: 400 }
      )
    }

    // 读取Excel文件
    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    
    // 使用原始数据模式以获取行和列的索引
    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][]

    if (rawData.length < 9) {
      return NextResponse.json(
        { error: '文件格式不正确，数据行数不足' },
        { status: 400 }
      )
    }

    // 提取日期 (第3行，索引2)
    const dateCell = rawData[2]?.[0]
    const dateStr = dateCell ? String(dateCell).replace('采价时间：', '').trim() : ''

    if (!dateStr) {
      return NextResponse.json(
        { error: '无法提取采价日期，请检查文件格式' },
        { status: 400 }
      )
    }

    // 获取品类信息 (第4行，索引3)
    const categories = rawData[3]?.slice(2) || []
    // 获取商品名称 (第5行，索引4)
    const items = rawData[4]?.slice(2) || []
    // 获取计量单位 (第7行，索引6)
    const units = rawData[6]?.slice(2) || []

    // 构建菜品列表
    const products: { index: number; category: string; name: string; unit: string }[] = []
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item && String(item) !== '-' && String(item) !== 'nan') {
        // 清理单位字段
        let unit = units[i] || '500g'
        unit = String(unit).replace('元/', '').trim()
        products.push({
          index: i + 2, // 列索引（从C列开始，索引2）
          category: String(categories[i] || ''),
          name: String(item),
          unit: unit
        })
      }
    }

    // 保留所有品类数据（粮食、食用油、肉禽蛋、鱼虾、蔬菜、水果等）
    if (products.length === 0) {
      return NextResponse.json(
        { error: '未找到有效的商品数据，请检查文件格式' },
        { status: 400 }
      )
    }

    // 按区提取数据 (从第9行开始，索引8)
    const districtsMap: Map<string, MarketPrices[]> = new Map()
    
    for (let i = 8; i < rawData.length; i++) {
      const row = rawData[i]
      if (!row) continue

      const district = String(row[0] || '').trim()
      // 跳过空行或非区县行（通常区县列有值）
      if (!district || district === 'nan' || district === '-') continue

      const marketName = String(row[1] || '').trim()
      if (!marketName || marketName === 'nan' || marketName === '-') continue

      const prices: VegetablePrice[] = []
      for (const product of products) {
        const priceValue = row[product.index]
        if (priceValue !== undefined && priceValue !== null) {
          const priceStr = String(priceValue).trim()
          if (priceStr && priceStr !== '-' && priceStr !== 'nan') {
            try {
              const price = parseFloat(priceStr)
              if (!isNaN(price) && price > 0) {
                prices.push({
                  name: product.name,
                  category: product.category,
                  unit: product.unit,
                  price: price,
                  trend: 'stable'
                })
              }
            } catch {
              // 忽略无法解析的价格
            }
          }
        }
      }
      
      if (prices.length > 0) {
        if (!districtsMap.has(district)) {
          districtsMap.set(district, [])
        }
        districtsMap.get(district)!.push({
          market: marketName,
          prices
        })
      }
    }

    if (districtsMap.size === 0) {
      return NextResponse.json(
        { error: '未找到有效的市场数据，请检查文件格式' },
        { status: 400 }
      )
    }

    // 转换为数组格式
    const districts: DistrictData[] = Array.from(districtsMap.entries())
      .map(([district, markets]) => ({
        district,
        markets
      }))
      .sort((a, b) => a.district.localeCompare(b.district, 'zh-CN'))

    const result: PriceData = {
      updateDate: dateStr,
      districts
    }

    // 保存到临时文件供发布使用
    const tmpDir = join(tmpdir(), 'vegetable-prices')
    if (!existsSync(tmpDir)) {
      await mkdir(tmpDir, { recursive: true })
    }

    const resultPath = join(tmpDir, 'result.json')
    await writeFile(resultPath, JSON.stringify(result, null, 2))

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    console.error('Process error:', error)
    return NextResponse.json(
      { error: '处理失败: ' + (error as Error).message },
      { status: 500 }
    )
  }
}
