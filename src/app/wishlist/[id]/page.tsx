import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
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
  ArrowLeft,
  Heart,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Tables } from '@/types/database'

type Wishlist = Tables<'wishlist'>

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

async function getWishlistItem(id: string): Promise<Wishlist | null> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('wishlist')
    .select('*')
    .eq('id', id)
    .single()
  
  if (error || !data) {
    return null
  }
  
  return data
}

interface WishlistDetailPageProps {
  params: { id: string }
}

export default async function WishlistDetailPage({ params }: WishlistDetailPageProps) {
  const item = await getWishlistItem(params.id)
  
  if (!item) {
    notFound()
  }
  
  const category = categoryConfig[item.category]
  const status = statusConfig[item.status]
  const CategoryIcon = category.icon
  const StatusIcon = status.icon
  
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-secondary/20 py-12 md:py-16">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
        
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link href="/wishlist">
            <Button variant="ghost" size="sm" className="mb-6">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回心愿单
            </Button>
          </Link>
          
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-4">
            <Heart className="w-4 h-4" />
            <span className="text-sm font-medium">心愿详情</span>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-card border rounded-2xl p-6 md:p-8">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
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
            <span className="text-sm text-muted-foreground">
              {format(new Date(item.created_at), 'yyyy年MM月dd日 HH:mm', { locale: zhCN })}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-2xl md:text-3xl font-bold mb-6">{item.title}</h1>

          {/* Content */}
          <div className="prose prose-sm max-w-none mb-8">
            <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {item.content}
            </p>
          </div>

          {/* Contact Info */}
          {item.contact && (
            <div className="p-4 bg-secondary/50 rounded-lg mb-6">
              <h3 className="text-sm font-medium mb-2">联系方式</h3>
              <p className="text-sm text-muted-foreground">{item.contact}</p>
            </div>
          )}

          {/* Admin Reply */}
          {item.admin_reply && (
            <div className="p-6 bg-primary/5 rounded-xl border border-primary/10">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <MessageSquare className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <span className="font-medium text-primary">小蜜蜂回复</span>
                  {item.replied_at && (
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(item.replied_at), 'yyyy年MM月dd日 HH:mm', { locale: zhCN })}
                    </p>
                  )}
                </div>
              </div>
              <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {item.admin_reply}
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="mt-8 pt-6 border-t flex items-center justify-between">
            <Link href="/wishlist">
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回列表
              </Button>
            </Link>
            <Link href="/wishlist">
              <Button>
                <Heart className="w-4 h-4 mr-2" />
                我也来许愿
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
