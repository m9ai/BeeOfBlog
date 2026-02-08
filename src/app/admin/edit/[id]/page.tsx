'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
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

export default function EditPostPage() {
  const router = useRouter()
  const params = useParams()
  const postId = params.id as string
  const supabase = createClient()
  
  const [categories, setCategories] = useState<Tables<'categories'>[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [authChecking, setAuthChecking] = useState(true)
  const [hasDraft, setHasDraft] = useState(false)
  const [postStatus, setPostStatus] = useState<'published' | 'draft'>('draft')
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
      fetchData()
    } catch (error) {
      console.error('Auth check error:', error)
      router.push('/admin/login')
    }
  }

  async function fetchData() {
    setLoading(true)
    
    // 获取分类
    const { data: cats } = await supabase
      .from('categories')
      .select('*')
      .order('sort_order')
    
    if (cats) {
      setCategories(cats)
    }

    // 先尝试获取草稿
    const { data: draft } = await supabase
      .from('drafts')
      .select('*')
      .eq('post_id', postId)
      .single()

    // 获取文章数据
    const { data: post, error } = await supabase
      .from('posts')
      .select('*')
      .eq('id', postId)
      .single()

    if (error || !post) {
      alert('内容不存在')
      router.push('/admin')
      return
    }

    setPostStatus(post.status as 'published' | 'draft')

    if (draft) {
      // 有草稿，使用草稿数据
      setHasDraft(true)
      setFormData({
        title: draft.title || '',
        slug: draft.slug || '',
        excerpt: draft.excerpt || '',
        content: draft.content || '',
        cover_image: draft.cover_image || '',
        category_id: draft.category_id || '',
        type: draft.type as 'video' | 'article',
        video_url: draft.video_url || '',
        external_link: draft.external_link || '',
      })
    } else {
      // 没有草稿，使用已发布数据
      setHasDraft(false)
      setFormData({
        title: post.title || '',
        slug: post.slug || '',
        excerpt: post.excerpt || '',
        content: post.content || '',
        cover_image: post.cover_image || '',
        category_id: post.category_id || '',
        type: post.type as 'video' | 'article',
        video_url: post.video_url || '',
        external_link: post.external_link || '',
      })
    }
    
    setLoading(false)
  }

  // 保存到草稿表
  async function handleSave(e?: React.FormEvent) {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    setSaving(true)

    const draftData = {
      post_id: postId,
      title: formData.title,
      slug: formData.slug,
      excerpt: formData.excerpt,
      content: formData.content,
      cover_image: formData.cover_image,
      category_id: formData.category_id,
      type: formData.type,
      video_url: formData.video_url,
      external_link: formData.external_link,
      updated_at: new Date().toISOString(),
    }

    // 使用 upsert：有则更新，无则插入
    const { error } = await supabase
      .from('drafts')
      .upsert(draftData, { onConflict: 'post_id' })

    if (error) {
      console.error('Error saving draft:', error)
      alert('保存失败: ' + error.message)
    } else {
      setHasDraft(true)
      alert('已保存到草稿！')
    }
    setSaving(false)
  }

  // 发布：将草稿更新到 posts 表
  async function handlePublish() {
    setSaving(true)

    // 先更新 posts 表
    const { error: updateError } = await supabase
      .from('posts')
      .update({
        title: formData.title,
        slug: formData.slug,
        excerpt: formData.excerpt,
        content: formData.content,
        cover_image: formData.cover_image,
        category_id: formData.category_id,
        type: formData.type,
        video_url: formData.video_url,
        external_link: formData.external_link,
        status: 'published',
        updated_at: new Date().toISOString(),
      })
      .eq('id', postId)

    if (updateError) {
      console.error('Error publishing post:', updateError)
      alert('发布失败: ' + updateError.message)
      setSaving(false)
      return
    }

    // 删除草稿
    const { error: deleteError } = await supabase
      .from('drafts')
      .delete()
      .eq('post_id', postId)

    if (deleteError) {
      console.error('Error deleting draft:', deleteError)
    }

    setPostStatus('published')
    setHasDraft(false)
    alert('发布成功！')
    router.push('/admin')
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  const filteredCategories = categories.filter(c => c.type === formData.type)

  if (authChecking || loading) {
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
      <div className="border-b border-border/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold">编辑内容</h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    postStatus === 'published' 
                      ? 'bg-green-500/20 text-green-500' 
                      : 'bg-yellow-500/20 text-yellow-500'
                  }`}>
                    {postStatus === 'published' ? '已发布' : '草稿'}
                  </span>
                  {hasDraft && (
                    <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-500">
                      有未发布修改
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={handleLogout} className="gap-2">
                <LogOut className="w-4 h-4" />
                退出登录
              </Button>
              <Button 
                onClick={() => handleSave()} 
                disabled={saving}
                variant="outline"
                className="gap-2"
              >
                <Save className="w-4 h-4" />
                {saving ? '保存中...' : '保存'}
              </Button>
              <Button 
                onClick={handlePublish}
                disabled={saving}
                className="gap-2"
              >
                {saving ? '发布中...' : '立即发布'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSave} className="space-y-6">
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
            <Label htmlFor="title">标题</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="输入标题"
              required
            />
          </div>

          {/* Slug */}
          <div className="space-y-2">
            <Label htmlFor="slug">链接标识</Label>
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
            <Label>分类</Label>
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
            <Label htmlFor="cover_image">封面图片 URL</Label>
            <Input
              id="cover_image"
              value={formData.cover_image}
              onChange={e => setFormData(prev => ({ ...prev, cover_image: e.target.value }))}
              placeholder="https://example.com/image.jpg"
            />
          </div>

          {/* Excerpt */}
          <div className="space-y-2">
            <Label htmlFor="excerpt">摘要</Label>
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
        </form>
      </div>
    </div>
  )
}
