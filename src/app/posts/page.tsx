import { createClient } from '@/lib/supabase/server'
import { PostList } from '@/components/posts/PostList'
import { BookOpen } from 'lucide-react'

async function getPosts() {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('posts')
    .select(`
      *,
      category:categories(*)
    `)
    .eq('type', 'article')
    .eq('status', 'published')
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('Error fetching posts:', error)
    return []
  }
  
  return data || []
}

export default async function PostsPage() {
  const posts = await getPosts()

  return (
    <div className="min-h-screen">
      {/* Header */}
      <section className="relative overflow-hidden border-b border-border/50">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/20" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">公众号文章</h1>
              <p className="text-muted-foreground mt-1">
                分享技术干货、学习心得与生活感悟
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <PostList posts={posts} />
      </section>
    </div>
  )
}
