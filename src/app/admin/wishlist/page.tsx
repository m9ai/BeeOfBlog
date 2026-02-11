import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { WishlistManager } from '@/components/admin/WishlistManager'

const ITEMS_PER_PAGE = 15

async function checkAdmin() {
  const supabase = await createClient()
  
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    return false
  }
  
  return true
}

async function getWishlist(
  page: number = 1,
  statusFilter: string = 'all',
  priorityFilter: string = 'all',
  categoryFilter: string = 'all'
) {
  const supabase = await createClient()

  const from = (page - 1) * ITEMS_PER_PAGE
  const to = from + ITEMS_PER_PAGE - 1

  // 构建查询
  let query = supabase
    .from('wishlist')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  // 添加筛选条件
  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter)
  }
  if (priorityFilter !== 'all') {
    query = query.eq('priority', priorityFilter)
  }
  if (categoryFilter !== 'all') {
    query = query.eq('category', categoryFilter)
  }

  const { data, error, count } = await query.range(from, to)

  if (error) {
    console.error('Error fetching wishlist:', error)
    return { items: [], total: 0, totalPages: 0, stats: { total: 0, pending: 0, processing: 0, completed: 0, urgent: 0 } }
  }

  const total = count || 0
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE)

  // 获取全量统计数据（所有状态的数量，不受筛选影响）
  const { data: allData } = await supabase
    .from('wishlist')
    .select('status, priority')

  const stats = {
    total: allData?.length || 0,
    pending: allData?.filter((w) => w.status === 'pending').length || 0,
    processing: allData?.filter((w) => w.status === 'processing').length || 0,
    completed: allData?.filter((w) => w.status === 'completed').length || 0,
    urgent: allData?.filter((w) => w.priority === 'urgent' && w.status !== 'completed').length || 0,
  }

  return {
    items: data || [],
    total,
    totalPages,
    currentPage: page,
    stats,
    statusFilter,
    priorityFilter,
    categoryFilter
  }
}

interface AdminWishlistPageProps {
  searchParams: Promise<{ page?: string; status?: string; priority?: string; category?: string }>
}

export default async function AdminWishlistPage(props: AdminWishlistPageProps) {
  const searchParams = await props.searchParams
  const isAdmin = await checkAdmin()
  
  if (!isAdmin) {
    redirect('/admin/login')
  }
  
  const currentPage = parseInt(searchParams.page || '1', 10)
  const statusFilter = searchParams.status || 'all'
  const priorityFilter = searchParams.priority || 'all'
  const categoryFilter = searchParams.category || 'all'
  const { items, total, totalPages, stats } = await getWishlist(currentPage, statusFilter, priorityFilter, categoryFilter)

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">心愿单管理</h1>
        <p className="text-muted-foreground">
          管理用户提交的心愿诉求，及时回复处理
        </p>
      </div>

      <WishlistManager
        wishlist={items}
        currentPage={currentPage}
        totalPages={totalPages}
        total={total}
        stats={stats}
        statusFilter={statusFilter}
        priorityFilter={priorityFilter}
        categoryFilter={categoryFilter}
      />
    </div>
  )
}
