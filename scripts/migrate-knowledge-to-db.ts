/**
 * 知识库数据迁移脚本
 * 将现有的 JSON 文件数据导入到 Supabase 数据库
 * 
 * 运行方式：npx ts-node scripts/migrate-knowledge-to-db.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// 读取环境变量
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('错误：缺少 Supabase 环境变量')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

interface CategoryJson {
  id: string
  name: string
  icon: string
  description: string
  color: string
  docCount?: number
}

interface DocJson {
  id: string
  title: string
  category: string
  categoryName?: string
  summary: string
  updateTime: string
  url?: string
}

async function migrate() {
  console.log('🚀 开始知识库数据迁移...\n')

  try {
    // 1. 读取分类数据
    const categoriesPath = path.join(__dirname, '..', 'public', 'feeds', 'knowledge_categories.json')
    const categoriesData: CategoryJson[] = JSON.parse(fs.readFileSync(categoriesPath, 'utf-8'))
    
    console.log(`📁 读取到 ${categoriesData.length} 个分类`)

    // 2. 导入分类
    console.log('\n📥 导入分类...')
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
        console.error(`  ❌ 分类「${cat.name}」导入失败:`, error.message)
      } else {
        console.log(`  ✅ ${cat.icon} ${cat.name}`)
      }
    }

    // 3. 读取所有分类的文档
    const docsDir = path.join(__dirname, '..', 'public', 'feeds')
    const allDocs: DocJson[] = []

    for (const cat of categoriesData) {
      const listPath = path.join(docsDir, `knowledge_list_${cat.id}.json`)
      if (fs.existsSync(listPath)) {
        const docs: DocJson[] = JSON.parse(fs.readFileSync(listPath, 'utf-8'))
        allDocs.push(...docs.map(d => ({ ...d, category: cat.id })))
        console.log(`  📄 ${cat.name}: ${docs.length} 篇文档`)
      }
    }

    console.log(`\n📁 读取到共 ${allDocs.length} 篇文档`)

    // 4. 读取热门文档
    const hotPath = path.join(docsDir, 'knowledge_hot.json')
    let hotDocIds: string[] = []
    if (fs.existsSync(hotPath)) {
      const hotDocs: DocJson[] = JSON.parse(fs.readFileSync(hotPath, 'utf-8'))
      hotDocIds = hotDocs.map(d => d.id)
      console.log(`🔥 热门文档: ${hotDocIds.length} 篇`)
    }

    // 5. 导入文档
    console.log('\n📥 导入文档...')
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
        console.error(`  ❌ 文档「${doc.title}」导入失败:`, error.message)
      } else {
        process.stdout.write('.')
      }
    }

    console.log('\n\n📊 更新分类文档计数...')
    for (const cat of categoriesData) {
      const docCount = allDocs.filter(d => d.category === cat.id).length
      const { error } = await supabase
        .from('knowledge_categories')
        .update({ doc_count: docCount })
        .eq('id', cat.id)

      if (error) {
        console.error(`  ❌ 分类「${cat.name}」计数更新失败`)
      }
    }

    console.log('\n✅ 数据迁移完成！')
    console.log(`\n📈 统计：
  - 分类: ${categoriesData.length} 个
  - 文档: ${allDocs.length} 篇
  - 热门: ${hotDocIds.length} 篇`)

  } catch (error) {
    console.error('\n❌ 迁移失败:', error)
    process.exit(1)
  }
}

migrate()
