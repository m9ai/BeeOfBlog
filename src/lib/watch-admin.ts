/**
 * 「小蜜蜂盯」后台管理数据访问层（服务端专用）
 *
 * 与 src/lib/watch.ts 的区别：
 *   - watch.ts 面向小程序端，一切查询都以「本人 openid + appid」为边界；
 *   - 本模块面向后台管理员，跨用户查看全部事项、改状态、软删除、读任意附件。
 *
 * 因此本模块只能在已通过 checkAdmin() 校验的上下文里调用，绝不对外暴露。
 *
 * 数据访问与心愿单后台（admin/wishlist）保持一致：直接用管理员自己的登录会话
 * （@/lib/supabase/server）读写，不额外依赖 service_role key。
 * 权限由 20261005_watch_tasks_admin_rls.sql 里的管理员策略放行。
 */

import { createClient } from './supabase/server'
import { appDisplayName } from './wx-apps'
import * as media from './watch-media'
import type { WatchAttachmentRow, WatchStatus, WatchTaskRow } from './watch'

const TASK_TABLE = 'watch_tasks'
const ATTACHMENT_TABLE = 'watch_attachments'

/** 后台列表默认每页条数 */
export const ADMIN_PAGE_SIZE = 20

/**
 * 状态筛选值：
 *   - 'active'：排除已删除（后台默认视图）
 *   - 'all'：全部（含已删除）
 *   - 具体状态：submitted / watching / resolved / closed / deleted
 */
export type WatchStatusFilter = 'active' | 'all' | WatchStatus

export type WatchTaskWithAttachments = WatchTaskRow & {
  attachments: WatchAttachmentRow[]
  /** 来源小程序展示名（appid 不便直接展示） */
  appName: string
}

export type WatchStats = {
  active: number
  submitted: number
  watching: number
  resolved: number
  closed: number
  deleted: number
}

// ---------------------------------------------------------------- 列表

export async function listWatchTasksForAdmin(input: {
  page: number
  pageSize?: number
  status?: WatchStatusFilter
  keyword?: string
  appid?: string
}): Promise<{
  items: WatchTaskWithAttachments[]
  total: number
  totalPages: number
  stats: WatchStats
}> {
  const pageSize = input.pageSize ?? ADMIN_PAGE_SIZE
  const db = await createClient()

  // 过滤必须在 order/range 之前：PostgREST 的 TransformBuilder 不再提供 eq/neq
  let query = db.from(TASK_TABLE).select('*', { count: 'exact' })

  const status = input.status ?? 'active'
  if (status === 'active') {
    query = query.neq('status', 'deleted')
  } else if (status !== 'all') {
    query = query.eq('status', status)
  }

  const appid = (input.appid ?? '').trim()
  if (appid) {
    query = query.eq('appid', appid)
  }

  const keyword = sanitizeKeyword(input.keyword)
  if (keyword) {
    // PostgREST 的 or() 用逗号分隔条件，值里不能出现逗号；% / _ 是通配符，一并剔除
    query = query.or(
      `title.ilike.%${keyword}%,location.ilike.%${keyword}%,detail.ilike.%${keyword}%,task_no.ilike.%${keyword}%`
    )
  }

  const from = (input.page - 1) * pageSize
  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1)

  if (error) {
    throw new Error(`查询盯事项失败: ${error.message}`)
  }

  const tasks = (data as WatchTaskRow[]) ?? []
  const total = count ?? 0

  return {
    items: await attachAttachments(tasks),
    total,
    totalPages: Math.max(Math.ceil(total / pageSize), 1),
    stats: await fetchStats(),
  }
}

// ---------------------------------------------------------------- 单条

export async function getWatchTaskForAdmin(id: string): Promise<WatchTaskWithAttachments | null> {
  const db = await createClient()

  const { data, error } = await db
    .from(TASK_TABLE)
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw new Error(`查询盯事项失败: ${error.message}`)
  }

  if (!data) {
    return null
  }

  const [withAttachments] = await attachAttachments([data as WatchTaskRow])

  return withAttachments
}

// ---------------------------------------------------------------- 写操作

/** 改状态：只允许枚举内的值，避免写入脏数据 */
export async function updateWatchTaskStatus(id: string, status: WatchStatus): Promise<void> {
  const db = await createClient()

  const { error } = await db.from(TASK_TABLE).update({ status }).eq('id', id)

  if (error) {
    throw new Error(`更新状态失败: ${error.message}`)
  }
}

/**
 * 软删除：只把状态置为 deleted，不动数据行。
 * 小程序端 listOwned / findTaskOwned 已过滤 deleted，用户侧立即不可见；
 * 后台仍可通过状态筛选「已删除」查回来，便于误删恢复。
 */
export async function softDeleteWatchTask(id: string): Promise<void> {
  await updateWatchTaskStatus(id, 'deleted')
}

// ---------------------------------------------------------------- 附件

/**
 * 后台读取任意附件（跳过归属校验，管理员已由 isAdmin() 把关）。
 * 返回对象存储短时效签名 URL，由路由 307 重定向。
 */
export async function resolveAttachmentUrlForAdmin(
  id: string,
  disposition: 'inline' | 'download' = 'inline'
): Promise<{ attachment: WatchAttachmentRow; url: string }> {
  const db = await createClient()

  const { data, error } = await db
    .from(ATTACHMENT_TABLE)
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw new Error(`查询附件失败: ${error.message}`)
  }

  if (!data) {
    throw new Error('未找到该附件')
  }

  const attachment = data as WatchAttachmentRow

  const url = await media.signedUrl(attachment.file_key, {
    download:
      disposition === 'download' ? `${attachment.id}${extensionOf(attachment.file_key)}` : false,
    // 用管理员自己的会话客户端签发，不依赖 service_role
    client: db,
  })

  if (!url) {
    throw new Error('附件已失效')
  }

  return { attachment, url }
}

// ---------------------------------------------------------------- 内部

/** 一次查回整页事项的附件，避免 N+1 */
async function attachAttachments(tasks: WatchTaskRow[]): Promise<WatchTaskWithAttachments[]> {
  if (tasks.length === 0) {
    return []
  }

  const db = await createClient()

  const { data, error } = await db
    .from(ATTACHMENT_TABLE)
    .select('*')
    .in(
      'task_id',
      tasks.map((task) => task.id)
    )
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(`查询附件失败: ${error.message}`)
  }

  const grouped = new Map<string, WatchAttachmentRow[]>()

  for (const row of (data as WatchAttachmentRow[]) ?? []) {
    if (!row.task_id) {
      continue
    }

    const list = grouped.get(row.task_id) ?? []
    list.push(row)
    grouped.set(row.task_id, list)
  }

  return tasks.map((task) => ({
    ...task,
    attachments: grouped.get(task.id) ?? [],
    appName: appDisplayName(task.appid),
  }))
}

async function fetchStats(): Promise<WatchStats> {
  const [active, submitted, watching, resolved, closed, deleted] = await Promise.all([
    countBy('active'),
    countBy('submitted'),
    countBy('watching'),
    countBy('resolved'),
    countBy('closed'),
    countBy('deleted'),
  ])

  return { active, submitted, watching, resolved, closed, deleted }
}

async function countBy(status: WatchStatusFilter): Promise<number> {
  const base = (await createClient())
    .from(TASK_TABLE)
    .select('*', { count: 'exact', head: true })

  const { count, error } =
    status === 'active'
      ? await base.neq('status', 'deleted')
      : status === 'all'
        ? await base
        : await base.eq('status', status)

  if (error) {
    throw new Error(`统计盯事项失败: ${error.message}`)
  }

  return count ?? 0
}

/** 去掉会破坏 PostgREST or() 语法与模糊匹配语义的字符 */
function sanitizeKeyword(keyword?: string): string {
  return (keyword ?? '').trim().replace(/[,%_()]/g, ' ').replace(/\s+/g, ' ').trim()
}

function extensionOf(fileKey: string): string {
  const index = fileKey.lastIndexOf('.')

  return index > 0 ? fileKey.slice(index) : ''
}
