'use client'

import { useState, useEffect } from 'react'
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
  Eye,
  AlertCircle,
  ArrowUpCircle,
  ArrowDownCircle,
  MinusCircle,
  User,
  StickyNote,
  X,
  Filter,
  CheckSquare,
  Square,
  Calendar,
  Phone,
  Mail,
  Tag,
  Send,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Tables } from '@/types/database'

type Wishlist = Tables<'wishlist'>
type WishlistNote = Tables<'wishlist_notes'>

interface WishlistManagerProps {
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

const priorityConfig = {
  low: {
    label: '低',
    icon: ArrowDownCircle,
    color: 'bg-gray-500/10 text-gray-600 border-gray-200',
  },
  medium: {
    label: '中',
    icon: MinusCircle,
    color: 'bg-blue-500/10 text-blue-600 border-blue-200',
  },
  high: {
    label: '高',
    icon: ArrowUpCircle,
    color: 'bg-orange-500/10 text-orange-600 border-orange-200',
  },
  urgent: {
    label: '紧急',
    icon: AlertCircle,
    color: 'bg-red-500/10 text-red-600 border-red-200',
  },
}

export function WishlistManager({ wishlist: initialWishlist }: WishlistManagerProps) {
  const router = useRouter()
  const supabase = createClient()
  const [wishlist, setWishlist] = useState<Wishlist[]>(initialWishlist)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [selectedItem, setSelectedItem] = useState<Wishlist | null>(null)
  const [itemNotes, setItemNotes] = useState<WishlistNote[]>([])
  const [replyText, setReplyText] = useState('')
  const [noteText, setNoteText] = useState('')
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)
  const [isReplyDialogOpen, setIsReplyDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isBatchDialogOpen, setIsBatchDialogOpen] = useState(false)
  const [batchAction, setBatchAction] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('details')

  const filteredWishlist = wishlist.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.contact_name?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter
    const matchesPriority = priorityFilter === 'all' || item.priority === priorityFilter
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter
    return matchesSearch && matchesStatus && matchesPriority && matchesCategory
  })

  const stats = {
    total: wishlist.length,
    pending: wishlist.filter((w) => w.status === 'pending').length,
    processing: wishlist.filter((w) => w.status === 'processing').length,
    completed: wishlist.filter((w) => w.status === 'completed').length,
    urgent: wishlist.filter((w) => w.priority === 'urgent' && w.status !== 'completed').length,
  }

  async function fetchNotes(wishlistId: string) {
    const { data, error } = await supabase
      .from('wishlist_notes')
      .select('*')
      .eq('wishlist_id', wishlistId)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setItemNotes(data)
    }
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

  async function updatePriority(id: string, priority: string) {
    setLoading(true)
    try {
      const { error } = await supabase
        .from('wishlist')
        .update({ priority })
        .eq('id', id)

      if (error) throw error

      setWishlist((prev) =>
        prev.map((item) => (item.id === id ? { ...item, priority: priority as any } : item))
      )
      toast.success('优先级更新成功')
    } catch (error) {
      console.error('Error updating priority:', error)
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
    } catch (error) {
      console.error('Error submitting reply:', error)
      toast.error('回复失败')
    } finally {
      setLoading(false)
    }
  }

  async function addNote() {
    if (!selectedItem || !noteText.trim()) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('wishlist_notes')
        .insert({
          wishlist_id: selectedItem.id,
          content: noteText.trim(),
        })
        .select()
        .single()

      if (error) throw error

      setItemNotes((prev) => [data, ...prev])
      setNoteText('')
      toast.success('备注添加成功')
    } catch (error) {
      console.error('Error adding note:', error)
      toast.error('添加失败')
    } finally {
      setLoading(false)
    }
  }

  async function deleteNote(noteId: string) {
    try {
      const { error } = await supabase.from('wishlist_notes').delete().eq('id', noteId)
      if (error) throw error
      setItemNotes((prev) => prev.filter((n) => n.id !== noteId))
      toast.success('备注删除成功')
    } catch (error) {
      console.error('Error deleting note:', error)
      toast.error('删除失败')
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
      setIsDetailDialogOpen(false)
      setSelectedItem(null)
    } catch (error) {
      console.error('Error deleting wishlist:', error)
      toast.error('删除失败')
    } finally {
      setLoading(false)
    }
  }

  async function batchUpdateStatus(status: string) {
    if (selectedItems.size === 0) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from('wishlist')
        .update({ status })
        .in('id', Array.from(selectedItems))

      if (error) throw error

      setWishlist((prev) =>
        prev.map((item) =>
          selectedItems.has(item.id) ? { ...item, status: status as any } : item
        )
      )
      toast.success(`已批量更新 ${selectedItems.size} 条记录`)
      setSelectedItems(new Set())
      setIsBatchDialogOpen(false)
    } catch (error) {
      console.error('Error batch updating:', error)
      toast.error('批量更新失败')
    } finally {
      setLoading(false)
    }
  }

  async function batchDelete() {
    if (selectedItems.size === 0) return

    setLoading(true)
    try {
      const { error } = await supabase.from('wishlist').delete().in('id', Array.from(selectedItems))
      if (error) throw error

      setWishlist((prev) => prev.filter((item) => !selectedItems.has(item.id)))
      toast.success(`已批量删除 ${selectedItems.size} 条记录`)
      setSelectedItems(new Set())
      setIsBatchDialogOpen(false)
    } catch (error) {
      console.error('Error batch deleting:', error)
      toast.error('批量删除失败')
    } finally {
      setLoading(false)
    }
  }

  function openDetailDialog(item: Wishlist) {
    setSelectedItem(item)
    setReplyText(item.admin_reply || '')
    fetchNotes(item.id)
    setIsDetailDialogOpen(true)
    setActiveTab('details')
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

  function toggleSelection(id: string) {
    const newSelected = new Set(selectedItems)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedItems(newSelected)
  }

  function toggleAllSelection() {
    if (selectedItems.size === filteredWishlist.length) {
      setSelectedItems(new Set())
    } else {
      setSelectedItems(new Set(filteredWishlist.map((item) => item.id)))
    }
  }

  const allSelected = filteredWishlist.length > 0 && selectedItems.size === filteredWishlist.length

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="bg-card border rounded-lg p-4">
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-sm text-muted-foreground">全部</div>
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
        <div className="bg-red-500/10 border border-red-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-red-600">{stats.urgent}</div>
          <div className="text-sm text-red-600/80">紧急</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4">
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
          <div className="flex gap-2 flex-wrap">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Filter className="w-4 h-4" />
                  状态
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setStatusFilter('all')}>全部</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('pending')}>待处理</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('processing')}>处理中</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('completed')}>已完成</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('rejected')}>已拒绝</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <AlertCircle className="w-4 h-4" />
                  优先级
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setPriorityFilter('all')}>全部</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPriorityFilter('urgent')}>紧急</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPriorityFilter('high')}>高</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPriorityFilter('medium')}>中</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPriorityFilter('low')}>低</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Tag className="w-4 h-4" />
                  分类
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setCategoryFilter('all')}>全部</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCategoryFilter('old_renovation')}>小区旧改</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCategoryFilter('municipal')}>市政工程</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCategoryFilter('cooperation')}>本地合作</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCategoryFilter('other')}>其他</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Batch Actions */}
        {selectedItems.size > 0 && (
          <div className="flex items-center gap-4 p-3 bg-primary/5 rounded-lg border border-primary/20">
            <span className="text-sm font-medium">已选择 {selectedItems.size} 项</span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setBatchAction('status')
                  setIsBatchDialogOpen(true)
                }}
              >
                批量改状态
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  setBatchAction('delete')
                  setIsBatchDialogOpen(true)
                }}
              >
                批量删除
              </Button>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setSelectedItems(new Set())}>
              取消
            </Button>
          </div>
        )}
      </div>

      {/* Wishlist Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 w-10">
                <Button variant="ghost" size="sm" className="h-auto p-0" onClick={toggleAllSelection}>
                  {allSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                </Button>
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium">优先级</th>
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
              const priority = priorityConfig[item.priority || 'medium']
              const CategoryIcon = category.icon
              const StatusIcon = status.icon
              const PriorityIcon = priority.icon

              return (
                <tr key={item.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0"
                      onClick={() => toggleSelection(item.id)}
                    >
                      {selectedItems.has(item.id) ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </Button>
                  </td>
                  <td className="px-4 py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Badge className={`${priority.color} cursor-pointer`}>
                          <PriorityIcon className="w-3 h-3 mr-1" />
                          {priority.label}
                        </Badge>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        {Object.entries(priorityConfig).map(([key, config]) => (
                          <DropdownMenuItem key={key} onClick={() => updatePriority(item.id, key)}>
                            <config.icon className="w-4 h-4 mr-2" />
                            {config.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
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
                    <div className="text-sm">{item.contact_name || '匿名'}</div>
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
                        <DropdownMenuItem onClick={() => openDetailDialog(item)}>
                          <Eye className="w-4 h-4 mr-2" />
                          查看详情
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openReplyDialog(item)}>
                          <Reply className="w-4 h-4 mr-2" />
                          回复
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
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
                        <DropdownMenuSeparator />
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

      {/* Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>工单详情</DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="details">基本信息</TabsTrigger>
                <TabsTrigger value="notes">处理记录 ({itemNotes.length})</TabsTrigger>
                <TabsTrigger value="reply">回复</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4 mt-4">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Badge className={categoryConfig[selectedItem.category].color}>
                      {categoryConfig[selectedItem.category].label}
                    </Badge>
                    <Badge className={statusConfig[selectedItem.status].color}>
                      {statusConfig[selectedItem.status].label}
                    </Badge>
                    <Badge className={priorityConfig[selectedItem.priority || 'medium'].color}>
                      优先级: {priorityConfig[selectedItem.priority || 'medium'].label}
                    </Badge>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold">{selectedItem.title}</h3>
                    <p className="text-muted-foreground mt-2 whitespace-pre-wrap">
                      {selectedItem.content}
                    </p>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">联系人:</span>
                      <span>{selectedItem.contact_name || '匿名'}</span>
                    </div>
                    {selectedItem.contact_phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">电话:</span>
                        <span>{selectedItem.contact_phone}</span>
                      </div>
                    )}
                    {selectedItem.contact_email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">邮箱:</span>
                        <span>{selectedItem.contact_email}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">提交时间:</span>
                      <span>
                        {format(new Date(selectedItem.created_at), 'yyyy-MM-dd HH:mm', {
                          locale: zhCN,
                        })}
                      </span>
                    </div>
                  </div>

                  {selectedItem.admin_reply && (
                    <>
                      <Separator />
                      <div className="bg-primary/5 p-4 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <MessageSquare className="w-4 h-4 text-primary" />
                          <span className="font-medium text-primary">回复内容</span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{selectedItem.admin_reply}</p>
                      </div>
                    </>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="notes" className="space-y-4 mt-4">
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="添加处理记录或备注..."
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      rows={2}
                      className="flex-1"
                    />
                    <Button
                      onClick={addNote}
                      disabled={loading || !noteText.trim()}
                      className="self-start"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>

                  <ScrollArea className="h-[300px]">
                    <div className="space-y-3">
                      {itemNotes.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">暂无处理记录</p>
                      ) : (
                        itemNotes.map((note) => (
                          <div key={note.id} className="bg-muted/50 p-3 rounded-lg">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm whitespace-pre-wrap flex-1">{note.content}</p>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-auto p-1"
                                onClick={() => deleteNote(note.id)}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                              {format(new Date(note.created_at), 'yyyy-MM-dd HH:mm', {
                                locale: zhCN,
                              })}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </TabsContent>

              <TabsContent value="reply" className="space-y-4 mt-4">
                <div className="space-y-4">
                  <Textarea
                    placeholder="请输入回复内容..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    rows={8}
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setActiveTab('details')}>
                      取消
                    </Button>
                    <Button onClick={submitReply} disabled={loading || !replyText.trim()}>
                      {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      提交回复
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

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
          <p className="text-muted-foreground">确定要删除这条心愿单吗？此操作不可撤销。</p>
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

      {/* Batch Action Dialog */}
      <Dialog open={isBatchDialogOpen} onOpenChange={setIsBatchDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{batchAction === 'delete' ? '批量删除' : '批量修改状态'}</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            确定要对选中的 {selectedItems.size} 条记录执行{batchAction === 'delete' ? '删除' : '状态修改'}操作吗？
          </p>
          {batchAction === 'status' && (
            <div className="flex gap-2 mt-4">
              <Button onClick={() => batchUpdateStatus('processing')} disabled={loading}>
                标记为处理中
              </Button>
              <Button onClick={() => batchUpdateStatus('completed')} disabled={loading}>
                标记为已完成
              </Button>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBatchDialogOpen(false)}>
              取消
            </Button>
            {batchAction === 'delete' && (
              <Button variant="destructive" onClick={batchDelete} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                确认删除
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
