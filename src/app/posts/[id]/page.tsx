import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { createStaticClient } from '@/lib/supabase/static'
import { PostContent } from '@/components/posts/PostContent'
import { GiscusComments } from '@/components/comments/GiscusComments'
import { ShareButton } from '@/components/ShareButton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Calendar,
  Eye,
  ArrowLeft,
  FileText,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import QRCodeComponent from '@/components/QRCodeComponent'

export async function generateStaticParams() {
  const supabase = createStaticClient()
  
  // 如果环境变量未设置，返回空数组
  if (!supabase) {
    return []
  }
  
  const { data: posts } = await supabase
    .from('posts')
    .select('id')
    .eq('type', 'article')
    .eq('status', 'published')

  return posts?.map((post) => ({
    id: post.id,
  })) || []
}

async function getPost(id: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('posts')
    .select(`
      *,
      category:categories(*)
    `)
    .eq('id', id)
    .eq('type', 'article')
    .eq('status', 'published')
    .single()

  if (error || !data) {
    return null
  }

  // Increment view count
  await supabase
    .from('posts')
    .update({ view_count: (data.view_count || 0) + 1 })
    .eq('id', data.id)

  return data
}

async function getAdjacentPosts(currentId: string) {
  const supabase = await createClient()

  // Get current post's created_at
  const { data: currentPost } = await supabase
    .from('posts')
    .select('created_at')
    .eq('id', currentId)
    .single()

  if (!currentPost) return { prevPost: null, nextPost: null }

  const { data: prevPost } = await supabase
    .from('posts')
    .select('id, title')
    .eq('type', 'article')
    .eq('status', 'published')
    .lt('created_at', currentPost.created_at)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const { data: nextPost } = await supabase
    .from('posts')
    .select('id, title')
    .eq('type', 'article')
    .eq('status', 'published')
    .gt('created_at', currentPost.created_at)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  return { prevPost, nextPost }
}

export default async function PostDetailPage({ params }: { params: { id: string } }) {
  const post = await getPost(params.id)

  if (!post) {
    notFound()
  }

  const { prevPost, nextPost } = await getAdjacentPosts(params.id)

  return (
    <div className="min-h-screen">
      {/* Back Button */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <Link href="/posts">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            返回文章列表
          </Button>
        </Link>
      </div>

      {/* Article Header */}
      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Category */}
        {post.category && (
          <Badge variant="secondary" className="mb-4">
            <FileText className="w-3 h-3 mr-1" />
            {post.category.name}
          </Badge>
        )}

        {/* Title */}
        <h1 className="text-3xl md:text-4xl font-bold mb-6 text-foreground">
          {post.title}
        </h1>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-8 pb-8 border-b border-border">
          <span className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            {new Date(post.created_at).toLocaleDateString('zh-CN', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </span>
          <span className="flex items-center gap-1">
            <Eye className="w-4 h-4" />
            {post.view_count} 阅读
          </span>
          <div className="ml-auto">
            <ShareButton title={post.title} url={`/posts/${post.id}`} />
          </div>
        </div>
        {/* Scan in Wechat */}
        {
          post.wechat_source && (<div className='flex flex-col items-center mb-8'>
            <QRCodeComponent url={post.wechat_source} title={post.title} />
            <p>请用微信扫码查看</p>
          </div>)
        }

        {/* Cover Image */}
        {post.cover_image && (
          <div className="relative aspect-video rounded-xl overflow-hidden mb-8">
            <Image
              src={post.cover_image}
              alt={post.title}
              fill
              className="object-cover"
              priority
            />
          </div>
        )}

        {/* Content */}
        <div className="prose prose-invert max-w-none">
          <PostContent content={post.content} />
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-12 pt-8 border-t border-border">
          {prevPost ? (
            <Link href={`/posts/${prevPost.id}`}>
              <Button variant="ghost" className="gap-2 pl-0">
                <ChevronLeft className="w-4 h-4" />
                <div className="text-left">
                  <div className="text-xs text-muted-foreground">上一篇</div>
                  <div className="text-sm font-medium truncate max-w-[200px]">
                    {prevPost.title}
                  </div>
                </div>
              </Button>
            </Link>
          ) : (
            <div />
          )}

          {nextPost ? (
            <Link href={`/posts/${nextPost.id}`}>
              <Button variant="ghost" className="gap-2 pr-0">
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">下一篇</div>
                  <div className="text-sm font-medium truncate max-w-[200px]">
                    {nextPost.title}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          ) : (
            <div />
          )}
        </div>

        {/* Comments */}
        <div className="mt-12 pt-8 border-t border-border">
          <h2 className="text-xl font-semibold mb-6">评论</h2>
          <GiscusComments slug={post.slug || post.id} />
        </div>
      </article>
    </div>
  )
}
