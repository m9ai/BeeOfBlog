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
  Video,
  Play,
  ExternalLink,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'

export async function generateStaticParams() {
  const supabase = createStaticClient()
  const { data: videos } = await supabase
    .from('posts')
    .select('id')
    .eq('type', 'video')
    .eq('status', 'published')

  return videos?.map((video) => ({
    id: video.id,
  })) || []
}

async function getVideo(id: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('posts')
    .select(`
      *,
      category:categories(*)
    `)
    .eq('id', id)
    .eq('type', 'video')
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

async function getAdjacentVideos(currentId: string) {
  const supabase = await createClient()

  // Get current video's created_at
  const { data: currentVideo } = await supabase
    .from('posts')
    .select('created_at')
    .eq('id', currentId)
    .single()

  if (!currentVideo) return { prevVideo: null, nextVideo: null }

  const { data: prevVideo } = await supabase
    .from('posts')
    .select('id, title')
    .eq('type', 'video')
    .eq('status', 'published')
    .lt('created_at', currentVideo.created_at)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const { data: nextVideo } = await supabase
    .from('posts')
    .select('id, title')
    .eq('type', 'video')
    .eq('status', 'published')
    .gt('created_at', currentVideo.created_at)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  return { prevVideo, nextVideo }
}

export default async function VideoDetailPage({ params }: { params: { id: string } }) {
  const video = await getVideo(params.id)

  if (!video) {
    notFound()
  }

  const { prevVideo, nextVideo } = await getAdjacentVideos(params.id)

  return (
    <div className="min-h-screen">
      {/* Back Button */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <Link href="/videos">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            返回视频列表
          </Button>
        </Link>
      </div>

      {/* Video Header */}
      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Category */}
        {video.category && (
          <Badge variant="secondary" className="mb-4">
            <Video className="w-3 h-3 mr-1" />
            {video.category.name}
          </Badge>
        )}

        {/* Title */}
        <h1 className="text-3xl md:text-4xl font-bold mb-6 text-foreground">
          {video.title}
        </h1>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-8 pb-8 border-b border-border">
          <span className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            {new Date(video.created_at).toLocaleDateString('zh-CN', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </span>
          <span className="flex items-center gap-1">
            <Eye className="w-4 h-4" />
            {video.view_count} 播放
          </span>
          <div className="ml-auto">
            <ShareButton title={video.title} url={`/videos/${video.id}`} />
          </div>
        </div>

        {/* Video Player / Cover */}
        <div className="relative aspect-video rounded-xl overflow-hidden mb-8 bg-secondary">
          {video.video_url ? (
            <iframe
              src={video.video_url}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : video.cover_image ? (
            <>
              <Image
                src={video.cover_image}
                alt={video.title}
                fill
                className="object-cover"
                priority
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <div className="w-20 h-20 rounded-full bg-primary/90 flex items-center justify-center cursor-pointer hover:scale-110 transition-transform">
                  <Play className="w-8 h-8 text-primary-foreground ml-1" />
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* External Link */}
        {video.external_link && (
          <div className="mb-8">
            <a
              href={video.external_link}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button className="gap-2">
                <ExternalLink className="w-4 h-4" />
                在视频号中观看
              </Button>
            </a>
          </div>
        )}

        {/* Description */}
        {video.content && (
          <div className="prose prose-invert max-w-none">
            <PostContent content={video.content} />
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-12 pt-8 border-t border-border">
          {prevVideo ? (
            <Link href={`/videos/${prevVideo.id}`}>
              <Button variant="ghost" className="gap-2 pl-0">
                <ChevronLeft className="w-4 h-4" />
                <div className="text-left">
                  <div className="text-xs text-muted-foreground">上一个视频</div>
                  <div className="text-sm font-medium truncate max-w-[200px]">
                    {prevVideo.title}
                  </div>
                </div>
              </Button>
            </Link>
          ) : (
            <div />
          )}

          {nextVideo ? (
            <Link href={`/videos/${nextVideo.id}`}>
              <Button variant="ghost" className="gap-2 pr-0">
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">下一个视频</div>
                  <div className="text-sm font-medium truncate max-w-[200px]">
                    {nextVideo.title}
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
          <GiscusComments slug={video.slug || video.id} />
        </div>
      </article>
    </div>
  )
}
