'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import {
  Clock,
  Eye,
  CheckCircle2,
  Archive,
  Trash2,
  Loader2,
  Search,
  MoreHorizontal,
  Image as ImageIcon,
  Video,
  MapPin,
  Hash,
  User,
  Smartphone,
  ChevronLeft,
  ChevronRight,
  Filter,
  Download,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import type { WatchStats, WatchTaskWithAttachments } from '@/lib/watch-admin'
import type { WatchStatus } from '@/lib/watch'

type WatchStatusFilter = 'active' | 'all' | WatchStatus

interface WatchTaskManagerProps {
  tasks: WatchTaskWithAttachments[]
  currentPage: number
  totalPages: number
  total: number
  stats: WatchStats
  statusFilter: WatchStatusFilter
  keyword: string
}

const statusConfig: Record<WatchStatus, { label: string; icon: typeof Clock; className: string }> = {
  submitted: {
    label: '待处理',
    icon: Clock,
    className: 'bg-yellow-500/10 text-yellow-600 border-yellow-200',
  },
  watching: {
    label: '跟进中',
    icon: Eye,
    className: 'bg-blue-500/10 text-blue-600 border-blue-200',
  },
  resolved: {
    label: '已解决',
    icon: CheckCircle2,
    className: 'bg-green-500/10 text-green-600 border-green-200',
  },
  closed: {
    label: '已关闭',
    icon: Archive,
    className: 'bg-gray-500/10 text-gray-600 border-gray-200',
  },
  deleted: {
    label: '已删除',
    icon: Trash2,
    className: 'bg-red-500/10 text-red-600 border-red-200',
  },
}

const filterOptions: { value: WatchStatusFilter; label: string }[] = [
  { value: 'active', label: '未删除（默认）' },
  { value: 'all', label: '全部' },
  { value: 'submitted', label: '待处理' },
  { value: 'watching', label: '跟进中' },
  { value: 'resolved', label: '已解决' },
  { value: 'closed', label: '已关闭' },
  { value: 'deleted', label: '已删除' },
]

const NEXT_STATUSES: { value: WatchStatus; label: string }[] = [
  { value: 'watching', label: '标记为跟进中' },
  { value: 'resolved', label: '标记为已解决' },
  { value: 'closed', label: '标记为已关闭' },
  { value: 'submitted', label: '退回待处理' },
]

function Pagination({
  currentPage,
  totalPages,
  total,
}: {
  currentPage: number
  totalPages: number
  total: number
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(page))
    router.push(`/admin/watch?${params.toString()}`)
  }

  if (totalPages <= 1) return null

  return (
    <div className="flex flex-col items-center gap-4 mt-8 pt-6 border-t">
      <p className="text-sm text-muted-foreground">
        共 {total} 条事项，第 {currentPage}/{totalPages} 页
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          上一页
        </Button>
        <span className="text-sm px-2">{currentPage}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          下一页
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  )
}

export function WatchTaskManager({
  tasks: initialTasks,
  currentPage,
  totalPages,
  total,
  stats,
  statusFilter,
  keyword: initialKeyword,
}: WatchTaskManagerProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [tasks, setTasks] = useState<WatchTaskWithAttachments[]>(initialTasks)
  const [searchInput, setSearchInput] = useState(initialKeyword)
  const [selected, setSelected] = useState<WatchTaskWithAttachments | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setTasks(initialTasks)
  }, [initialTasks])

  useEffect(() => {
    setSearchInput(initialKeyword)
  }, [initialKeyword])

  const updateParams = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())

    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === '' || value === 'all') {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    }

    params.delete('page')
    router.push(`/admin/watch?${params.toString()}`)
  }

  async function changeStatus(id: string, status: WatchStatus) {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/watch/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload?.error || '更新失败')
      }

      setTasks((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item)))
      if (selected?.id === id) {
        setSelected((prev) => (prev ? { ...prev, status } : prev))
      }
      toast.success('状态更新成功')
      // 统计数字在服务端，刷新以同步
      router.refresh()
    } catch (error) {
      console.error('[watch-admin] 更新状态失败:', error)
      toast.error((error as Error).message || '更新失败')
    } finally {
      setLoading(false)
    }
  }

  async function confirmDelete() {
    if (!selected) return

    setLoading(true)
    try {
      const res = await fetch(`/api/admin/watch/tasks/${selected.id}`, { method: 'DELETE' })

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload?.error || '删除失败')
      }

      setTasks((prev) =>
        prev.map((item) => (item.id === selected.id ? { ...item, status: 'deleted' } : item))
      )
      toast.success('已删除（软删除，可改状态恢复）')
      setIsDeleteOpen(false)
      setIsDetailOpen(false)
      setSelected(null)
      router.refresh()
    } catch (error) {
      console.error('[watch-admin] 删除失败:', error)
      toast.error((error as Error).message || '删除失败')
    } finally {
      setLoading(false)
    }
  }

  function openDetail(task: WatchTaskWithAttachments) {
    setSelected(task)
    setIsDetailOpen(true)
  }

  const statusMeta = (status: string) =>
    statusConfig[status as WatchStatus] ?? {
      label: status,
      icon: Clock,
      className: 'bg-gray-500/10 text-gray-600 border-gray-200',
    }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="bg-card border rounded-lg p-4">
          <div className="text-2xl font-bold">{stats.active}</div>
          <div className="text-sm text-muted-foreground">未删除</div>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-yellow-600">{stats.submitted}</div>
          <div className="text-sm text-yellow-600/80">待处理</div>
        </div>
        <div className="bg-blue-500/10 border border-blue-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-600">{stats.watching}</div>
          <div className="text-sm text-blue-600/80">跟进中</div>
        </div>
        <div className="bg-green-500/10 border border-green-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-600">{stats.resolved}</div>
          <div className="text-sm text-green-600/80">已解决</div>
        </div>
        <div className="bg-gray-500/10 border border-gray-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-gray-600">{stats.closed}</div>
          <div className="text-sm text-gray-600/80">已关闭</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <form
          className="relative flex-1"
          onSubmit={(e) => {
            e.preventDefault()
            updateParams({ keyword: searchInput.trim() || null })
          }}
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜索编号 / 事项 / 地点 / 详情"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-10"
          />
        </form>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="w-4 h-4" />
              状态
              <span className="text-muted-foreground">
                {filterOptions.find((o) => o.value === statusFilter)?.label ?? statusFilter}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {filterOptions.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={() => updateParams({ status: option.value })}
              >
                {option.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">编号</th>
                <th className="px-4 py-3 text-left text-sm font-medium">事项 / 地点</th>
                <th className="px-4 py-3 text-left text-sm font-medium">附件</th>
                <th className="px-4 py-3 text-left text-sm font-medium">来源</th>
                <th className="px-4 py-3 text-left text-sm font-medium">状态</th>
                <th className="px-4 py-3 text-left text-sm font-medium">时间</th>
                <th className="px-4 py-3 text-right text-sm font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {tasks.map((task) => {
                const meta = statusMeta(task.status)
                const StatusIcon = meta.icon
                const images = task.attachments.filter((a) => a.kind === 'image').length
                const videos = task.attachments.filter((a) => a.kind === 'video').length

                return (
                  <tr key={task.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-sm font-mono">
                        <Hash className="w-3 h-3 text-muted-foreground" />
                        {task.task_no}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="text-left max-w-xs block"
                        onClick={() => openDetail(task)}
                      >
                        <div className="font-medium truncate hover:underline">{task.title}</div>
                        <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {task.location}
                        </div>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      {task.attachments.length === 0 ? (
                        <span className="text-sm text-muted-foreground">-</span>
                      ) : (
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          {images > 0 && (
                            <span className="flex items-center gap-1">
                              <ImageIcon className="w-3.5 h-3.5" />
                              {images}
                            </span>
                          )}
                          {videos > 0 && (
                            <span className="flex items-center gap-1">
                              <Video className="w-3.5 h-3.5" />
                              {videos}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-1">
                        <Smartphone className="w-3.5 h-3.5 text-muted-foreground" />
                        {task.appName}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={meta.className}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {meta.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                      {format(new Date(task.created_at), 'MM/dd HH:mm', { locale: zhCN })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openDetail(task)}>
                              <Eye className="w-4 h-4 mr-2" />
                              查看详情
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {NEXT_STATUSES.filter((item) => item.value !== task.status).map(
                              (item) => {
                                const ItemIcon = statusConfig[item.value].icon

                                return (
                                  <DropdownMenuItem
                                    key={item.value}
                                    onClick={() => changeStatus(task.id, item.value)}
                                  >
                                    <ItemIcon className="w-4 h-4 mr-2" />
                                    {item.label}
                                  </DropdownMenuItem>
                                )
                              }
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => {
                                setSelected(task)
                                setIsDeleteOpen(true)
                              }}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              删除
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {tasks.length === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">🐝</div>
            <p className="text-muted-foreground">
              {initialKeyword ? '没有匹配的事项' : '还没有用户提交盯事项'}
            </p>
          </div>
        )}
      </div>

      <Pagination currentPage={currentPage} totalPages={totalPages} total={total} />

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>事项详情</DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={statusMeta(selected.status).className}>
                  {statusMeta(selected.status).label}
                </Badge>
                <Badge variant="outline" className="font-mono">
                  {selected.task_no}
                </Badge>
                <Badge variant="outline">{selected.appName}</Badge>
              </div>

              <div>
                <h3 className="text-lg font-semibold">{selected.title}</h3>
                <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {selected.location}
                </p>
              </div>

              {selected.detail && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-sm whitespace-pre-wrap">{selected.detail}</p>
                </div>
              )}

              <Separator />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">提交者：</span>
                  <span className="font-mono text-xs">{selected.openid}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">appid：</span>
                  <span className="font-mono text-xs">{selected.appid}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">提交时间：</span>
                  <span>
                    {format(new Date(selected.created_at), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">更新时间：</span>
                  <span>
                    {format(new Date(selected.updated_at), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                  </span>
                </div>
              </div>

              {selected.attachments.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <div className="font-medium mb-3">
                      附件（{selected.attachments.length}）
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {selected.attachments.map((attachment) => (
                        <div key={attachment.id} className="space-y-1">
                          {attachment.kind === 'image' ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={`/api/admin/watch/attachments/${attachment.id}`}
                              alt={attachment.file_key}
                              className="w-full aspect-square object-cover rounded-lg border"
                            />
                          ) : (
                            <video
                              src={`/api/admin/watch/attachments/${attachment.id}`}
                              controls
                              className="w-full aspect-square object-cover rounded-lg border bg-black"
                            />
                          )}
                          <a
                            href={`/api/admin/watch/attachments/${attachment.id}?disposition=download`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                          >
                            <Download className="w-3 h-3" />
                            下载
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <Separator />

              <div className="flex flex-wrap gap-2">
                {NEXT_STATUSES.filter((item) => item.value !== selected.status).map((item) => (
                  <Button
                    key={item.value}
                    variant="outline"
                    size="sm"
                    disabled={loading}
                    onClick={() => changeStatus(selected.id, item.value)}
                  >
                    {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {item.label}
                  </Button>
                ))}
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={loading}
                  onClick={() => setIsDeleteOpen(true)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  删除
                </Button>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            确定要删除事项
            {selected ? `「${selected.title}」` : ''}吗？
          </p>
          <p className="text-sm text-muted-foreground">
            这是软删除：数据仍保留，可在状态里改回「待处理」恢复，小程序端会立即不可见。
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
