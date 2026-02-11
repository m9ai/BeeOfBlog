import { createClient } from '@/lib/supabase/server'
import { PostCard } from '@/components/posts/PostCard'
import { Search, Heart, FileText, Video } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>
}

async function searchPosts(query: string) {
  const supabase = await createClient()
  const searchTerm = query.trim()

  const { data, error } = await supabase
    .from('posts')
    .select(`
      *,
      category:categories(*)
    `)
    .eq('status', 'published')
    .or(`title.ilike.%${searchTerm}%,excerpt.ilike.%${searchTerm}%,content.ilike.%${searchTerm}%`)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Search error:', error)
    return []
  }

  return data || []
}

async function searchWishlist(query: string) {
  const supabase = await createClient()
  const searchTerm = query.trim()

  const { data, error } = await supabase
    .from('wishlist')
    .select('*')
    .or(`title.ilike.%${searchTerm}%,content.ilike.%${searchTerm}%`)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Wishlist search error:', error)
    return []
  }

  return data || []
}

const categoryLabels: Record<string, string> = {
  old_renovation: '小区旧改',
  municipal: '市政工程',
  cooperation: '本地合作',
  other: '其他',
}

const statusLabels: Record<string, string> = {
  pending: '待处理',
  processing: '处理中',
  completed: '已完成',
  rejected: '已拒绝',
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-600',
  processing: 'bg-blue-500/10 text-blue-600',
  completed: 'bg-green-500/10 text-green-600',
  rejected: 'bg-red-500/10 text-red-600',
}

export default async function SearchPage(props: SearchPageProps) {
  const searchParams = await props.searchParams
  const query = searchParams.q || ''
  const [posts, wishlist] = query
    ? await Promise.all([searchPosts(query), searchWishlist(query)])
    : [[], []]

  const totalResults = posts.length + wishlist.length

  return (
    <div className="min-h-screen pt-24 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-muted-foreground mb-4">
            <Link href="/" className="hover:text-foreground transition-colors">
              首页
            </Link>
            <span>/</span>
            <span>搜索</span>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <Search className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">
              {query ? `「${query}」的搜索结果` : '搜索'}
            </h1>
          </div>

          {query && (
            <p className="text-muted-foreground">
              找到 {totalResults} 个相关内容
              {posts.length > 0 && `（${posts.length} 个内容`}
              {posts.length > 0 && wishlist.length > 0 && '，'}
              {wishlist.length > 0 && `${wishlist.length} 个心愿单）`}
              {!posts.length && !wishlist.length && ''}
            </p>
          )}
        </div>

        {/* Results */}
        {query ? (
          totalResults > 0 ? (
            <div className="space-y-12">
              {/* Posts Results */}
              {posts.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-6">
                    <FileText className="w-5 h-5 text-primary" />
                    <h2 className="text-xl font-semibold">文章和视频</h2>
                    <Badge variant="secondary">{posts.length}</Badge>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {posts.map((post: any) => (
                      <PostCard key={post.id} post={post} />
                    ))}
                  </div>
                </div>
              )}

              {/* Wishlist Results */}
              {wishlist.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-6">
                    <Heart className="w-5 h-5 text-red-500" />
                    <h2 className="text-xl font-semibold">心愿单</h2>
                    <Badge variant="secondary">{wishlist.length}</Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {wishlist.map((item: any) => (
                      <Link key={item.id} href="/wishlist">
                        <div className="bg-card border rounded-xl p-5 hover:shadow-md transition-shadow">
                          <div className="flex items-start justify-between gap-4 mb-3">
                            <Badge variant="outline">
                              {categoryLabels[item.category] || item.category}
                            </Badge>
                            <Badge className={statusColors[item.status]}>
                              {statusLabels[item.status]}
                            </Badge>
                          </div>
                          <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                          <p className="text-muted-foreground text-sm line-clamp-2 mb-3">
                            {item.content}
                          </p>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>
                              {format(new Date(item.created_at), 'yyyy-MM-dd', {
                                locale: zhCN,
                              })}
                            </span>
                            {item.admin_reply && (
                              <span className="text-primary">已回复</span>
                            )}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-20">
              <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mx-auto mb-6">
                <Search className="w-10 h-10 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold mb-2">未找到相关内容</h2>
              <p className="text-muted-foreground mb-6">
                试试其他关键词，或者浏览全部内容
              </p>
              <div className="flex gap-4 justify-center flex-wrap">
                <Link href="/">
                  <Button>返回首页</Button>
                </Link>
                <Link href="/videos">
                  <Button variant="outline">浏览视频</Button>
                </Link>
                <Link href="/posts">
                  <Button variant="outline">浏览文章</Button>
                </Link>
                <Link href="/wishlist">
                  <Button variant="outline">查看心愿单</Button>
                </Link>
              </div>
            </div>
          )
        ) : (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mx-auto mb-6">
              <Search className="w-10 h-10 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">请输入搜索关键词</h2>
            <p className="text-muted-foreground">
              在上方搜索框中输入关键词，搜索文章、视频或心愿单
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
