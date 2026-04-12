import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir, unlink, readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

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

    if (!file.name.endsWith('.pdf')) {
      return NextResponse.json(
        { error: '请上传 PDF 文件' },
        { status: 400 }
      )
    }

    // 读取文件内容
    const buffer = Buffer.from(await file.arrayBuffer())
    
    // 获取 PDF 页数
    let pageCount = 31
    try {
      const { getDocumentProxy } = await import('unpdf')
      const pdf = await getDocumentProxy(new Uint8Array(buffer))
      pageCount = pdf.numPages
    } catch (e) {
      console.log('无法获取页数:', e)
    }

    // 直接返回 PDF base64，使用浏览器原生预览
    const pdfBase64 = buffer.toString('base64')

    return NextResponse.json({
      success: true,
      usePdfViewer: true,
      pdfBase64: `data:application/pdf;base64,${pdfBase64}`,
      totalPages: pageCount
    })

  } catch (error) {
    console.error('Extract images error:', error)
    return NextResponse.json(
      { error: '处理失败: ' + (error as Error).message },
      { status: 500 }
    )
  }
}
