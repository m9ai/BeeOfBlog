'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
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
  ChevronUp
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Tables } from '@/types/database'

type Wishlist = Tables<'wishlist'>

interface WishlistListProps {
  wishlist: Wishlist[]
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
    <div className="bg-card border rounded-xl p-5 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-2">
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

      {/* Expand Button */}
      {item.content.length > 100 && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 h-auto py-1 text-xs"
          onClick={() => setExpanded(!expanded)}
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
          <p className="text-sm text-muted-foreground">{item.admin_reply}</p>
        </div>
      )}
    </div>
  )
}

export function WishlistList({ wishlist }: WishlistListProps) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'processing' | 'completed'>('all')

  const filteredWishlist = wishlist.filter((item) => {
    if (filter === 'all') return true
    return item.status === filter
  })

  const stats = {
    total: wishlist.length,
    pending: wishlist.filter((w) => w.status === 'pending').length,
    processing: wishlist.filter((w) => w.status === 'processing').length,
    completed: wishlist.filter((w) => w.status === 'completed').length,
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`p-3 rounded-lg text-center transition-colors ${
            filter === 'all' ? 'bg-primary/10 text-primary' : 'bg-secondary/50 hover:bg-secondary'
          }`}
        >
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-xs text-muted-foreground">全部</div>
        </button>
        <button
          onClick={() => setFilter('pending')}
          className={`p-3 rounded-lg text-center transition-colors ${
            filter === 'pending' ? 'bg-yellow-500/10 text-yellow-600' : 'bg-secondary/50 hover:bg-secondary'
          }`}
        >
          <div className="text-2xl font-bold">{stats.pending}</div>
          <div className="text-xs text-muted-foreground">待处理</div>
        </button>
        <button
          onClick={() => setFilter('processing')}
          className={`p-3 rounded-lg text-center transition-colors ${
            filter === 'processing' ? 'bg-blue-500/10 text-blue-600' : 'bg-secondary/50 hover:bg-secondary'
          }`}
        >
          <div className="text-2xl font-bold">{stats.processing}</div>
          <div className="text-xs text-muted-foreground">处理中</div>
        </button>
        <button
          onClick={() => setFilter('completed')}
          className={`p-3 rounded-lg text-center transition-colors ${
            filter === 'completed' ? 'bg-green-500/10 text-green-600' : 'bg-secondary/50 hover:bg-secondary'
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
          <span className="text-sm font-normal text-muted-foreground">
            ({filteredWishlist.length})
          </span>
        </h3>

        {filteredWishlist.length > 0 ? (
          <div className="space-y-4">
            {filteredWishlist.map((item) => (
              <WishlistCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-secondary/30 rounded-xl">
            <div className="text-4xl mb-3">🐝</div>
            <p className="text-muted-foreground">
              {filter === 'all' 
                ? '还没有人提交心愿，快来第一个提交吧！' 
                : '该状态下暂时没有心愿单'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
