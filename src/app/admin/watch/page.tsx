import { redirect } from 'next/navigation'
import { AlertTriangle, ArrowLeft, Eye } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { checkAdmin } from '@/lib/admin-guard'
import { listWatchTasksForAdmin, type WatchStats } from '@/lib/watch-admin'
import type { WatchStatusFilter } from '@/lib/watch-admin'
import { WatchTaskManager } from '@/components/admin/WatchTaskManager'

export const dynamic = 'force-dynamic'

const VALID_STATUS: WatchStatusFilter[] = [
  'active',
  'all',
  'submitted',
  'watching',
  'resolved',
  'closed',
  'deleted',
]

const EMPTY_STATS: WatchStats = {
  active: 0,
  submitted: 0,
  watching: 0,
  resolved: 0,
  closed: 0,
  deleted: 0,
}

interface AdminWatchPageProps {
  searchParams: { page?: string; status?: string; keyword?: string }
}

export default async function AdminWatchPage({ searchParams }: AdminWatchPageProps) {
  const guard = await checkAdmin()

  // 只有「确实没登录」才跳登录页；已登录但非管理员展示 403，避免把人踢出去
  if (!guard.ok && guard.reason === 'no-session') {
    redirect('/admin/login')
  }

  if (!guard.ok) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto mt-24 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-xl bg-red-500/10 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold">无访问权限</h1>
          <p className="text-muted-foreground">
            当前账号不是管理员，无法查看「小蜜蜂盯」事项。
          </p>
          <Link href="/admin">
            <Button variant="outline">返回后台首页</Button>
          </Link>
        </div>
      </div>
    )
  }

  const page = Math.max(Number.parseInt(searchParams.page || '1', 10) || 1, 1)
  const rawStatus = (searchParams.status || 'active') as WatchStatusFilter
  const status = VALID_STATUS.includes(rawStatus) ? rawStatus : 'active'
  const keyword = (searchParams.keyword || '').trim()

  // 取数失败（缺 service role key / 服务端连不上 Supabase）时降级为空列表 + 提示，
  // 避免整页 500 变成客户端异常白屏
  let items: Awaited<ReturnType<typeof listWatchTasksForAdmin>>['items'] = []
  let total = 0
  let totalPages = 1
  let stats = EMPTY_STATS
  let queryError: string | null = null

  try {
    const result = await listWatchTasksForAdmin({ page, status, keyword })
    items = result.items
    total = result.total
    totalPages = result.totalPages
    stats = result.stats
  } catch (error) {
    queryError = (error as Error).message || '未知错误'
    console.error('[admin/watch] 查询盯事项失败:', error)
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Link href="/admin">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <Eye className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">小蜜蜂盯</h1>
            <p className="text-muted-foreground">
              管理小程序用户提交的盯事项，跟进处理进度
            </p>
          </div>
        </div>
      </div>

      {queryError && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">事项数据加载失败</p>
            <p className="mt-1 text-red-600/80">{queryError}</p>
          </div>
        </div>
      )}

      <WatchTaskManager
        tasks={items}
        currentPage={page}
        totalPages={totalPages}
        total={total}
        stats={stats}
        statusFilter={status}
        keyword={keyword}
      />
    </div>
  )
}
