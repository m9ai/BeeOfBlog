import { createClient } from '@/lib/supabase/server'
import { HeroSection } from '@/components/posts/HeroSection'
import { PostList } from '@/components/posts/PostList'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Video, FileText, LayoutGrid, Phone, Heart, Users, Calendar, MapPin } from 'lucide-react'
import Link from 'next/link'

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

  const services = [
    {
      title: "便民服务",
      description: "查询小区物业、居委会及街道服务电话",
      icon: Phone,
      href: "/services",
      color: "bg-blue-100 text-blue-600"
    },
    {
      title: "心愿单",
      description: "发布和查看社区居民的心愿与帮助需求",
      icon: Heart,
      href: "/wishlist",
      color: "bg-red-100 text-red-600"
    },
    {
      title: "作品展示",
      description: "视频号与公众号作品合集展示",
      icon: Video,
      href: "/works",
      color: "bg-purple-100 text-purple-600"
    }
  ]

  return (
    <div className="min-h-screen">
      <HeroSection videoCount={counts.videoCount} articleCount={counts.articleCount} />
      
      {/* 核心服务区域 */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h2 className="text-2xl font-bold mb-8 text-center">核心服务</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {services.map((service) => (
            <Card key={service.title} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className={`w-12 h-12 rounded-lg ${service.color} flex items-center justify-center mb-4`}>
                  <service.icon className="w-6 h-6" />
                </div>
                <CardTitle>{service.title}</CardTitle>
                <CardDescription>{service.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" variant="outline" asChild>
                  <Link href={service.href}>立即查看</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* 最新内容 */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 bg-muted/30">
        <Tabs defaultValue="all" className="w-full">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold">最新内容</h2>
            <div className="flex gap-2">
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
              <Button variant="outline" asChild>
                <Link href="/works">查看更多</Link>
              </Button>
            </div>
          </div>

          <TabsContent value="all" className="mt-0">
            <PostList posts={allPosts.slice(0, 6)} />
          </TabsContent>
          
          <TabsContent value="videos" className="mt-0">
            <PostList posts={videoPosts.slice(0, 6)} />
          </TabsContent>
          
          <TabsContent value="articles" className="mt-0">
            <PostList posts={articlePosts.slice(0, 6)} />
          </TabsContent>
        </Tabs>
      </section>

      {/* 社区特色介绍 */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">为什么选择洋泾小蜜蜂？</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            我们致力于为洋泾社区居民提供最贴心、最便捷的服务体验
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            { icon: Users, title: "邻里互助", desc: "促进社区居民互帮互助，营造温暖大家庭氛围" },
            { icon: Calendar, title: "活动丰富", desc: "定期组织各类社区活动，丰富居民文化生活" },
            { icon: MapPin, title: "本地服务", desc: "专注洋泾地区，提供精准的本地化服务" },
            { icon: Heart, title: "用心服务", desc: "以居民需求为导向，持续优化服务体验" }
          ].map((feature, index) => (
            <div key={index} className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <feature.icon className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
