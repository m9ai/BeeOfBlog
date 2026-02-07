import { createClient } from '@/lib/supabase/server'
import { PostList } from '@/components/posts/PostList'
import { Play } from 'lucide-react'

async function getVideos() {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('posts')
    .select(`
      *,
      category:categories(*)
    `)
    .eq('type', 'video')
    .eq('status', 'published')
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('Error fetching videos:', error)
    return []
  }
  
  return data || []
}

export default async function VideosPage() {
  const videos = await getVideos()

  return (
    <div className="min-h-screen">
      {/* Header */}
      <section className="relative overflow-hidden border-b border-border/50">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/20" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Play className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">视频号作品</h1>
              <p className="text-muted-foreground mt-1">
                记录精彩瞬间，分享创意与生活
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <PostList posts={videos} />
      </section>
    </div>
  )
}
