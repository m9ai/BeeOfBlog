'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { 
  ArrowLeft,
  Loader2,
  Save
} from 'lucide-react'
import type { Tables } from '@/types/database'

type Category = Tables<'knowledge_categories'>
type Doc = Tables<'knowledge_docs'>

export default function EditDocPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  const [formData, setFormData] = useState<Partial<Doc>>({
    title: '',
    category_id: '',
    summary: '',
    url: '',
    is_hot: false,
    status: 'draft',
    update_time: ''
  })

  useEffect(() => {
    fetchData()
  }, [id])

  async function fetchData() {
    setLoading(true)
    
    // 获取分类
    const { data: categoriesData } = await supabase
      .from('knowledge_categories')
      .select('*')
      .order('sort_order', { ascending: true })

    if (categoriesData) {
      setCategories(categoriesData)
    }

    // 获取文档
    const { data: docData, error } = await supabase
      .from('knowledge_docs')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !docData) {
      alert('文档不存在')
      router.push('/admin/knowledge/docs')
      return
    }

    setFormData({
      title: docData.title,
      category_id: docData.category_id,
      summary: docData.summary || '',
      url: docData.url,
      is_hot: docData.is_hot,
      status: docData.status,
      update_time: docData.update_time
    })
    
    setLoading(false)
  }

  async function handleSave() {
    if (!formData.title?.trim()) {
      alert('请输入文档标题')
      return
    }
    if (!formData.category_id) {
      alert('请选择分类')
      return
    }
    if (!formData.url?.trim()) {
      alert('请输入文章链接')
      return
    }

    setSaving(true)

    const { error } = await supabase
      .from('knowledge_docs')
      .update({
        title: formData.title.trim(),
        category_id: formData.category_id,
        summary: formData.summary?.trim() || null,
        url: formData.url.trim(),
        is_hot: formData.is_hot,
        status: formData.status,
        update_time: formData.update_time,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    setSaving(false)

    if (error) {
      console.error('Error updating doc:', error)
      alert('保存失败：' + error.message)
      return
    }

    router.push('/admin/knowledge/docs')
  }

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
              <Link href="/admin/knowledge/docs">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <h1 className="text-2xl font-bold">编辑文档</h1>
            </div>
            <Button 
              onClick={handleSave} 
              disabled={saving}
              className="gap-2"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              保存
            </Button>
          </div>
        </div>
      </section>

      {/* Form */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>文档标题 *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="如：洋泾名称的由来"
              />
            </div>
            <div className="space-y-2">
              <Label>所属分类 *</Label>
              <Select 
                value={formData.category_id} 
                onValueChange={(v) => setFormData({ ...formData, category_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择分类" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>微信公众号文章链接 *</Label>
            <Input
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              placeholder="https://mp.weixin.qq.com/s/..."
            />
            <p className="text-xs text-muted-foreground">
              请粘贴完整的微信公众号文章链接
            </p>
          </div>

          <div className="space-y-2">
            <Label>摘要</Label>
            <Textarea
              value={formData.summary}
              onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
              placeholder="简短的摘要描述，用于列表展示..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>更新时间</Label>
              <Input
                type="date"
                value={formData.update_time}
                onChange={(e) => setFormData({ ...formData, update_time: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>发布状态</Label>
              <Select 
                value={formData.status} 
                onValueChange={(v: 'published' | 'draft') => setFormData({ ...formData, status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">草稿</SelectItem>
                  <SelectItem value="published">已发布</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-border/50">
            <div className="flex items-center gap-2">
              <Switch
                id="is_hot"
                checked={formData.is_hot}
                onCheckedChange={(checked) => setFormData({ ...formData, is_hot: checked })}
              />
              <Label htmlFor="is_hot" className="cursor-pointer">
                设为热门文档（首页展示）
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              热门文档最多显示 4 个
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
