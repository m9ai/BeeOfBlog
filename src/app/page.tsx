import { createClient } from '@/lib/supabase/server'
import { HeroSection } from '@/components/posts/HeroSection'
import { PostList } from '@/components/posts/PostList'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Video, FileText, LayoutGrid } from 'lucide-react'

async function getPosts(type?: 'video' | 'article') {
  const supabase = await createClient()
  
  let query = supabase
    .from('posts')
    .select(`
      *,
      category:categories(*)
    `)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
  
  if (type) {
    query = query.eq('type', type)
  }
  
  const { data, error } = await query
  
  if (error) {
    console.error('Error fetching posts:', error)
    return []
  }
  
  return data || []
}

async function getCounts() {
  const supabase = await createClient()
  
  const { data: videos } = await supabase
    .from('posts')
    .select('id', { count: 'exact' })
    .eq('type', 'video')
    .eq('status', 'published')
  
  const { data: articles } = await supabase
    .from('posts')
    .select('id', { count: 'exact' })
    .eq('type', 'article')
    .eq('status', 'published')
  
  return {
    videoCount: videos?.length || 0,
    articleCount: articles?.length || 0
  }
}

export default async function HomePage() {
  const [allPosts, videoPosts, articlePosts, counts] = await Promise.all([
    getPosts(),
    getPosts('video'),
    getPosts('article'),
    getCounts()
  ])

  return (
    <div className="min-h-screen">
      <HeroSection videoCount={counts.videoCount} articleCount={counts.articleCount} />
      
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Tabs defaultValue="all" className="w-full">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold">最新内容</h2>
            <TabsList className="bg-secondary/50">
              <TabsTrigger value="all" className="gap-2">
                <LayoutGrid className="w-4 h-4" />
                <span className="hidden sm:inline">全部</span>
              </TabsTrigger>
              <TabsTrigger value="videos" className="gap-2">
                <Video className="w-4 h-4" />
                <span className="hidden sm:inline">视频号</span>
              </TabsTrigger>
              <TabsTrigger value="articles" className="gap-2">
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">公众号</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="all" className="mt-0">
            <PostList posts={allPosts} />
          </TabsContent>
          
          <TabsContent value="videos" className="mt-0">
            <PostList posts={videoPosts} />
          </TabsContent>
          
          <TabsContent value="articles" className="mt-0">
            <PostList posts={articlePosts} />
          </TabsContent>
        </Tabs>
      </section>
    </div>
  )
}
