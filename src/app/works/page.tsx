import { createClient } from '@/lib/supabase/server'
import { LayoutGrid, Video, FileText } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import Image from 'next/image'

async function getWorks() {
  const supabase = await createClient()
  
  // 获取视频作品
  const { data: videos, error: videoError } = await supabase
    .from('posts')
    .select(`
      *,
      category:categories(*)
    `)
    .eq('type', 'video')
    .eq('status', 'published')
    .order('created_at', { ascending: false })

  // 获取文章作品
  const { data: posts, error: postError } = await supabase
    .from('posts')
    .select(`
      *,
      category:categories(*)
    `)
    .eq('type', 'article')
    .eq('status', 'published')
    .order('created_at', { ascending: false })

  return {
    videos: videos || [],
    posts: posts || [],
    videoError,
    postError
  }
}

export default async function WorksPage({ searchParams }: { searchParams: { tab?: string } }) {
  const { videos, posts } = await getWorks()
  const defaultTab = searchParams.tab === 'posts' ? 'posts' : 'videos'

  return (
    <div className="min-h-screen">
      {/* Header */}
      <section className="relative overflow-hidden border-b border-border/50">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/20" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <LayoutGrid className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">作品展示</h1>
              <p className="text-muted-foreground mt-1">
                视频号与公众号作品合集
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="videos" className="flex items-center gap-2">
              <Video className="w-4 h-4" />
              视频号作品 ({videos.length})
            </TabsTrigger>
            <TabsTrigger value="posts" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              公众号文章 ({posts.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="videos" className="mt-0">
            {videos.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {videos.map((video) => (
                  <Card key={video.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                    <div className="relative aspect-video bg-muted">
                      {video.cover_image ? (
                        <Image
                          src={video.cover_image}
                          alt={video.title}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-muted">
                          <Video className="w-12 h-12 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg line-clamp-2">{video.title}</CardTitle>
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>{video.category?.name || '未分类'}</span>
                        <span>{new Date(video.created_at).toLocaleDateString()}</span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Button className="w-full" variant="outline" asChild>
                        <Link href={`/videos/${video.id}`}>
                          查看详情
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Video className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">暂无视频作品</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="posts" className="mt-0">
            {posts.length > 0 ? (
              <div className="space-y-6">
                {posts.map((post) => (
                  <Card key={post.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <Badge variant="secondary" className="mb-2">
                            {post.category?.name || '未分类'}
                          </Badge>
                          <CardTitle className="text-xl mb-2">{post.title}</CardTitle>
                          <CardDescription className="line-clamp-2">
                            {post.excerpt || '暂无摘要'}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-sm text-muted-foreground pt-2">
                        <span>{new Date(post.created_at).toLocaleDateString()}</span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Button className="w-full" variant="outline" asChild>
                        <Link href={`/posts/${post.id}`}>
                          阅读全文
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">暂无文章作品</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </section>
    </div>
  )
}