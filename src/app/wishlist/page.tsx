import { createClient } from '@/lib/supabase/server'
import { WishlistForm } from '@/components/wishlist/WishlistForm'
import { WishlistList } from '@/components/wishlist/WishlistList'
import { Heart, MessageSquare, Sparkles } from 'lucide-react'

const ITEMS_PER_PAGE = 10

async function getWishlist(page: number = 1, statusFilter: string = 'all') {
  const supabase = await createClient()
  
  const from = (page - 1) * ITEMS_PER_PAGE
  const to = from + ITEMS_PER_PAGE - 1
  
  // 构建查询
  let query = supabase
    .from('wishlist')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
  
  // 添加状态过滤
  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter)
  }
  
  // 获取分页数据
  const { data, error, count } = await query.range(from, to)
  
  if (error) {
    console.error('Error fetching wishlist:', error)
    return { items: [], total: 0, totalPages: 0, stats: { total: 0, pending: 0, processing: 0, completed: 0 } }
  }
  
  const total = count || 0
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE)
  
  // 获取全量统计数据（所有状态的数量）
  const { data: allData } = await supabase
    .from('wishlist')
    .select('status')
  
  const stats = {
    total: allData?.length || 0,
    pending: allData?.filter((w) => w.status === 'pending').length || 0,
    processing: allData?.filter((w) => w.status === 'processing').length || 0,
    completed: allData?.filter((w) => w.status === 'completed').length || 0,
  }
  
  return { 
    items: data || [], 
    total, 
    totalPages,
    currentPage: page,
    stats,
    statusFilter
  }
}

interface WishlistPageProps {
  searchParams: Promise<{ page?: string; status?: string }>
}

export default async function WishlistPage(props: WishlistPageProps) {
  const searchParams = await props.searchParams
  const currentPage = parseInt(searchParams.page || '1', 10)
  const statusFilter = searchParams.status || 'all'
  const { items, total, totalPages, stats } = await getWishlist(currentPage, statusFilter)

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-secondary/20 py-16 md:py-24">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-6">
              <Heart className="w-4 h-4" />
              <span className="text-sm font-medium">心愿单</span>
            </div>
            
            <h1 className="text-3xl md:text-4xl font-bold mb-4">
              告诉小蜜蜂你的心愿
            </h1>
            
            <p className="text-muted-foreground text-lg mb-8">
              无论是小区旧改咨询、市政工程反馈，还是本地合作意向，<br className="hidden sm:block" />
              都可以在这里告诉小蜜蜂，让我们一起让洋泾乃至浦东变得更好！
            </p>

            {/* Category Tags */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-orange-500/10 text-orange-600">
                <Sparkles className="w-4 h-4" />
                <span className="text-sm">小区旧改</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 text-blue-600">
                <MessageSquare className="w-4 h-4" />
                <span className="text-sm">市政工程</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 text-green-600">
                <Heart className="w-4 h-4" />
                <span className="text-sm">本地合作</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Submit Form */}
          <div className="order-2 lg:order-1">
            <div className="sticky top-24">
              <WishlistForm />
            </div>
          </div>

          {/* Wishlist List */}
          <div className="order-1 lg:order-2">
            <WishlistList 
              wishlist={items} 
              currentPage={currentPage}
              totalPages={totalPages}
              total={total}
              stats={stats}
              statusFilter={statusFilter}
            />
          </div>
        </div>
      </section>
    </div>
  )
}
