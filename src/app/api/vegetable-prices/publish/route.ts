import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

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

// 读取已有的价格数据
async function loadExistingData(outputDir: string): Promise<PriceData | null> {
  try {
    const fullDataPath = join(outputDir, 'vegetable_prices_full.json')
    if (!existsSync(fullDataPath)) {
      return null
    }
    const data = await readFile(fullDataPath, 'utf-8')
    return JSON.parse(data)
  } catch {
    return null
  }
}

// 计算价格趋势
function calculateTrend(currentPrice: number, previousPrice: number | undefined): 'up' | 'down' | 'stable' {
  if (previousPrice === undefined || previousPrice === null || previousPrice === 0) {
    return 'stable'
  }
  
  const diff = currentPrice - previousPrice
  const percentChange = (diff / previousPrice) * 100
  
  // 变化超过5%才算趋势变化，避免微小波动
  if (percentChange > 5) {
    return 'up'
  } else if (percentChange < -5) {
    return 'down'
  }
  return 'stable'
}

// 比对价格数据并设置趋势
function comparePrices(newData: PriceData, oldData: PriceData | null): PriceData {
  if (!oldData || !oldData.districts) {
    // 没有历史数据，所有趋势设为 stable
    return newData
  }

  // 构建旧数据的价格映射表：区县 -> 市场 -> 商品名 -> 价格
  const oldPriceMap = new Map<string, Map<string, Map<string, number>>>()
  
  for (const district of oldData.districts) {
    const marketMap = new Map<string, Map<string, number>>()
    for (const market of district.markets) {
      const priceMap = new Map<string, number>()
      for (const price of market.prices) {
        // 使用商品名+单位作为唯一键
        const key = `${price.name}_${price.unit}`
        priceMap.set(key, price.price)
      }
      marketMap.set(market.market, priceMap)
    }
    oldPriceMap.set(district.district, marketMap)
  }

  // 遍历新数据，比对并设置趋势
  for (const district of newData.districts) {
    const marketMap = oldPriceMap.get(district.district)
    
    for (const market of district.markets) {
      const priceMap = marketMap?.get(market.market)
      
      for (const price of market.prices) {
        const key = `${price.name}_${price.unit}`
        const oldPrice = priceMap?.get(key)
        price.trend = calculateTrend(price.price, oldPrice)
      }
    }
  }

  return newData
}

// 生成趋势统计信息
function generateTrendStats(data: PriceData) {
  let upCount = 0
  let downCount = 0
  let stableCount = 0
  let totalCount = 0

  for (const district of data.districts) {
    for (const market of district.markets) {
      for (const price of market.prices) {
        totalCount++
        if (price.trend === 'up') upCount++
        else if (price.trend === 'down') downCount++
        else stableCount++
      }
    }
  }

  return { upCount, downCount, stableCount, totalCount }
}

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
    const priceData: PriceData = JSON.parse(data)

    // 确定输出路径
    const outputDir = join(process.cwd(), 'public', 'feeds')
    if (!existsSync(outputDir)) {
      await mkdir(outputDir, { recursive: true })
    }

    // 加载已有的价格数据用于比对
    const existingData = await loadExistingData(outputDir)
    
    // 比对价格并设置趋势
    const dataWithTrends = comparePrices(priceData, existingData)
    
    // 生成趋势统计
    const trendStats = generateTrendStats(dataWithTrends)

    const publishedFiles: string[] = []

    // 为每个区县生成单独的JSON文件
    if (dataWithTrends.districts && Array.isArray(dataWithTrends.districts)) {
      for (const districtData of dataWithTrends.districts) {
        const districtName = districtData.district
        // 生成文件名：将区县名称中的特殊字符替换
        const safeFileName = districtName.replace(/[\\/:*?"<>|]/g, '_')
        const fileName = `vegetable_prices_${safeFileName}.json`
        const outputPath = join(outputDir, fileName)
        
        // 单个区县的数据结构
        const singleDistrictData = {
          updateDate: dataWithTrends.updateDate,
          district: districtName,
          markets: districtData.markets || []
        }
        
        // 生成压缩后的 JSON（去除空格和换行）
        await writeFile(outputPath, JSON.stringify(singleDistrictData), 'utf-8')
        publishedFiles.push(fileName)
      }
    }

    // 同时生成一个包含所有区县的完整数据文件（供后台使用）
    const fullOutputPath = join(outputDir, 'vegetable_prices_full.json')
    // 完整数据也使用压缩格式
    await writeFile(fullOutputPath, JSON.stringify(dataWithTrends), 'utf-8')
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
        updateDate: dataWithTrends.updateDate,
        districtCount: dataWithTrends.districts?.length || 0,
        publishedFiles: publishedFiles,
        trendStats: trendStats,
        comparisonDate: existingData?.updateDate || null
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
