import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import * as fs from 'fs'
import * as path from 'path'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const supabase = await createClient(cookieStore)
    
    // 验证管理员
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .single()

    if (userData?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 读取 JSON 文件
    const feedsDir = path.join(process.cwd(), 'public', 'feeds')
    
    // 1. 读取分类
    const categoriesPath = path.join(feedsDir, 'knowledge_categories.json')
    const categoriesData = JSON.parse(fs.readFileSync(categoriesPath, 'utf-8'))

    const results = {
      categories: 0,
      docs: 0,
      errors: [] as string[]
    }

    // 2. 导入分类
    for (let i = 0; i < categoriesData.length; i++) {
      const cat = categoriesData[i]
      const { error } = await supabase
        .from('knowledge_categories')
        .upsert({
          id: cat.id,
          name: cat.name,
          icon: cat.icon,
          description: cat.description,
          color: cat.color,
          sort_order: i,
          doc_count: 0
        }, { onConflict: 'id' })

      if (error) {
        results.errors.push(`分类 ${cat.name}: ${error.message}`)
      } else {
        results.categories++
      }
    }

    // 3. 读取所有文档
    const allDocs: any[] = []
    for (const cat of categoriesData) {
      const listPath = path.join(feedsDir, `knowledge_list_${cat.id}.json`)
      if (fs.existsSync(listPath)) {
        const docs = JSON.parse(fs.readFileSync(listPath, 'utf-8'))
        allDocs.push(...docs.map((d: any) => ({ ...d, category: cat.id })))
      }
    }

    // 4. 读取热门文档
    const hotPath = path.join(feedsDir, 'knowledge_hot.json')
    let hotDocIds: string[] = []
    if (fs.existsSync(hotPath)) {
      const hotDocs = JSON.parse(fs.readFileSync(hotPath, 'utf-8'))
      hotDocIds = hotDocs.map((d: any) => d.id)
    }

    // 5. 导入文档
    for (const doc of allDocs) {
      const { error } = await supabase
        .from('knowledge_docs')
        .upsert({
          id: doc.id,
          title: doc.title,
          category_id: doc.category,
          summary: doc.summary || null,
          url: doc.url || '',
          is_hot: hotDocIds.includes(doc.id),
          status: 'published',
          update_time: doc.updateTime,
          view_count: 0
        }, { onConflict: 'id' })

      if (error) {
        results.errors.push(`文档 ${doc.title}: ${error.message}`)
      } else {
        results.docs++
      }
    }

    // 6. 更新分类计数
    for (const cat of categoriesData) {
      const docCount = allDocs.filter((d: any) => d.category === cat.id).length
      await supabase
        .from('knowledge_categories')
        .update({ doc_count: docCount })
        .eq('id', cat.id)
    }

    return NextResponse.json({
      success: true,
      message: `迁移完成：${results.categories} 个分类，${results.docs} 篇文档`,
      errors: results.errors.length > 0 ? results.errors : undefined
    })

  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json(
      { error: 'Migration failed', details: (error as Error).message },
      { status: 500 }
    )
  }
}
