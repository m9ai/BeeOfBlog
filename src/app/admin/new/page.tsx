'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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
import { ArrowLeft, Save, Video, FileText, Loader2, LogOut } from 'lucide-react'
import type { Tables } from '@/types/database'

export default function NewPostPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [categories, setCategories] = useState<Tables<'categories'>[]>([])
  const [loading, setLoading] = useState(false)
  const [authChecking, setAuthChecking] = useState(true)
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    cover_image: '',
    category_id: '',
    type: 'article' as 'video' | 'article',
    video_url: '',
    external_link: '',
    status: 'draft' as 'published' | 'draft',
  })

  useEffect(() => {
    checkAuth()
  }, [])

  async function checkAuth() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/admin/login')
        return
      }

      // 检查用户是否为管理员
      const { data: userData, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .single()

      if (error || userData?.role !== 'admin') {
        await supabase.auth.signOut()
        router.push('/admin/login')
        return
      }

      setAuthChecking(false)
      fetchCategories()
    } catch (error) {
      console.error('Auth check error:', error)
      router.push('/admin/login')
    }
  }

  async function fetchCategories() {
    const { data } = await supabase
      .from('categories')
      .select('*')
      .order('sort_order')
    
    if (data) {
      setCategories(data)
    }
  }

  function generateSlug(title: string) {
    return title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50)
  }

  function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const title = e.target.value
    setFormData(prev => ({
      ...prev,
      title,
      slug: prev.slug || generateSlug(title)
    }))
  }

  // 表单校验
  function validateForm(): string | null {
    if (!formData.title.trim()) {
      return '请输入标题'
    }
    if (!formData.slug.trim()) {
      return '请输入链接标识'
    }
    if (!formData.category_id) {
      return '请选择分类'
    }
    if (!formData.cover_image.trim()) {
      return '请输入封面图片 URL'
    }
    if (!formData.excerpt.trim()) {
      return '请输入摘要'
    }
    if (!formData.content.trim()) {
      return formData.type === 'video' ? '请输入视频描述' : '请输入文章内容'
    }
    // URL 格式校验
    if (formData.cover_image && !isValidUrl(formData.cover_image)) {
      return '封面图片 URL 格式不正确'
    }
    if (formData.video_url && !isValidUrl(formData.video_url)) {
      return '视频嵌入链接格式不正确'
    }
    if (formData.external_link && !isValidUrl(formData.external_link)) {
      return '视频号链接格式不正确'
    }
    return null
  }

  function isValidUrl(url: string): boolean {
    if (!url) return true
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    // 前端校验
    const error = validateForm()
    if (error) {
      alert(error)
      return
    }
    
    setLoading(true)

    const { error: submitError } = await supabase
      .from('posts')
      .insert([formData])

    if (submitError) {
      console.error('Error creating post:', submitError)
      alert('创建失败: ' + submitError.message)
    } else {
      router.push('/admin')
    }
    
    setLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  const filteredCategories = categories.filter(c => c.type === formData.type)

  if (authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          验证权限中...
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-border/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <h1 className="text-2xl font-bold">新建内容</h1>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={handleLogout} className="gap-2">
                <LogOut className="w-4 h-4" />
                退出登录
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={loading}
                className="gap-2"
              >
                <Save className="w-4 h-4" />
                {loading ? '保存中...' : '保存'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Type Selection */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, type: 'article', category_id: '' }))}
              className={`flex-1 flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all ${
                formData.type === 'article'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <FileText className={`w-5 h-5 ${formData.type === 'article' ? 'text-primary' : ''}`} />
              <span className={formData.type === 'article' ? 'font-medium' : ''}>公众号文章</span>
            </button>
            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, type: 'video', category_id: '' }))}
              className={`flex-1 flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all ${
                formData.type === 'video'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <Video className={`w-5 h-5 ${formData.type === 'video' ? 'text-primary' : ''}`} />
              <span className={formData.type === 'video' ? 'font-medium' : ''}>视频号作品</span>
            </button>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">
              标题 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              value={formData.title}
              onChange={handleTitleChange}
              placeholder="输入标题"
              required
            />
          </div>

          {/* Slug */}
          <div className="space-y-2">
            <Label htmlFor="slug">
              链接标识 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="slug"
              value={formData.slug}
              onChange={e => setFormData(prev => ({ ...prev, slug: e.target.value }))}
              placeholder="url-friendly-slug"
              required
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>
              分类 <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.category_id}
              onValueChange={value => setFormData(prev => ({ ...prev, category_id: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择分类" />
              </SelectTrigger>
              <SelectContent>
                {filteredCategories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Cover Image */}
          <div className="space-y-2">
            <Label htmlFor="cover_image">
              封面图片 URL <span className="text-destructive">*</span>
            </Label>
            <Input
              id="cover_image"
              value={formData.cover_image}
              onChange={e => setFormData(prev => ({ ...prev, cover_image: e.target.value }))}
              placeholder="https://example.com/image.jpg"
            />
          </div>

          {/* Excerpt */}
          <div className="space-y-2">
            <Label htmlFor="excerpt">
              摘要 <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="excerpt"
              value={formData.excerpt}
              onChange={e => setFormData(prev => ({ ...prev, excerpt: e.target.value }))}
              placeholder="简短描述内容..."
              rows={2}
            />
          </div>

          {/* Video URL (for videos) */}
          {formData.type === 'video' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="video_url">视频嵌入链接</Label>
                <Input
                  id="video_url"
                  value={formData.video_url}
                  onChange={e => setFormData(prev => ({ ...prev, video_url: e.target.value }))}
                  placeholder="https://player.bilibili.com/..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="external_link">视频号链接</Label>
                <Input
                  id="external_link"
                  value={formData.external_link}
                  onChange={e => setFormData(prev => ({ ...prev, external_link: e.target.value }))}
                  placeholder="https://..."
                />
              </div>
            </>
          )}

          {/* Content */}
          <div className="space-y-2">
            <Label htmlFor="content">
              {formData.type === 'video' ? '视频描述' : '文章内容 (Markdown)'}
              <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="content"
              value={formData.content}
              onChange={e => setFormData(prev => ({ ...prev, content: e.target.value }))}
              placeholder={formData.type === 'video' ? '输入视频描述...' : '# 标题\n\n正文内容...'}
              rows={15}
              className="font-mono text-sm"
            />
          </div>

          {/* Status */}
          <div className="flex items-center gap-4">
            <Label>发布状态:</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, status: 'draft' }))}
                className={`px-4 py-2 rounded-lg border transition-all ${
                  formData.status === 'draft'
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border'
                }`}
              >
                草稿
              </button>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, status: 'published' }))}
                className={`px-4 py-2 rounded-lg border transition-all ${
                  formData.status === 'published'
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border'
                }`}
              >
                立即发布
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
