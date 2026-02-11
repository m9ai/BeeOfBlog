import { createClient } from '@/lib/supabase/server'
import { PostCard } from '@/components/posts/PostCard'
import { Search, Heart, FileText, Video, Phone, Building2, Home } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import jiedaoData from '@/../../public/feeds/jiedao.json'
import xiaoquData from '@/../../public/feeds/xiaoqu.json'

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

function searchServices(query: string) {
  const searchTerm = query.trim()
  
  // 搜索街道信息
  const jiedaoResults = jiedaoData.filter((item: any) =>
    item.name.includes(searchTerm) ||
    item.phone.includes(searchTerm) ||
    item.category.includes(searchTerm)
  )
  
  // 搜索小区信息
  const xiaoquResults = xiaoquData.filter((item: any) =>
    item.name.includes(searchTerm) ||
    item.property.name.includes(searchTerm) ||
    item.property.phone.includes(searchTerm) ||
    item.committee.name.includes(searchTerm)
  )
  
  return {
    jiedao: jiedaoResults,
    xiaoqu: xiaoquResults,
    total: jiedaoResults.length + xiaoquResults.length
  }
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
  
  let posts: any[] = []
  let wishlist: any[] = []
  let services = { jiedao: [], xiaoqu: [], total: 0 }
  
  if (query) {
    [posts, wishlist] = await Promise.all([searchPosts(query), searchWishlist(query)])
    services = searchServices(query)
  }

  const totalResults = posts.length + wishlist.length + services.total

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
              {posts.length > 0 && `（${posts.length} 个文章/视频`}
              {wishlist.length > 0 && `${posts.length > 0 ? '，' : '（'}${wishlist.length} 个心愿单`}
              {services.total > 0 && `${(posts.length > 0 || wishlist.length > 0) ? '，' : '（'}${services.total} 个便民信息`}
              {totalResults > 0 && '）'}
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

              {/* Services Results */}
              {services.total > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-6">
                    <Phone className="w-5 h-5 text-primary" />
                    <h2 className="text-xl font-semibold">便民信息</h2>
                    <Badge variant="secondary">{services.total}</Badge>
                  </div>

                  {/* 街道信息 */}
                  {services.jiedao.length > 0 && (
                    <div className="mb-8">
                      <div className="flex items-center gap-2 mb-4">
                        <Building2 className="w-4 h-4 text-green-600" />
                        <h3 className="text-lg font-semibold">街道通讯录</h3>
                        <Badge variant="outline" className="bg-green-500/10 text-green-600">
                          {services.jiedao.length}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {services.jiedao.map((item: any, index: number) => (
                          <Card key={index} className="border-border/50 hover:border-primary/50 transition-all">
                            <CardContent className="p-5">
                              <div className="flex items-start gap-3">
                                <div className="text-2xl">{item.icon}</div>
                                <div className="flex-1">
                                  <div className="text-xs text-muted-foreground mb-1">
                                    {item.category}
                                  </div>
                                  <h4 className="font-semibold mb-2 text-sm leading-tight">
                                    {item.name}
                                  </h4>
                                  <a
                                    href={`tel:${item.phone}`}
                                    className="text-primary hover:underline text-sm inline-flex items-center gap-1"
                                  >
                                    <Phone className="w-3 h-3" />
                                    {item.phone}
                                  </a>
                                  {item.address && (
                                    <div className="text-xs text-muted-foreground mt-2">
                                      {item.address}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 小区信息 */}
                  {services.xiaoqu.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <Home className="w-4 h-4 text-orange-600" />
                        <h3 className="text-lg font-semibold">小区通讯录</h3>
                        <Badge variant="outline" className="bg-orange-500/10 text-orange-600">
                          {services.xiaoqu.length}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {services.xiaoqu.map((item: any, index: number) => (
                          <Card key={index} className="border-border/50 hover:border-primary/50 transition-all">
                            <CardContent className="p-5">
                              <h4 className="text-base font-bold mb-3">{item.name}</h4>
                              
                              {item.yeweihui.secretary && (
                                <div className="mb-3 pb-3 border-b border-border/50">
                                  <div className="text-xs text-muted-foreground mb-1">业委会秘书</div>
                                  <div className="text-sm">{item.yeweihui.secretary}</div>
                                  {item.yeweihui.tel && (
                                    <a
                                      href={`tel:${item.yeweihui.tel}`}
                                      className="text-primary hover:underline text-sm"
                                    >
                                      {item.yeweihui.tel}
                                    </a>
                                  )}
                                </div>
                              )}

                              <div className="mb-3 pb-3 border-b border-border/50">
                                <div className="text-xs text-muted-foreground mb-1">物业公司</div>
                                <div className="text-sm mb-1">{item.property.name}</div>
                                <div className="text-xs text-muted-foreground mb-1">
                                  物业经理：{item.property.manager}
                                </div>
                                <a
                                  href={`tel:${item.property.phone}`}
                                  className="text-primary hover:underline text-sm inline-flex items-center gap-1"
                                >
                                  <Phone className="w-3 h-3" />
                                  {item.property.phone}
                                </a>
                              </div>

                              <div>
                                <div className="text-xs text-muted-foreground mb-1">居委会</div>
                                <div className="text-sm mb-1">{item.committee.name}</div>
                                {item.committee.tel && (
                                  <a
                                    href={`tel:${item.committee.tel}`}
                                    className="text-primary hover:underline text-sm inline-flex items-center gap-1"
                                  >
                                    <Phone className="w-3 h-3" />
                                    {item.committee.tel}
                                  </a>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
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
                <Link href="/services">
                  <Button variant="outline">便民电话</Button>
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
              在上方搜索框中输入关键词，搜索文章、视频、心愿单或便民信息
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
