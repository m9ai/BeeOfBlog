'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Video, 
  FileText,
  Eye,
  EyeOff,
  LayoutDashboard,
  Loader2,
  LogOut,
  Heart,
  ChevronRight
} from 'lucide-react'
import type { Tables } from '@/types/database'

type PostWithCategory = Tables<'posts'> & {
  category?: Tables<'categories'> | null
}

export default function AdminPage() {
  const router = useRouter()
  const [posts, setPosts] = useState<PostWithCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [authChecking, setAuthChecking] = useState(true)
  const [pendingWishlistCount, setPendingWishlistCount] = useState(0)
  const supabase = createClient()

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
      fetchPosts()
      fetchPendingWishlistCount()
    } catch (error) {
      console.error('Auth check error:', error)
      router.push('/admin/login')
    }
  }

  useEffect(() => {
    if (!authChecking) {
      fetchPosts()
    }
  }, [authChecking])

  async function fetchPosts() {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        category:categories(*)
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching posts:', error)
    } else {
      setPosts(data || [])
    }
    setLoading(false)
  }

  async function fetchPendingWishlistCount() {
    const { count, error } = await supabase
      .from('wishlist')
      .select('*', { count: 'exact', head: true })
      .in('status', ['pending', 'processing'])

    if (!error) {
      setPendingWishlistCount(count || 0)
    }
  }

  async function deletePost(id: string) {
    if (!confirm('确定要删除这条内容吗？')) return

    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting post:', error)
      alert('删除失败')
    } else {
      setPosts(posts.filter(p => p.id !== id))
    }
  }

  async function toggleStatus(id: string, currentStatus: string) {
    const newStatus = currentStatus === 'published' ? 'draft' : 'published'
    
    const { error } = await supabase
      .from('posts')
      .update({ status: newStatus })
      .eq('id', id)

    if (error) {
      console.error('Error updating post:', error)
      alert('更新失败')
    } else {
      setPosts(posts.map(p => 
        p.id === id ? { ...p, status: newStatus as 'published' | 'draft' } : p
      ))
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

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
      <section className="border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <LayoutDashboard className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">管理后台</h1>
                <p className="text-sm text-muted-foreground">
                  共 {posts.length} 条内容
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={handleLogout} className="gap-2">
                <LogOut className="w-4 h-4" />
                退出登录
              </Button>
              <Link href="/admin/new">
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  新建内容
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Navigation Cards */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <Link href="/admin">
            <div className="bg-card border rounded-xl p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <FileText className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">内容管理</h2>
                    <p className="text-sm text-muted-foreground">管理文章和视频</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
            </div>
          </Link>
          <Link href="/admin/wishlist">
            <div className="bg-card border rounded-xl p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center">
                    <Heart className="w-6 h-6 text-red-500" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">心愿单管理</h2>
                    <p className="text-sm text-muted-foreground">
                      处理用户诉求和工单
                      {pendingWishlistCount > 0 && (
                        <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                          {pendingWishlistCount} 未处理
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* Content Table */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-secondary/50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">内容</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">类型</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">分类</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">状态</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">浏览</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">发布时间</th>
                  <th className="px-6 py-4 text-right text-sm font-medium text-muted-foreground">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {posts.map((post) => (
                  <tr key={post.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {post.type === 'video' ? (
                          <Video className="w-4 h-4 text-primary" />
                        ) : (
                          <FileText className="w-4 h-4 text-primary" />
                        )}
                        <div>
                          <div className="font-medium">{post.title}</div>
                          <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                            {post.excerpt || '暂无摘要'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="outline">
                        {post.type === 'video' ? '视频' : '文章'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {post.category?.name || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <Badge 
                        variant={post.status === 'published' ? 'default' : 'secondary'}
                        className="cursor-pointer"
                        onClick={() => toggleStatus(post.id, post.status)}
                      >
                        {post.status === 'published' ? '已发布' : '草稿'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {post.view_count}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {new Date(post.created_at).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/${post.type === 'video' ? 'videos' : 'posts'}/${post.id}`} target="_blank">
                          <Button variant="ghost" size="icon">
                            {post.status === 'published' ? (
                              <Eye className="w-4 h-4" />
                            ) : (
                              <EyeOff className="w-4 h-4" />
                            )}
                          </Button>
                        </Link>
                        <Link href={`/admin/edit/${post.id}`}>
                          <Button variant="ghost" size="icon">
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        </Link>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => deletePost(post.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {posts.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">暂无内容</p>
              <Link href="/admin/new">
                <Button>创建第一条内容</Button>
              </Link>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
