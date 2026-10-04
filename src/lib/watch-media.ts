/**
 * 「小蜜蜂盯」附件存储与签名模块
 *
 * 文件本体存 Supabase Storage 私有桶（WATCH_STORAGE_BUCKET），检索元数据在 Postgres；
 * 对象不公开，一律经 /api/wx/watch/attachments/:id 鉴权后，由服务端签发短时效签名 URL 重定向访问。
 *
 * 主理人没有后台账号，因此额外提供 HMAC 签名链接（sig + exp），供企微通知直链查看。
 *
 * 对应 m9ai-server 的 src/wx/watch/watch-media.service.ts：
 *   - 存储驱动由 R2 / Vercel Blob 换成 Supabase Storage；
 *   - read() 由「返回字节流」改为「返回签名 URL」：Serverless 响应体有体积上限，
 *     重定向让字节直接由对象存储返回给客户端，同时天然支持 Range（<video> 拖动）。
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { getServiceClient } from './supabase/admin'
import {
  ATTACHMENT_CACHE_MAX_AGE_SECONDS,
  MEDIA_SIGNATURE_TTL_SECONDS,
  STORAGE_SIGNED_URL_TTL_SECONDS,
  WATCH_STORAGE_BUCKET,
} from './watch-constants'

/**
 * 对象键：`watch/<appid>/<yyyyMM>/<uuid><ext>`
 *
 * 不含 openid：对象键会出现在 URL / 日志里，身份归属一律由数据库记录判定。
 */
export function buildKey(input: { appid: string; extension: string; now?: Date }): string {
  const now = input.now ?? new Date()
  const month = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}`

  return `watch/${input.appid}/${month}/${crypto.randomUUID()}${input.extension}`
}

/**
 * 写入附件本体。
 *
 * 类型 / 归属等元数据一律留在数据库：驱动层只保证「按 key 存字节」。
 */
export async function put(input: {
  key: string
  bytes: Uint8Array
  contentType: string
}): Promise<void> {
  // 传 Blob 而非裸 Uint8Array：storage-js 走 Blob 分支时会把 cacheControl 一并放进
  // multipart，否则对象上不会带上长期缓存头。
  // 先拷成独立 ArrayBuffer：Uint8Array 可能是 SharedArrayBuffer 视图，不满足 BlobPart 类型。
  const buffer = input.bytes.buffer.slice(
    input.bytes.byteOffset,
    input.bytes.byteOffset + input.bytes.byteLength
  ) as ArrayBuffer
  const blob = new Blob([buffer], { type: input.contentType })

  const { error } = await getServiceClient()
    .storage.from(WATCH_STORAGE_BUCKET)
    .upload(input.key, blob, {
      contentType: input.contentType,
      cacheControl: String(ATTACHMENT_CACHE_MAX_AGE_SECONDS),
      upsert: false,
    })

  if (error) {
    console.error('[watch-media] 附件写入对象存储失败', {
      bucket: WATCH_STORAGE_BUCKET,
      key: input.key,
      contentType: input.contentType,
      byteLength: input.bytes.byteLength,
      reason: error.message,
    })
    throw new Error(`附件写入对象存储失败: ${error.message}`)
  }
}

/** 删除对象（元数据落库失败时清理孤儿文件，尽力而为） */
export async function remove(key: string): Promise<void> {
  const { error } = await getServiceClient().storage.from(WATCH_STORAGE_BUCKET).remove([key])

  if (error) {
    console.warn(`[watch-media] 孤儿对象清理失败 key=${key}: ${error.message}`)
  }
}

/**
 * 签发短时效直链。
 *
 * download 传文件名时对象存储会附加 Content-Disposition: attachment。
 */
export async function signedUrl(
  key: string,
  options?: { download?: string | false; client?: SupabaseClient }
): Promise<string | null> {
  // 小程序端没有登录会话 → 用 service_role；后台有管理员会话 → 直接传会话客户端
  const db = options?.client ?? getServiceClient()

  const { data, error } = await db.storage
    .from(WATCH_STORAGE_BUCKET)
    .createSignedUrl(key, STORAGE_SIGNED_URL_TTL_SECONDS, {
      download: options?.download || undefined,
    })

  if (error || !data?.signedUrl) {
    console.error(`[watch-media] 签名 URL 生成失败 key=${key}: ${error?.message}`)
    return null
  }

  return data.signedUrl
}

/** 业务签名链接有效期（epoch 秒） */
export function expiresAt(now: Date = new Date()): number {
  return Math.floor(now.getTime() / 1000) + MEDIA_SIGNATURE_TTL_SECONDS
}

/**
 * 生成附件临时访问签名。
 * 未配置 WATCH_MEDIA_SIGN_SECRET 时返回 null，调用方降级为不带链接的通知。
 */
export async function sign(attachmentId: string, exp: number): Promise<string | null> {
  const secret = signSecret()

  if (!secret) {
    return null
  }

  return hmacHex(secret, `${attachmentId}.${exp}`)
}

export async function verify(
  attachmentId: string,
  exp: number,
  signature: string
): Promise<boolean> {
  const secret = signSecret()

  if (!secret) {
    return false
  }

  const expected = await hmacHex(secret, `${attachmentId}.${exp}`)

  return timingSafeEqual(expected, signature.toLowerCase())
}

export function hasSignSecret(): boolean {
  return signSecret() !== null
}

/**
 * 签名密钥：优先 WATCH_MEDIA_SIGN_SECRET，未配置时回退项目已有的 WX_MSG_AES_KEY，
 * 不强制新增环境变量。
 */
function signSecret(): string | null {
  return (
    process.env.WATCH_MEDIA_SIGN_SECRET?.trim() ||
    process.env.WX_MSG_AES_KEY?.trim() ||
    null
  )
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))

  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

/** 长度相同才逐字符比较，避免按字节短路泄漏前缀匹配长度 */
function timingSafeEqual(expected: string, actual: string): boolean {
  if (expected.length !== actual.length) {
    return false
  }

  let diff = 0

  for (let index = 0; index < expected.length; index += 1) {
    diff |= expected.charCodeAt(index) ^ actual.charCodeAt(index)
  }

  return diff === 0
}
