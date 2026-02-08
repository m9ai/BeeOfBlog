'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  MessageSquare,
  Sparkles,
  Building2,
  Handshake,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Tables } from '@/types/database'

type Wishlist = Tables<'wishlist'>

interface WishlistListProps {
  wishlist: Wishlist[]
  currentPage: number
  totalPages: number
  total: number
  stats: {
    total: number
    pending: number
    processing: number
    completed: number
  }
  statusFilter: string
}

const categoryConfig = {
  old_renovation: {
    label: '小区旧改',
    icon: Sparkles,
    color: 'bg-orange-500/10 text-orange-600 border-orange-200',
  },
  municipal: {
    label: '市政工程',
    icon: Building2,
    color: 'bg-blue-500/10 text-blue-600 border-blue-200',
  },
  cooperation: {
    label: '本地合作',
    icon: Handshake,
    color: 'bg-green-500/10 text-green-600 border-green-200',
  },
  other: {
    label: '其他',
    icon: HelpCircle,
    color: 'bg-gray-500/10 text-gray-600 border-gray-200',
  },
}

const statusConfig = {
  pending: {
    label: '待处理',
    icon: Clock,
    color: 'bg-yellow-500/10 text-yellow-600 border-yellow-200',
  },
  processing: {
    label: '处理中',
    icon: Loader2,
    color: 'bg-blue-500/10 text-blue-600 border-blue-200',
  },
  completed: {
    label: '已完成',
    icon: CheckCircle2,
    color: 'bg-green-500/10 text-green-600 border-green-200',
  },
  rejected: {
    label: '已拒绝',
    icon: XCircle,
    color: 'bg-red-500/10 text-red-600 border-red-200',
  },
}

function WishlistCard({ item }: { item: Wishlist }) {
  const [expanded, setExpanded] = useState(false)

  const category = categoryConfig[item.category]
  const status = statusConfig[item.status]
  const CategoryIcon = category.icon
  const StatusIcon = status.icon

  return (
    <Link href={`/wishlist/${item.id}`} className="block">
      <div className="bg-card border rounded-xl p-5 hover:shadow-md transition-shadow cursor-pointer">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={category.color}>
              <CategoryIcon className="w-3 h-3 mr-1" />
              {category.label}
            </Badge>
            <Badge variant="outline" className={status.color}>
              <StatusIcon className={`w-3 h-3 mr-1 ${item.status === 'processing' ? 'animate-spin' : ''}`} />
              {status.label}
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {format(new Date(item.created_at), 'MM/dd', { locale: zhCN })}
          </span>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-lg mb-2">{item.title}</h3>

        {/* Content */}
        <div className="relative">
          <p className={`text-muted-foreground text-sm ${expanded ? '' : 'line-clamp-3'}`}>
            {item.content}
          </p>
          {!expanded && item.content.length > 100 && (
            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-card to-transparent" />
          )}
        </div>

        {/* Expand Button - prevent link navigation */}
        {item.content.length > 100 && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 h-auto py-1 text-xs"
            onClick={(e) => {
              e.preventDefault()
              setExpanded(!expanded)
            }}
          >
            {expanded ? (
              <>
                <ChevronUp className="w-3 h-3 mr-1" />
                收起
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3 mr-1" />
                展开更多
              </>
            )}
          </Button>
        )}

        {/* Admin Reply */}
        {item.admin_reply && (
          <div className="mt-4 p-4 bg-primary/5 rounded-lg border border-primary/10">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">小蜜蜂回复</span>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">{item.admin_reply}</p>
          </div>
        )}
      </div>
    </Link>
  )
}

function Pagination({
  currentPage,
  totalPages,
  total,
  statusFilter,
}: {
  currentPage: number
  totalPages: number
  total: number
  statusFilter: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', page.toString())
    if (statusFilter !== 'all') {
      params.set('status', statusFilter)
    } else {
      params.delete('status')
    }
    router.push(`/wishlist?${params.toString()}`)
  }

  const getPageNumbers = () => {
    const pages: (number | string)[] = []
    const maxVisible = 5

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          pages.push(i)
        }
        pages.push('...')
        pages.push(totalPages)
      } else if (currentPage >= totalPages - 2) {
        pages.push(1)
        pages.push('...')
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i)
        }
      } else {
        pages.push(1)
        pages.push('...')
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i)
        }
        pages.push('...')
        pages.push(totalPages)
      }
    }

    return pages
  }

  if (totalPages <= 1) return null

  return (
    <div className="flex flex-col items-center gap-4 mt-8">
      <p className="text-sm text-muted-foreground">
        共 {total} 条心愿，第 {currentPage}/{totalPages} 页
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="w-4 h-4" />
          上一页
        </Button>

        <div className="flex items-center gap-1">
          {getPageNumbers().map((page, index) => (
            <div key={index}>
              {page === '...' ? (
                <span className="px-2 text-muted-foreground">...</span>
              ) : (
                <Button
                  variant={currentPage === page ? 'default' : 'outline'}
                  size="sm"
                  className="min-w-[40px]"
                  onClick={() => goToPage(page as number)}
                >
                  {page}
                </Button>
              )}
            </div>
          ))}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          下一页
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}

export function WishlistList({ wishlist, currentPage, totalPages, total, stats, statusFilter }: WishlistListProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const setFilter = (filter: 'all' | 'pending' | 'processing' | 'completed') => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', '1') // 切换过滤时重置到第一页
    if (filter !== 'all') {
      params.set('status', filter)
    } else {
      params.delete('status')
    }
    router.push(`/wishlist?${params.toString()}`)
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`p-3 rounded-lg text-center transition-colors ${
            statusFilter === 'all' ? 'bg-primary/10 text-primary' : 'bg-secondary/50 hover:bg-secondary'
          }`}
        >
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-xs text-muted-foreground">全部</div>
        </button>
        <button
          onClick={() => setFilter('pending')}
          className={`p-3 rounded-lg text-center transition-colors ${
            statusFilter === 'pending' ? 'bg-yellow-500/10 text-yellow-600' : 'bg-secondary/50 hover:bg-secondary'
          }`}
        >
          <div className="text-2xl font-bold">{stats.pending}</div>
          <div className="text-xs text-muted-foreground">待处理</div>
        </button>
        <button
          onClick={() => setFilter('processing')}
          className={`p-3 rounded-lg text-center transition-colors ${
            statusFilter === 'processing' ? 'bg-blue-500/10 text-blue-600' : 'bg-secondary/50 hover:bg-secondary'
          }`}
        >
          <div className="text-2xl font-bold">{stats.processing}</div>
          <div className="text-xs text-muted-foreground">处理中</div>
        </button>
        <button
          onClick={() => setFilter('completed')}
          className={`p-3 rounded-lg text-center transition-colors ${
            statusFilter === 'completed' ? 'bg-green-500/10 text-green-600' : 'bg-secondary/50 hover:bg-secondary'
          }`}
        >
          <div className="text-2xl font-bold">{stats.completed}</div>
          <div className="text-xs text-muted-foreground">已完成</div>
        </button>
      </div>

      {/* List */}
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" />
          大家的心愿
          <span className="text-sm font-normal text-muted-foreground">({wishlist.length})</span>
        </h3>

        {wishlist.length > 0 ? (
          <div className="space-y-4">
            {wishlist.map((item) => (
              <WishlistCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-secondary/30 rounded-xl">
            <div className="text-4xl mb-3">🐝</div>
            <p className="text-muted-foreground">
              {statusFilter === 'all'
                ? '还没有人提交心愿，快来第一个提交吧！'
                : '该状态下暂时没有心愿单'}
            </p>
          </div>
        )}

        {/* Pagination */}
        <Pagination currentPage={currentPage} totalPages={totalPages} total={total} statusFilter={statusFilter} />
      </div>
    </div>
  )
}
