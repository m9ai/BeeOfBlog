import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import * as XLSX from 'xlsx'

interface KindergartenData {
  name: string
  type: '幼儿园'
  isDistrictWide: boolean
  scope: string
  communities: string[]
}

interface KindergartenResult {
  kindergartenSchools: KindergartenData[]
  communities: string[]
  stats: {
    totalCount: number
    districtWideCount: number
    streetSpecificCount: number
    communityCount: number
  }
}

const DISTRICT_WIDE_KEYWORDS = ['全区', '全区招生', '浦东新区']

function isDistrictWide(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  return DISTRICT_WIDE_KEYWORDS.some(keyword => trimmed.includes(keyword))
}

function isDistrictWideMarker(value: string): boolean {
  const normalized = value.replace(/\s/g, '')
  if (!normalized) return false
  return /^全区招生|^全区|^浦东新区所属/.test(normalized)
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('kindergarten') as File

    if (!file) {
      return NextResponse.json(
        { error: '请上传幼儿园学区表' },
        { status: 400 }
      )
    }

    // 读取Excel文件
    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][]

    // 幼儿园表格第一行是标题，第二行开始是数据
    // 跳过前两行（标题行和表头行已经在 sheet_to_json 中，但第一行是文档标题，第二行是表头）
    const dataRows = rows.slice(2)

    // 按幼儿园名称分组
    const kindergartenMap: Record<string, KindergartenData> = {}
    let currentKindergartenName = ''

    for (const row of dataRows) {
      const name = String(row[1] || '').trim()
      const areaLocation = String(row[2] || '').trim()
      const community = String(row[3] || '').trim()

      // 如果当前行有幼儿园名称，则更新当前幼儿园名称
      if (name) {
        currentKindergartenName = name
      }

      // 如果没有幼儿园名称且没有地址和小区，则跳过
      if (!currentKindergartenName || (!areaLocation && !community)) continue

      // 初始化幼儿园数据
      if (!kindergartenMap[currentKindergartenName]) {
        const districtWide = isDistrictWide(areaLocation)
        kindergartenMap[currentKindergartenName] = {
          name: currentKindergartenName,
          type: '幼儿园',
          isDistrictWide: districtWide,
          scope: districtWide ? '全区' : '',
          communities: []
        }
      }

      const kg = kindergartenMap[currentKindergartenName]

      // 只要存在任意一行标记为全区招生，该幼儿园即视为全区招生
      if (isDistrictWide(areaLocation) && !kg.isDistrictWide) {
        kg.isDistrictWide = true
        kg.scope = '全区'
      }

      // 将小区名称加入 communities
      if (community && !kg.communities.includes(community)) {
        kg.communities.push(community)
      }
      // 将招生对口地段范围加入 communities，但排除全区招生的纯标记文本
      if (areaLocation && !isDistrictWideMarker(areaLocation) && !kg.communities.includes(areaLocation)) {
        kg.communities.push(areaLocation)
      }
    }

    const kindergartenSchools = Object.values(kindergartenMap)
    const districtWideCount = kindergartenSchools.filter(kg => kg.isDistrictWide).length

    // 收集所有小区和地址用于搜索索引
    const allCommunities = new Set<string>()
    kindergartenSchools.forEach(kg => {
      kg.communities.forEach(c => allCommunities.add(c))
    })

    const result: KindergartenResult = {
      kindergartenSchools,
      communities: Array.from(allCommunities).sort(),
      stats: {
        totalCount: kindergartenSchools.length,
        districtWideCount,
        streetSpecificCount: kindergartenSchools.length - districtWideCount,
        communityCount: allCommunities.size
      }
    }

    // 保存到临时文件供发布和预览使用
    const tmpDir = join(tmpdir(), 'kindergarten-zone')
    if (!existsSync(tmpDir)) {
      await mkdir(tmpDir, { recursive: true })
    }

    const resultPath = join(tmpDir, 'result.json')
    await writeFile(resultPath, JSON.stringify(result, null, 2))

    return NextResponse.json({
      success: true,
      ...result.stats
    })

  } catch (error) {
    console.error('Kindergarten process error:', error)
    return NextResponse.json(
      { error: '处理失败: ' + (error as Error).message },
      { status: 500 }
    )
  }
}
