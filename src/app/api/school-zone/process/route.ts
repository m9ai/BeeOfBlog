import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import * as XLSX from 'xlsx'

interface SchoolData {
  name: string
  type: '小学' | '初中'
  communities: string[]
}

interface StreetData {
  street: string
  primarySchools: SchoolData[]
  middleSchools: SchoolData[]
  communities: string[]
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const primaryFile = formData.get('primary') as File
    const middleFile = formData.get('middle') as File

    if (!primaryFile || !middleFile) {
      return NextResponse.json(
        { error: '请上传小学和中学两个表格' },
        { status: 400 }
      )
    }

    // 读取Excel文件
    const primaryBuffer = Buffer.from(await primaryFile.arrayBuffer())
    const middleBuffer = Buffer.from(await middleFile.arrayBuffer())

    // 解析小学数据
    const primaryWorkbook = XLSX.read(primaryBuffer, { type: 'buffer' })
    const primarySheet = primaryWorkbook.Sheets[primaryWorkbook.SheetNames[0]]
    const primaryData = XLSX.utils.sheet_to_json(primarySheet) as any[]

    // 解析中学数据
    const middleWorkbook = XLSX.read(middleBuffer, { type: 'buffer' })
    const middleSheet = middleWorkbook.Sheets[middleWorkbook.SheetNames[0]]
    const middleData = XLSX.utils.sheet_to_json(middleSheet) as any[]

    // 处理小学数据
    const primarySchoolsMap: Record<string, Record<string, SchoolData>> = {}
    for (const row of primaryData) {
      const street = String(row['对口地段所属街镇'] || '').trim()
      const schoolName = String(row['学校名称'] || '').trim()
      const community = String(row['小区名称'] || '').trim()

      if (!street || !schoolName) continue

      if (!primarySchoolsMap[street]) {
        primarySchoolsMap[street] = {}
      }

      if (!primarySchoolsMap[street][schoolName]) {
        primarySchoolsMap[street][schoolName] = {
          name: schoolName,
          type: '小学',
          communities: []
        }
      }

      if (community && !primarySchoolsMap[street][schoolName].communities.includes(community)) {
        primarySchoolsMap[street][schoolName].communities.push(community)
      }
    }

    // 处理中学数据
    const middleSchoolsMap: Record<string, Record<string, SchoolData>> = {}
    for (const row of middleData) {
      const street = String(row['对口地段所属街镇'] || '').trim()
      const schoolName = String(row['学校名称'] || '').trim()
      const community = String(row['小区名称'] || '').trim()

      if (!street || !schoolName) continue

      if (!middleSchoolsMap[street]) {
        middleSchoolsMap[street] = {}
      }

      if (!middleSchoolsMap[street][schoolName]) {
        middleSchoolsMap[street][schoolName] = {
          name: schoolName,
          type: '初中',
          communities: []
        }
      }

      if (community && !middleSchoolsMap[street][schoolName].communities.includes(community)) {
        middleSchoolsMap[street][schoolName].communities.push(community)
      }
    }

    // 合并所有街镇
    const allStreets = new Set([
      ...Object.keys(primarySchoolsMap),
      ...Object.keys(middleSchoolsMap)
    ])

    const results: Record<string, StreetData> = {}
    const streetStats: { name: string; primaryCount: number; middleCount: number; communityCount: number }[] = []

    for (const street of Array.from(allStreets).sort()) {
      const pSchools = Object.values(primarySchoolsMap[street] || {})
      const mSchools = Object.values(middleSchoolsMap[street] || {})

      // 收集所有小区
      const allCommunities = new Set<string>()
      pSchools.forEach((s: SchoolData) => s.communities.forEach((c: string) => allCommunities.add(c)))
      mSchools.forEach((s: SchoolData) => s.communities.forEach((c: string) => allCommunities.add(c)))

      results[street] = {
        street,
        primarySchools: pSchools,
        middleSchools: mSchools,
        communities: Array.from(allCommunities).sort()
      }

      streetStats.push({
        name: street,
        primaryCount: pSchools.length,
        middleCount: mSchools.length,
        communityCount: allCommunities.size
      })
    }

    // 保存到临时文件供发布使用
    const tmpDir = join(tmpdir(), 'school-zone')
    if (!existsSync(tmpDir)) {
      await mkdir(tmpDir, { recursive: true })
    }

    const resultPath = join(tmpDir, 'result.json')
    await writeFile(resultPath, JSON.stringify(results, null, 2))

    return NextResponse.json({
      success: true,
      streets: streetStats
    })

  } catch (error) {
    console.error('Process error:', error)
    return NextResponse.json(
      { error: '处理失败: ' + (error as Error).message },
      { status: 500 }
    )
  }
}
