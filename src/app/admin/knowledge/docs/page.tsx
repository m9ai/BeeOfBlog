'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  ExternalLink,
  Flame,
  Search,
  Loader2,
  Eye,
  EyeOff
} from 'lucide-react'
import type { Tables } from '@/types/database'

type DocWithCategory = Tables<'knowledge_docs'> & {
  category?: Tables<'knowledge_categories'> | null
}
type Category = Tables<'knowledge_categories'>

export default function DocsPage() {
  const router = useRouter()
  const [docs, setDocs] = useState<DocWithCategory[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    
    const { data: categoriesData } = await supabase
      .from('knowledge_categories')
      .select('*')
      .order('sort_order', { ascending: true })

    const { data: docsData } = await supabase
      .from('knowledge_docs')
      .select(`
        *,
        category:knowledge_categories(*)
      `)
      .order('created_at', { ascending: false })

    setCategories(categoriesData || [])
    setDocs(docsData || [])
    setLoading(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('确定要删除这篇文档吗？')) return

    const { error } = await supabase
      .from('knowledge_docs')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting doc:', error)
      alert('删除失败')
    } else {
      fetchData()
    }
  }

  async function toggleStatus(id: string, currentStatus: string) {
    const newStatus = currentStatus === 'published' ? 'draft' : 'published'
    
    const { error } = await supabase
      .from('knowledge_docs')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      console.error('Error updating status:', error)
      alert('更新失败')
    } else {
      fetchData()
    }
  }

  async function toggleHot(id: string, currentHot: boolean) {
    const { error } = await supabase
      .from('knowledge_docs')
      .update({ is_hot: !currentHot, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      console.error('Error updating hot:', error)
      alert('更新失败')
    } else {
      fetchData()
    }
  }

  const filteredDocs = docs.filter(doc => {
    if (searchKeyword && !doc.title.toLowerCase().includes(searchKeyword.toLowerCase())) return false
    if (filterCategory !== 'all' && doc.category_id !== filterCategory) return false
    if (filterStatus !== 'all' && doc.status !== filterStatus) return false
    return true
  })

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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin/knowledge">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold">文档管理</h1>
                <p className="text-sm text-muted-foreground">
                  共 {docs.length} 篇文档
                </p>
              </div>
            </div>
            <Link href="/admin/knowledge/docs/new">
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                新建文档
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="搜索文档标题..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="全部分类" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部分类</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat.id} value={cat.id}>{cat.icon} {cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="全部状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="published">已发布</SelectItem>
              <SelectItem value="draft">草稿</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      {/* Docs List */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-secondary/50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">文档</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">分类</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">状态</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">热门</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">更新时间</th>
                <th className="px-6 py-4 text-right text-sm font-medium text-muted-foreground">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filteredDocs.map((doc) => (
                <tr key={doc.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{doc.title}</span>
                        <a href={doc.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-3 h-3 text-muted-foreground hover:text-primary" />
                        </a>
                      </div>
                      <p className="text-sm text-muted-foreground truncate max-w-[300px]">
                        {doc.summary || '暂无摘要'}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {doc.category?.icon} {doc.category?.name}
                  </td>
                  <td className="px-6 py-4">
                    <Badge 
                      variant={doc.status === 'published' ? 'default' : 'secondary'}
                      className="cursor-pointer"
                      onClick={() => toggleStatus(doc.id, doc.status)}
                    >
                      {doc.status === 'published' ? '已发布' : '草稿'}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleHot(doc.id, doc.is_hot)}
                    >
                      <Flame className={`w-4 h-4 ${doc.is_hot ? 'text-orange-500 fill-orange-500' : 'text-muted-foreground'}`} />
                    </Button>
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">
                    {new Date(doc.update_time).toLocaleDateString('zh-CN')}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/admin/knowledge/docs/edit/${doc.id}`}>
                        <Button variant="ghost" size="icon">
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      </Link>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleDelete(doc.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredDocs.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                {docs.length === 0 ? '暂无文档' : '没有匹配的文档'}
              </p>
              {docs.length === 0 && (
                <Link href="/admin/knowledge/docs/new">
                  <Button>创建第一篇文档</Button>
                </Link>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
