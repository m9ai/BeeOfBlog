'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  ArrowLeft,
  Upload,
  CheckCircle,
  AlertCircle,
  FileJson,
  Loader2,
  RefreshCw,
  Database
} from 'lucide-react'
import type { Tables } from '@/types/database'

type Category = Tables<'knowledge_categories'>
type Doc = Tables<'knowledge_docs'>

interface PublishStatus {
  categories: boolean
  hot: boolean
  lists: Record<string, boolean>
  all: boolean
}

export default function PublishPage() {
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>([])
  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [publishStatus, setPublishStatus] = useState<PublishStatus>({
    categories: false,
    hot: false,
    lists: {},
    all: false
  })
  const [logs, setLogs] = useState<string[]>([])
  const [migrating, setMigrating] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    const { data: categoriesData } = await supabase
      .from('knowledge_categories')
      .select('*')
      .order('sort_order', { ascending: true })

    const { data: docsData } = await supabase
      .from('knowledge_docs')
      .select('*')
      .eq('status', 'published')

    setCategories(categoriesData || [])
    setDocs(docsData || [])
    setLoading(false)
  }

  function addLog(message: string) {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`])
  }

  async function handlePublish() {
    setPublishing(true)
    setLogs([])
    setPublishStatus({
      categories: false,
      hot: false,
      lists: {},
      all: false
    })

    try {
      // 1. 生成分类 JSON
      addLog('开始生成分类数据...')
      const categoriesJson = categories.map(cat => ({
        id: cat.id,
        name: cat.name,
        icon: cat.icon,
        description: cat.description,
        color: cat.color,
        docCount: docs.filter(d => d.category_id === cat.id).length
      }))

      const categoriesRes = await fetch('/api/knowledge/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'knowledge_categories.json',
          data: categoriesJson
        })
      })

      if (!categoriesRes.ok) throw new Error('分类数据发布失败')
      setPublishStatus(prev => ({ ...prev, categories: true }))
      addLog(`✅ 分类数据已生成：${categories.length} 个分类`)

      // 2. 生成热门文档 JSON (取前4个)
      addLog('开始生成热门文档数据...')
      const hotDocs = docs
        .filter(d => d.is_hot)
        .slice(0, 4)
        .map(d => ({
          id: d.id,
          title: d.title,
          category: d.category_id,
          summary: d.summary || '',
          updateTime: d.update_time
        }))

      const hotRes = await fetch('/api/knowledge/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'knowledge_hot.json',
          data: hotDocs
        })
      })

      if (!hotRes.ok) throw new Error('热门文档发布失败')
      setPublishStatus(prev => ({ ...prev, hot: true }))
      addLog(`✅ 热门文档已生成：${hotDocs.length} 篇`)

      // 3. 生成各分类列表 JSON
      const listStatus: Record<string, boolean> = {}
      for (const cat of categories) {
        addLog(`开始生成分类「${cat.name}」的文档列表...`)
        const catDocs = docs
          .filter(d => d.category_id === cat.id)
          .map(d => ({
            id: d.id,
            title: d.title,
            category: d.category_id,
            categoryName: cat.name,
            summary: d.summary || '',
            updateTime: d.update_time,
            url: d.url
          }))

        const listRes = await fetch('/api/knowledge/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: `knowledge_list_${cat.id}.json`,
            data: catDocs
          })
        })

        if (!listRes.ok) throw new Error(`分类 ${cat.name} 发布失败`)
        listStatus[cat.id] = true
        addLog(`✅ 「${cat.name}」文档列表已生成：${catDocs.length} 篇`)
      }
      setPublishStatus(prev => ({ ...prev, lists: listStatus }))

      // 4. 生成全部文档 JSON
      addLog('开始生成全部文档数据...')
      const allDocs = docs.map(d => {
        const cat = categories.find(c => c.id === d.category_id)
        return {
          id: d.id,
          title: d.title,
          category: d.category_id,
          categoryName: cat?.name || '',
          summary: d.summary || '',
          updateTime: d.update_time,
          url: d.url
        }
      })

      const allRes = await fetch('/api/knowledge/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'knowledge_all.json',
          data: allDocs
        })
      })

      if (!allRes.ok) throw new Error('全部文档发布失败')
      setPublishStatus(prev => ({ ...prev, all: true }))
      addLog(`✅ 全部文档已生成：${allDocs.length} 篇`)

      addLog('🎉 发布完成！小程序数据已更新。')
    } catch (error) {
      console.error('Publish error:', error)
      addLog(`❌ 发布失败：${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      setPublishing(false)
    }
  }

  async function handleMigrate() {
    if (!confirm('确定要从 JSON 文件导入数据到数据库吗？这会覆盖现有的数据。')) return
    
    setMigrating(true)
    setLogs(['开始数据迁移...'])
    
    try {
      const res = await fetch('/api/knowledge/migrate', { method: 'POST' })
      const data = await res.json()
      
      if (data.success) {
        addLog(`✅ ${data.message}`)
        if (data.errors?.length > 0) {
          data.errors.forEach((err: string) => addLog(`⚠️ ${err}`))
        }
        fetchData()
      } else {
        addLog(`❌ 迁移失败: ${data.error}`)
      }
    } catch (error) {
      addLog(`❌ 请求失败: ${error}`)
    } finally {
      setMigrating(false)
    }
  }

  const publishedDocs = docs.filter(d => d.status === 'published')
  const hotDocs = docs.filter(d => d.is_hot)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <section className="border-b border-border/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin/knowledge">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold">发布到小程序</h1>
                <p className="text-sm text-muted-foreground">
                  将数据生成 JSON 文件供小程序使用
                </p>
              </div>
            </div>
            <Button 
              onClick={handlePublish} 
              disabled={publishing}
              className="gap-2"
            >
              {publishing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              {publishing ? '发布中...' : '一键发布'}
            </Button>
          </div>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-card border rounded-xl p-4">
            <div className="text-2xl font-bold">{categories.length}</div>
            <div className="text-sm text-muted-foreground">分类</div>
          </div>
          <div className="bg-card border rounded-xl p-4">
            <div className="text-2xl font-bold">{publishedDocs.length}</div>
            <div className="text-sm text-muted-foreground">已发布文档</div>
          </div>
          <div className="bg-card border rounded-xl p-4">
            <div className="text-2xl font-bold">{hotDocs.length}</div>
            <div className="text-sm text-muted-foreground">热门文档</div>
          </div>
          <div className="bg-card border rounded-xl p-4">
            <div className="text-2xl font-bold">{categories.length + 3}</div>
            <div className="text-sm text-muted-foreground">生成文件数</div>
          </div>
        </div>

        {/* Data Migration Card */}
        {categories.length === 0 && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-amber-700 mb-1">数据迁移</h3>
                <p className="text-sm text-muted-foreground">
                  数据库暂无数据，可从现有 JSON 文件导入
                </p>
              </div>
              <Button 
                onClick={handleMigrate} 
                disabled={migrating}
                variant="outline"
                className="gap-2"
              >
                {migrating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Database className="w-4 h-4" />
                )}
                {migrating ? '迁移中...' : '导入数据'}
              </Button>
            </div>
          </div>
        )}

        {/* File List */}
        <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <FileJson className="w-5 h-5" />
            生成的文件
          </h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
              <span className="font-mono text-sm">knowledge_categories.json</span>
              {publishStatus.categories ? (
                <Badge variant="default" className="gap-1">
                  <CheckCircle className="w-3 h-3" /> 已生成
                </Badge>
              ) : (
                <Badge variant="secondary">等待发布</Badge>
              )}
            </div>
            <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
              <span className="font-mono text-sm">knowledge_hot.json</span>
              {publishStatus.hot ? (
                <Badge variant="default" className="gap-1">
                  <CheckCircle className="w-3 h-3" /> 已生成
                </Badge>
              ) : (
                <Badge variant="secondary">等待发布</Badge>
              )}
            </div>
            {categories.map(cat => (
              <div key={cat.id} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                <span className="font-mono text-sm">knowledge_list_{cat.id}.json</span>
                {publishStatus.lists[cat.id] ? (
                  <Badge variant="default" className="gap-1">
                    <CheckCircle className="w-3 h-3" /> 已生成
                  </Badge>
                ) : (
                  <Badge variant="secondary">等待发布</Badge>
                )}
              </div>
            ))}
            <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
              <span className="font-mono text-sm">knowledge_all.json</span>
              {publishStatus.all ? (
                <Badge variant="default" className="gap-1">
                  <CheckCircle className="w-3 h-3" /> 已生成
                </Badge>
              ) : (
                <Badge variant="secondary">等待发布</Badge>
              )}
            </div>
          </div>
        </div>

        {/* Logs */}
        {logs.length > 0 && (
          <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6">
            <h3 className="font-semibold mb-4">发布日志</h3>
            <div className="bg-black/90 rounded-lg p-4 font-mono text-sm space-y-1 max-h-[300px] overflow-y-auto">
              {logs.map((log, i) => (
                <div key={i} className={`
                  ${log.includes('✅') ? 'text-green-400' : ''}
                  ${log.includes('❌') ? 'text-red-400' : ''}
                  ${log.includes('🎉') ? 'text-yellow-400' : ''}
                  ${!log.includes('✅') && !log.includes('❌') && !log.includes('🎉') ? 'text-gray-300' : ''}
                `}>
                  {log}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tips */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <h4 className="font-medium text-blue-600 mb-2 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            发布说明
          </h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• 只有「已发布」状态的文档会被生成到 JSON 文件</li>
            <li>• 热门文档最多取 4 个显示在小程序首页</li>
            <li>• 发布后需要等待 CDN 刷新（约 1-5 分钟）小程序才能看到更新</li>
            <li>• 建议先在管理后台确认数据无误后再发布</li>
          </ul>
        </div>
      </section>
    </div>
  )
}
