import { createClient } from '@/lib/supabase/server'

export default async function Sitemap() {
  const supabase = await createClient()
  
  // 获取所有已发布的文章和视频
  const { data: posts } = await supabase
    .from('posts')
    .select('id, type, slug, updated_at')
    .eq('status', 'published')
    .order('updated_at', { ascending: false })

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://your-domain.com'
  
  // 基础页面
  const staticPages = [
    '',
    '/works',
    '/services',
    '/wishlist'
  ].map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date().toISOString(),
    changeFrequency: 'daily',
    priority: path === '' ? 1 : 0.8
  }))

  // 动态内容页面
  const dynamicPages = posts?.map((post) => ({
    url: `${baseUrl}/${post.type === 'video' ? 'videos' : 'posts'}/${post.slug || post.id}`,
    lastModified: new Date(post.updated_at).toISOString(),
    changeFrequency: 'weekly',
    priority: 0.6
  })) || []

  const allPages = [...staticPages, ...dynamicPages]

  return allPages
}