import { createClient } from '@/lib/supabase/server'
import { PostCard } from '@/components/posts/PostCard'
import { Search } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface SearchPageProps {
  searchParams: { q?: string }
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

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const query = searchParams.q || ''
  const posts = query ? await searchPosts(query) : []

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
              找到 {posts.length} 个相关内容
            </p>
          )}
        </div>

        {/* Results */}
        {query ? (
          posts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {posts.map((post: any) => (
                <PostCard key={post.id} post={post} />
              ))}
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
              <div className="flex gap-4 justify-center">
                <Link href="/">
                  <Button>返回首页</Button>
                </Link>
                <Link href="/videos">
                  <Button variant="outline">浏览视频</Button>
                </Link>
                <Link href="/posts">
                  <Button variant="outline">浏览文章</Button>
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
              在上方搜索框中输入关键词，搜索文章或视频
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
