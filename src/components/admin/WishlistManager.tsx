'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
  Search,
  Reply,
  Trash2,
  MoreHorizontal,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Tables } from '@/types/database'

type Wishlist = Tables<'wishlist'>

interface WishlistManagerProps {
  wishlist: Wishlist[]
}

const categoryConfig = {
  old_renovation: {
    label: '小区旧改',
    icon: Sparkles,
    color: 'bg-orange-500/10 text-orange-600',
  },
  municipal: {
    label: '市政工程',
    icon: Building2,
    color: 'bg-blue-500/10 text-blue-600',
  },
  cooperation: {
    label: '本地合作',
    icon: Handshake,
    color: 'bg-green-500/10 text-green-600',
  },
  other: {
    label: '其他',
    icon: HelpCircle,
    color: 'bg-gray-500/10 text-gray-600',
  },
}

const statusConfig = {
  pending: {
    label: '待处理',
    icon: Clock,
    color: 'bg-yellow-500/10 text-yellow-600',
  },
  processing: {
    label: '处理中',
    icon: Loader2,
    color: 'bg-blue-500/10 text-blue-600',
  },
  completed: {
    label: '已完成',
    icon: CheckCircle2,
    color: 'bg-green-500/10 text-green-600',
  },
  rejected: {
    label: '已拒绝',
    icon: XCircle,
    color: 'bg-red-500/10 text-red-600',
  },
}

export function WishlistManager({ wishlist: initialWishlist }: WishlistManagerProps) {
  const router = useRouter()
  const supabase = createClient()
  const [wishlist, setWishlist] = useState(initialWishlist)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedItem, setSelectedItem] = useState<Wishlist | null>(null)
  const [replyText, setReplyText] = useState('')
  const [isReplyDialogOpen, setIsReplyDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const filteredWishlist = wishlist.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.contact_name?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const stats = {
    total: wishlist.length,
    pending: wishlist.filter((w) => w.status === 'pending').length,
    processing: wishlist.filter((w) => w.status === 'processing').length,
    completed: wishlist.filter((w) => w.status === 'completed').length,
  }

  async function updateStatus(id: string, status: string) {
    setLoading(true)
    try {
      const { error } = await supabase
        .from('wishlist')
        .update({ status })
        .eq('id', id)

      if (error) throw error

      setWishlist((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: status as any } : item))
      )
      toast.success('状态更新成功')
    } catch (error) {
      console.error('Error updating status:', error)
      toast.error('更新失败')
    } finally {
      setLoading(false)
    }
  }

  async function submitReply() {
    if (!selectedItem || !replyText.trim()) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from('wishlist')
        .update({
          admin_reply: replyText.trim(),
          status: 'completed',
        })
        .eq('id', selectedItem.id)

      if (error) throw error

      setWishlist((prev) =>
        prev.map((item) =>
          item.id === selectedItem.id
            ? { ...item, admin_reply: replyText.trim(), status: 'completed' }
            : item
        )
      )
      toast.success('回复成功')
      setIsReplyDialogOpen(false)
      setReplyText('')
      setSelectedItem(null)
    } catch (error) {
      console.error('Error submitting reply:', error)
      toast.error('回复失败')
    } finally {
      setLoading(false)
    }
  }

  async function deleteWishlist() {
    if (!selectedItem) return

    setLoading(true)
    try {
      const { error } = await supabase.from('wishlist').delete().eq('id', selectedItem.id)

      if (error) throw error

      setWishlist((prev) => prev.filter((item) => item.id !== selectedItem.id))
      toast.success('删除成功')
      setIsDeleteDialogOpen(false)
      setSelectedItem(null)
    } catch (error) {
      console.error('Error deleting wishlist:', error)
      toast.error('删除失败')
    } finally {
      setLoading(false)
    }
  }

  function openReplyDialog(item: Wishlist) {
    setSelectedItem(item)
    setReplyText(item.admin_reply || '')
    setIsReplyDialogOpen(true)
  }

  function openDeleteDialog(item: Wishlist) {
    setSelectedItem(item)
    setIsDeleteDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-card border rounded-lg p-4">
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-sm text-muted-foreground">全部心愿</div>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          <div className="text-sm text-yellow-600/80">待处理</div>
        </div>
        <div className="bg-blue-500/10 border border-blue-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-600">{stats.processing}</div>
          <div className="text-sm text-blue-600/80">处理中</div>
        </div>
        <div className="bg-green-500/10 border border-green-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
          <div className="text-sm text-green-600/80">已完成</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜索标题、内容或联系人..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          {['all', 'pending', 'processing', 'completed'].map((status) => (
            <Button
              key={status}
              variant={statusFilter === status ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(status)}
            >
              {status === 'all' && '全部'}
              {status === 'pending' && '待处理'}
              {status === 'processing' && '处理中'}
              {status === 'completed' && '已完成'}
            </Button>
          ))}
        </div>
      </div>

      {/* Wishlist Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium">分类</th>
              <th className="px-4 py-3 text-left text-sm font-medium">标题</th>
              <th className="px-4 py-3 text-left text-sm font-medium">联系人</th>
              <th className="px-4 py-3 text-left text-sm font-medium">状态</th>
              <th className="px-4 py-3 text-left text-sm font-medium">时间</th>
              <th className="px-4 py-3 text-left text-sm font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredWishlist.map((item) => {
              const category = categoryConfig[item.category]
              const status = statusConfig[item.status]
              const CategoryIcon = category.icon
              const StatusIcon = status.icon

              return (
                <tr key={item.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Badge className={category.color}>
                      <CategoryIcon className="w-3 h-3 mr-1" />
                      {category.label}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="max-w-xs">
                      <div className="font-medium truncate">{item.title}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {item.content.slice(0, 50)}...
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm">
                      {item.contact_name || '匿名'}
                    </div>
                    {item.contact_phone && (
                      <div className="text-xs text-muted-foreground">{item.contact_phone}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={status.color}>
                      <StatusIcon className={`w-3 h-3 mr-1 ${item.status === 'processing' ? 'animate-spin' : ''}`} />
                      {status.label}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {format(new Date(item.created_at), 'MM/dd HH:mm', { locale: zhCN })}
                  </td>
                  <td className="px-4 py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openReplyDialog(item)}>
                          <Reply className="w-4 h-4 mr-2" />
                          回复
                        </DropdownMenuItem>
                        {item.status === 'pending' && (
                          <DropdownMenuItem onClick={() => updateStatus(item.id, 'processing')}>
                            <Loader2 className="w-4 h-4 mr-2" />
                            标记为处理中
                          </DropdownMenuItem>
                        )}
                        {item.status !== 'completed' && (
                          <DropdownMenuItem onClick={() => updateStatus(item.id, 'completed')}>
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            标记为已完成
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => openDeleteDialog(item)}
                          className="text-red-600"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {filteredWishlist.length === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">🐝</div>
            <p className="text-muted-foreground">没有找到匹配的心愿单</p>
          </div>
        )}
      </div>

      {/* Reply Dialog */}
      <Dialog open={isReplyDialogOpen} onOpenChange={setIsReplyDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>回复心愿</DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div className="bg-muted/50 p-3 rounded-lg">
                <div className="font-medium">{selectedItem.title}</div>
                <div className="text-sm text-muted-foreground mt-1">{selectedItem.content}</div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">回复内容</label>
                <Textarea
                  placeholder="请输入回复内容..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReplyDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={submitReply} disabled={loading || !replyText.trim()}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              提交回复
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            确定要删除这条心愿单吗？此操作不可撤销。
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={deleteWishlist} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
