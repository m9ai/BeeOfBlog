/**
 * 附件文件类型嗅探（magic bytes）
 *
 * 只信客户端声明的 MIME 是不够的：wx.uploadFile / FormData 的 Content-Type 由客户端构造，
 * 可被伪造，必须按内容重新判定，避免把非媒体内容当图片存下来。
 *
 * 移植自 m9ai-server 的 src/wx/watch/media-type.ts（纯函数，无运行时依赖）。
 */

import { ALLOWED_IMAGE_MIME_TYPES, ALLOWED_VIDEO_MIME_TYPES } from './watch-constants'

export type WatchAttachmentKind = 'image' | 'video'

export type MediaProbe = {
  kind: WatchAttachmentKind
  mimeType: string
  /** 对象键后缀（含点） */
  extension: string
}

const IMAGE_MIME_SET = new Set<string>(ALLOWED_IMAGE_MIME_TYPES)
const VIDEO_MIME_SET = new Set<string>(ALLOWED_VIDEO_MIME_TYPES)

// 不写 String.fromCharCode(...subarray)：项目未开启 downlevelIteration，展开 typed array 会报错
const ascii = (bytes: Uint8Array, start: number, length: number): string => {
  let out = ''
  const end = Math.min(start + length, bytes.length)

  for (let index = start; index < end; index += 1) {
    out += String.fromCharCode(bytes[index])
  }

  return out
}

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0): boolean =>
  signature.every((byte, index) => bytes[offset + index] === byte)

/** ISO-BMFF（MP4 / MOV / HEIC 家族）的品牌名，位于 `ftyp` box 的第 4 个字节之后 */
const isoBrand = (bytes: Uint8Array): string | null => {
  if (!startsWith(bytes, [0x66, 0x74, 0x79, 0x70], 4)) {
    return null
  }

  return ascii(bytes, 8, 4)
}

const VIDEO_BRANDS = new Set([
  'isom',
  'iso2',
  'iso5',
  'iso6',
  'mp41',
  'mp42',
  'mp71',
  'M4V ',
  'M4A ',
  'qt  ',
  'avc1',
  'dash',
  '3gp4',
  '3gp5',
])

const IMAGE_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'])

/** 按 magic bytes 判定真实文件类型；无法识别时返回 null（调用方应拒绝接收） */
export function probeMedia(bytes: Uint8Array): MediaProbe | null {
  if (bytes.length < 12) {
    return null
  }

  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return { kind: 'image', mimeType: 'image/jpeg', extension: '.jpg' }
  }

  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { kind: 'image', mimeType: 'image/png', extension: '.png' }
  }

  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) {
    return { kind: 'image', mimeType: 'image/gif', extension: '.gif' }
  }

  // RIFF....WEBP
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && ascii(bytes, 8, 4) === 'WEBP') {
    return { kind: 'image', mimeType: 'image/webp', extension: '.webp' }
  }

  const brand = isoBrand(bytes)

  if (brand) {
    if (IMAGE_BRANDS.has(brand)) {
      return { kind: 'image', mimeType: 'image/heic', extension: '.heic' }
    }

    if (VIDEO_BRANDS.has(brand)) {
      return { kind: 'video', mimeType: 'video/mp4', extension: '.mp4' }
    }
  }

  return null
}

/** 声明类型归一化：截掉 `;charset=` 之类参数并转小写 */
export function normalizeDeclaredType(declaredType: string): string {
  return declaredType.split(';')[0]?.trim().toLowerCase() ?? ''
}

export function isAllowedMimeType(mimeType: string): boolean {
  return IMAGE_MIME_SET.has(mimeType) || VIDEO_MIME_SET.has(mimeType)
}

/**
 * 声明类型与探测结果冲突时以探测结果为准，但两者需同属 image 或 video 大类，
 * 否则视为可疑文件拒绝接收（防止用图片 MIME 传视频绕过大小/时长限制）。
 */
export function kindOf(mimeType: string): WatchAttachmentKind | null {
  if (IMAGE_MIME_SET.has(mimeType)) {
    return 'image'
  }

  return VIDEO_MIME_SET.has(mimeType) ? 'video' : null
}
