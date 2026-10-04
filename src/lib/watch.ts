/**
 * 小程序「小蜜蜂盯」业务模块（服务端）
 *
 * 移植自 m9ai-server 的 src/wx/watch（NestJS + Drizzle/D1），
 * 适配本项目的 Next.js App Router + Supabase(Postgres/Storage) 技术栈。
 *
 * MVP 范围：用户提交事项 + 附件，主理人线下跟进（不做后台、不做跟进接口、不做删除）。
 * 因此只做「写 + 本人读」，所有查询强制 openid + appid 归属过滤。
 *
 * 安全约束：
 *   - 身份一律由 code2Session 换取，不信任前端传入的 openid；
 *   - 附件类型按 magic bytes 重新判定，不只看客户端声明的 MIME；
 *   - 绑定的 fileKey 必须属于当前用户且尚未绑定过；
 *   - 表与存储桶均启用 RLS 且不授予 anon，服务端统一走 service_role。
 */

import { getServiceClient } from './supabase/admin'
import { isAllowedMimeType, kindOf, normalizeDeclaredType, probeMedia } from './media-type'
import { notifyNewWatchTask } from './notify'
import { appDisplayName } from './wx-apps'
import { authByCode, type AuthContext } from './wx-wish'
import { checkTextContent } from './wx-sec-check'
import * as media from './watch-media'
import {
  DEFAULT_PAGE_SIZE,
  MAX_ATTACHMENTS_PER_TASK,
  MAX_ATTACHMENT_BYTES,
  MAX_DETAIL_LENGTH,
  MAX_LOCATION_LENGTH,
  MAX_PAGE_SIZE,
  MAX_SEC_CHECK_TEXT_LENGTH,
  MAX_TITLE_LENGTH,
  WATCH_SUCCESS_MESSAGE,
} from './watch-constants'

const TASK_TABLE = 'watch_tasks'
const ATTACHMENT_TABLE = 'watch_attachments'

// ---------------------------------------------------------------- 类型

export type WatchStatus = 'submitted' | 'watching' | 'resolved' | 'closed' | 'deleted'
export type WatchAttachmentKind = 'image' | 'video'

export type WatchTaskRow = {
  id: string
  task_no: string
  openid: string
  appid: string
  title: string
  location: string
  detail: string | null
  status: WatchStatus
  created_at: string
  updated_at: string
}

export type WatchAttachmentRow = {
  id: string
  task_id: string | null
  kind: WatchAttachmentKind
  file_key: string
  mime_type: string
  size: number
  width: number | null
  height: number | null
  duration_ms: number | null
  openid: string
  appid: string
  created_at: string
}

export type WatchAttachmentResponse = {
  id: string
  kind: WatchAttachmentKind
  mimeType: string
  size: number
  width: number | null
  height: number | null
  durationMs: number | null
  /** 附件读取地址（小程序内需带 code/appid，主理人用带签名的链接） */
  url: string
}

export type WatchTaskResponse = {
  id: string
  taskNo: string
  title: string
  location: string
  detail: string | null
  status: string
  createdAt: string
  updatedAt: string
  attachments: WatchAttachmentResponse[]
}

export type UploadedAttachmentResponse = {
  id: string
  fileKey: string
  kind: WatchAttachmentKind
  mimeType: string
  size: number
}

export type UploadInput = {
  appid?: string
  code: string
  bytes: Uint8Array
  declaredType: string
  width?: number
  height?: number
  durationMs?: number
}

export type CreateTaskInput = {
  appid?: string
  code: string
  title: string
  location: string
  detail?: string
  fileKeys?: string[]
}

export type ListInput = {
  appid?: string
  code: string
  cursor?: number
  limit?: number
}

export type AttachmentAccessQuery = {
  code?: string
  appid?: string
  sig?: string
  exp?: number
  disposition?: 'inline' | 'download'
}

export class WatchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WatchError'
  }
}

// ---------------------------------------------------------------- 数据访问

async function insertTask(row: {
  task_no: string
  openid: string
  appid: string
  title: string
  location: string
  detail: string | null
}): Promise<WatchTaskRow> {
  const { data, error } = await getServiceClient()
    .from(TASK_TABLE)
    .insert(row)
    .select('*')
    .single()

  if (error || !data) {
    throw error ?? new Error('盯事项写入失败：数据库未返回记录')
  }

  return data as WatchTaskRow
}

async function findTaskOwned(
  id: string,
  openid: string,
  appid: string
): Promise<WatchTaskRow | null> {
  const { data, error } = await getServiceClient()
    .from(TASK_TABLE)
    .select('*')
    .eq('id', id)
    .eq('openid', openid)
    .eq('appid', appid)
    .neq('status', 'deleted')
    .maybeSingle()

  if (error) {
    throw new Error(`查询事项失败: ${error.message}`)
  }

  return (data as WatchTaskRow | null) ?? null
}

async function listOwned(
  openid: string,
  appid: string,
  options: { limit: number; cursor?: number }
): Promise<WatchTaskRow[]> {
  let query = getServiceClient()
    .from(TASK_TABLE)
    .select('*')
    .eq('openid', openid)
    .eq('appid', appid)
    .neq('status', 'deleted')
    .order('created_at', { ascending: false })
    .limit(options.limit)

  if (options.cursor !== undefined) {
    query = query.lt('created_at', new Date(options.cursor).toISOString())
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`查询事项列表失败: ${error.message}`)
  }

  return (data as WatchTaskRow[]) ?? []
}

async function insertAttachment(row: {
  task_id: string | null
  kind: WatchAttachmentKind
  file_key: string
  mime_type: string
  size: number
  width: number | null
  height: number | null
  duration_ms: number | null
  openid: string
  appid: string
}): Promise<WatchAttachmentRow> {
  const { data, error } = await getServiceClient()
    .from(ATTACHMENT_TABLE)
    .insert(row)
    .select('*')
    .single()

  if (error || !data) {
    throw error ?? new Error('附件记录写入失败：数据库未返回记录')
  }

  return data as WatchAttachmentRow
}

async function findAttachmentById(id: string): Promise<WatchAttachmentRow | null> {
  const { data, error } = await getServiceClient()
    .from(ATTACHMENT_TABLE)
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw new Error(`查询附件失败: ${error.message}`)
  }

  return (data as WatchAttachmentRow | null) ?? null
}

async function listAttachmentsByTaskId(taskId: string): Promise<WatchAttachmentRow[]> {
  const { data, error } = await getServiceClient()
    .from(ATTACHMENT_TABLE)
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(`查询事项附件失败: ${error.message}`)
  }

  return (data as WatchAttachmentRow[]) ?? []
}

/**
 * 把已上传但未绑定的附件绑定到事项。
 *
 * 只命中 `task_id IS NULL` 且属于当前 openid + appid 的记录：
 * 既防止绑定他人文件，也防止重复提交时把已有附件挪到新事项上。
 */
async function bindAttachmentsToTask(input: {
  fileKeys: string[]
  openid: string
  appid: string
  taskId: string
}): Promise<number> {
  if (input.fileKeys.length === 0) {
    return 0
  }

  const { data, error } = await getServiceClient()
    .from(ATTACHMENT_TABLE)
    .update({ task_id: input.taskId })
    .in('file_key', input.fileKeys)
    .eq('openid', input.openid)
    .eq('appid', input.appid)
    .is('task_id', null)
    .select('id')

  if (error) {
    throw new Error(`绑定附件失败: ${error.message}`)
  }

  return data?.length ?? 0
}

// ---------------------------------------------------------------- 上传

/**
 * 上传单个附件（图片 / 视频）。
 *
 * 先落库为「未绑定」状态（task_id 为空），提交事项时再绑定；
 * 用户中途放弃的文件会留成孤儿，后续用定时任务清理。
 */
export async function uploadWatchAttachment(
  input: UploadInput
): Promise<UploadedAttachmentResponse> {
  const auth = await authByCode(input.appid, input.code)

  if (input.bytes.byteLength === 0) {
    throw new WatchError('文件内容为空')
  }

  if (input.bytes.byteLength > MAX_ATTACHMENT_BYTES) {
    throw new WatchError(`单个附件不能超过 ${MAX_ATTACHMENT_BYTES / 1024 / 1024}MB`)
  }

  const declared = normalizeDeclaredType(input.declaredType)
  const probe = probeMedia(input.bytes)

  if (!probe) {
    throw new WatchError('只支持上传图片（JPG/PNG/WEBP/GIF/HEIC）或视频（MP4/MOV）')
  }

  // 声明类型合法时必须与探测结果同类，防止用图片 MIME 上传视频绕过限制
  if (declared && isAllowedMimeType(declared) && kindOf(declared) !== probe.kind) {
    throw new WatchError('文件类型与声明不一致，请重新选择')
  }

  const key = media.buildKey({ appid: auth.appid, extension: probe.extension })

  await media.put({ key, bytes: input.bytes, contentType: probe.mimeType })

  try {
    const created = await insertAttachment({
      task_id: null,
      kind: probe.kind,
      file_key: key,
      mime_type: probe.mimeType,
      size: input.bytes.byteLength,
      width: positiveOrNull(input.width),
      height: positiveOrNull(input.height),
      duration_ms: positiveOrNull(input.durationMs),
      openid: auth.openid,
      appid: auth.appid,
    })

    return {
      id: created.id,
      fileKey: created.file_key,
      kind: created.kind,
      mimeType: created.mime_type,
      size: created.size,
    }
  } catch (error) {
    // 元数据落库失败则文件已成孤儿，尽力删除，避免对象无限堆积
    console.warn(`[watch] 附件元数据写入失败，清理对象 ${key}`)
    await media.remove(key)
    throw new WatchError(`附件保存失败: ${(error as Error).message}`)
  }
}

// ---------------------------------------------------------------- 创建

/** 提交盯事项：文本安全检测 → 落库 → 绑定附件 → 企微通知 */
export async function createWatchTask(
  input: CreateTaskInput
): Promise<WatchTaskResponse & { message: string }> {
  const auth = await authByCode(input.appid, input.code)

  const fileKeys = dedupe(input.fileKeys ?? [])

  if (fileKeys.length > MAX_ATTACHMENTS_PER_TASK) {
    throw new WatchError(`最多上传 ${MAX_ATTACHMENTS_PER_TASK} 个附件`)
  }

  const title = (input.title ?? '').trim()
  const location = (input.location ?? '').trim()
  const detail = (input.detail ?? '').trim() || null

  if (!title) {
    throw new WatchError('缺少事项名称')
  }
  if (!location) {
    throw new WatchError('缺少地点')
  }
  if (title.length > MAX_TITLE_LENGTH) {
    throw new WatchError(`事项名称不能超过 ${MAX_TITLE_LENGTH} 字`)
  }
  if (location.length > MAX_LOCATION_LENGTH) {
    throw new WatchError(`地点不能超过 ${MAX_LOCATION_LENGTH} 字`)
  }
  if (detail && detail.length > MAX_DETAIL_LENGTH) {
    throw new WatchError(`详情不能超过 ${MAX_DETAIL_LENGTH} 字`)
  }

  const sec = await checkTextContent(
    [title, location, detail].filter(Boolean).join('\n'),
    auth,
    MAX_SEC_CHECK_TEXT_LENGTH,
    '事项内容'
  )

  if (!sec.pass) {
    throw new WatchError(sec.errmsg || '内容审核未通过')
  }

  const task = await insertTaskWithRetry({
    openid: auth.openid,
    appid: auth.appid,
    title,
    location,
    detail,
  })

  const bound = await bindAttachmentsToTask({
    fileKeys,
    openid: auth.openid,
    appid: auth.appid,
    taskId: task.id,
  })

  if (bound !== fileKeys.length) {
    // 部分 fileKey 不属于本人或已被绑定：不阻断主流程，但要留痕便于排查
    console.warn(
      `[watch] 附件绑定数量不符 taskId=${task.id} expected=${fileKeys.length} bound=${bound}`
    )
  }

  const attachments = await listAttachmentsByTaskId(task.id)

  // 通知主理人：fire-and-forget，失败不影响用户侧结果
  void buildNotifyMarkdown({ task, attachments, auth }).then(notifyNewWatchTask)

  return { ...toTaskResponse(task, attachments), message: WATCH_SUCCESS_MESSAGE }
}

// ---------------------------------------------------------------- 读取

export async function listWatchTasks(input: ListInput): Promise<{
  items: WatchTaskResponse[]
  nextCursor: number | null
}> {
  const auth = await authByCode(input.appid, input.code)

  const limit = Math.min(input.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)
  // 多取一条判断「是否还有下一页」，避免返回空 nextCursor 造成额外往返
  const rows = await listOwned(auth.openid, auth.appid, {
    limit: limit + 1,
    cursor: input.cursor,
  })

  const hasMore = rows.length > limit
  const page = hasMore ? rows.slice(0, limit) : rows

  const items = await Promise.all(
    page.map(async (task) => toTaskResponse(task, await listAttachmentsByTaskId(task.id)))
  )

  const last = page[page.length - 1]

  return {
    items,
    nextCursor: hasMore && last ? new Date(last.created_at).getTime() : null,
  }
}

export async function getWatchTask(input: {
  appid?: string
  code: string
  id: string
}): Promise<WatchTaskResponse> {
  const auth = await authByCode(input.appid, input.code)

  const task = await findTaskOwned(input.id, auth.openid, auth.appid)

  if (!task) {
    throw new WatchError('未找到该事项')
  }

  return toTaskResponse(task, await listAttachmentsByTaskId(task.id))
}

/**
 * 解析附件访问地址。
 *
 * 两种凭据取一：
 *   1) code + appid：小程序内预览，校验归属；
 *   2) sig + exp：企微通知里的临时链接，主理人无账号也能看。
 *
 * 通过校验后返回对象存储的短时效签名 URL，由调用方重定向：
 * Serverless 响应体有体积上限，字节直接由对象存储返回更稳，也天然支持 Range。
 */
export async function resolveAttachmentUrl(input: {
  id: string
  query: AttachmentAccessQuery
}): Promise<{ attachment: WatchAttachmentRow; url: string }> {
  const attachment = await findAttachmentById(input.id)

  if (!attachment) {
    throw new WatchError('未找到该附件')
  }

  await assertAttachmentAccess(attachment, input.query)

  const url = await media.signedUrl(attachment.file_key, {
    download:
      input.query.disposition === 'download'
        ? `${attachment.id}${extensionOf(attachment.file_key)}`
        : false,
  })

  if (!url) {
    throw new WatchError('附件已失效')
  }

  return { attachment, url }
}

async function assertAttachmentAccess(
  attachment: WatchAttachmentRow,
  query: AttachmentAccessQuery
): Promise<void> {
  const { sig, exp } = query

  if (sig && exp !== undefined) {
    if (Math.floor(Date.now() / 1000) > exp) {
      throw new WatchError('访问链接已过期')
    }

    if (!(await media.verify(attachment.id, exp, sig))) {
      throw new WatchError('访问签名无效')
    }

    return
  }

  if (!query.code) {
    throw new WatchError('缺少访问凭据')
  }

  const auth = await authByCode(query.appid, query.code)

  if (attachment.openid !== auth.openid || attachment.appid !== auth.appid) {
    throw new WatchError('无权访问该附件')
  }
}

// ---------------------------------------------------------------- 内部

async function insertTaskWithRetry(row: {
  openid: string
  appid: string
  title: string
  location: string
  detail: string | null
}): Promise<WatchTaskRow> {
  let lastError: unknown

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await insertTask({ ...row, task_no: generateTaskNo() })
    } catch (error) {
      // 只有编号冲突（Postgres 唯一约束 23505）值得重试；其余错误直接抛出
      if ((error as { code?: string }).code !== '23505') {
        throw error
      }

      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error('盯事项编号冲突，请重试')
}

function generateTaskNo(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const random = Math.random().toString(36).slice(2, 8).toUpperCase()

  return `WD-${date}-${random}`
}

function toTaskResponse(
  task: WatchTaskRow,
  attachments: WatchAttachmentRow[]
): WatchTaskResponse {
  return {
    id: task.id,
    taskNo: task.task_no,
    title: task.title,
    location: task.location,
    detail: task.detail,
    status: task.status,
    createdAt: task.created_at,
    updatedAt: task.updated_at,
    attachments: attachments.map(toAttachmentResponse),
  }
}

function toAttachmentResponse(attachment: WatchAttachmentRow): WatchAttachmentResponse {
  return {
    id: attachment.id,
    kind: attachment.kind,
    mimeType: attachment.mime_type,
    size: attachment.size,
    width: attachment.width,
    height: attachment.height,
    durationMs: attachment.duration_ms,
    url: `/api/wx/watch/attachments/${attachment.id}`,
  }
}

/** 企微通知正文：主理人没有后台，靠这条消息掌握全部信息 */
async function buildNotifyMarkdown(input: {
  task: WatchTaskRow
  attachments: WatchAttachmentRow[]
  auth: AuthContext
}): Promise<string> {
  const { task, attachments, auth } = input

  const images = attachments.filter((row) => row.kind === 'image').length
  const videos = attachments.filter((row) => row.kind === 'video').length

  const lines = [
    `🐝 **新的「小蜜蜂盯」事项 ${task.task_no}**`,
    `> 小程序：${appDisplayName(auth.appid)}`,
    '',
    `**事项名称**：${escapeMarkdown(task.title)}`,
    `**地点**：${escapeMarkdown(task.location)}`,
    `**详情**：${task.detail ? escapeMarkdown(task.detail) : '（未填写）'}`,
    `**附件**：图片 ${images} 个 / 视频 ${videos} 个`,
    `**提交时间**：${task.created_at}`,
  ]

  const links = await buildAttachmentLinks(attachments)

  if (links.length > 0) {
    lines.push('', '**附件链接**（7 天内有效）：')

    for (const link of links) {
      lines.push(link)
    }
  }

  return lines.join('\n')
}

/** 生成带 HMAC 签名的附件直链；未配置签名密钥时降级为「不带直链」的通知 */
async function buildAttachmentLinks(attachments: WatchAttachmentRow[]): Promise<string[]> {
  if (attachments.length === 0 || !media.hasSignSecret()) {
    return []
  }

  const exp = media.expiresAt()

  return Promise.all(
    attachments.map(async (attachment, index) => {
      const sig = await media.sign(attachment.id, exp)

      if (!sig) {
        return `- 附件 ${index + 1}：${attachment.file_key}（未配置签名密钥，无法生成直链）`
      }

      const url = `${publicBaseUrl()}/api/wx/watch/attachments/${attachment.id}?sig=${sig}&exp=${exp}`

      return `- [${attachment.kind === 'video' ? '视频' : '图片'} ${index + 1}](${url})`
    })
  )
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
}

/** 尺寸 / 时长来自客户端，只做合理性过滤：非法值存 null 而不是落脏数据 */
function positiveOrNull(value: number | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null
  }

  if (value > 100_000) {
    return null
  }

  return Math.round(value)
}

function escapeMarkdown(value: string): string {
  return value.replace(/([*`_[\]])/g, '\\$1').replace(/\n/g, ' ')
}

function extensionOf(fileKey: string): string {
  const index = fileKey.lastIndexOf('.')

  return index > 0 ? fileKey.slice(index) : ''
}

/** 复用项目已有的站点地址（sitemap / layout 同款），不新增环境变量 */
function publicBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://yangjing.m9ai.work').replace(/\/+$/, '')
}
