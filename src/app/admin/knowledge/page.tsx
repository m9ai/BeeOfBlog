'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  BookOpen,
  FolderTree,
  FileText,
  Upload,
  ChevronRight,
  Loader2,
  ExternalLink,
  Flame
} from 'lucide-react'
import type { Tables } from '@/types/database'

type CategoryWithCount = Tables<'knowledge_categories'>
type DocWithCategory = Tables<'knowledge_docs'> & {
  category?: Tables<'knowledge_categories'> | null
}

export default function KnowledgeAdminPage() {
  const router = useRouter()
  const [categories, setCategories] = useState<CategoryWithCount[]>([])
  const [docs, setDocs] = useState<DocWithCategory[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    
    // 获取分类
    const { data: categoriesData } = await supabase
      .from('knowledge_categories')
      .select('*')
      .order('sort_order', { ascending: true })
    
    // 获取文档
    const { data: docsData } = await supabase
      .from('knowledge_docs')
      .select(`
        *,
        category:knowledge_categories(*)
      `)
      .order('created_at', { ascending: false })
      .limit(10)

    setCategories(categoriesData || [])
    setDocs(docsData || [])
    setLoading(false)
  }

  const publishedCount = docs.filter(d => d.status === 'published').length
  const hotCount = docs.filter(d => d.is_hot).length

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          加载中...
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <section className="border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">知识库管理</h1>
                <p className="text-sm text-muted-foreground">
                  {categories.length} 个分类 · {docs.length} 篇文档
                </p>
              </div>
            </div>
            <Link href="/admin/knowledge/publish">
              <Button className="gap-2">
                <Upload className="w-4 h-4" />
                发布到小程序
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Cards */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-card border rounded-xl p-6">
            <div className="text-3xl font-bold">{categories.length}</div>
            <div className="text-sm text-muted-foreground">分类总数</div>
          </div>
          <div className="bg-card border rounded-xl p-6">
            <div className="text-3xl font-bold">{docs.length}</div>
            <div className="text-sm text-muted-foreground">文档总数</div>
          </div>
          <div className="bg-card border rounded-xl p-6">
            <div className="text-3xl font-bold">{publishedCount}</div>
            <div className="text-sm text-muted-foreground">已发布</div>
          </div>
          <div className="bg-card border rounded-xl p-6">
            <div className="text-3xl font-bold">{hotCount}</div>
            <div className="text-sm text-muted-foreground">热门文档</div>
          </div>
        </div>

        {/* Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <Link href="/admin/knowledge/categories">
            <div className="bg-card border rounded-xl p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    <FolderTree className="w-6 h-6 text-blue-500" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">分类管理</h2>
                    <p className="text-sm text-muted-foreground">管理知识库分类</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
            </div>
          </Link>
          <Link href="/admin/knowledge/docs">
            <div className="bg-card border rounded-xl p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                    <FileText className="w-6 h-6 text-green-500" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">文档管理</h2>
                    <p className="text-sm text-muted-foreground">管理知识库文档</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
            </div>
          </Link>
        </div>

        {/* Recent Docs */}
        <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border/50 flex items-center justify-between">
            <h3 className="font-semibold">最近文档</h3>
            <Link href="/admin/knowledge/docs">
              <Button variant="ghost" size="sm">查看全部</Button>
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-secondary/50">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-muted-foreground">标题</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-muted-foreground">分类</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-muted-foreground">状态</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-muted-foreground">更新时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {docs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {doc.is_hot && <Flame className="w-4 h-4 text-orange-500" />}
                        <span className="font-medium">{doc.title}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {doc.category?.icon} {doc.category?.name}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={doc.status === 'published' ? 'default' : 'secondary'}>
                        {doc.status === 'published' ? '已发布' : '草稿'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {new Date(doc.update_time).toLocaleDateString('zh-CN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {docs.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">暂无文档</p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
