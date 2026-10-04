/**
 * 小程序「小蜜蜂盯」常量表
 *
 * 与 m9ai-server 的 src/wx/watch/watch.constants.ts 保持完全一致，
 * 便于两端（m9ai.work / yangjing.m9ai.work）行为对齐。
 */

/** 事项名称 */
export const MAX_TITLE_LENGTH = 40
/** 地点 */
export const MAX_LOCATION_LENGTH = 100
/** 详情 */
export const MAX_DETAIL_LENGTH = 300

/** 单个事项最多 9 个附件（与小程序端 wx.chooseMedia 的 maxCount 对齐） */
export const MAX_ATTACHMENTS_PER_TASK = 9

/**
 * 单个附件最大 10MB。
 *
 * 注意：部署在 Vercel Serverless 时请求体上限为 4.5MB，
 * 超过该体积的上传会被平台在到达本服务前拒绝（表现为 413）。
 * 这里保留与原服务一致的 10MB 作为业务上限，实际可上传体积以部署平台为准。
 */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024

/** 内容安全检测的文本总长上限：标题 + 地点 + 详情拼接后不应超过此值 */
export const MAX_SEC_CHECK_TEXT_LENGTH = 500

/** 允许的 MIME 类型白名单；magic bytes 二次校验见 media-type.ts */
export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
] as const

export const ALLOWED_VIDEO_MIME_TYPES = ['video/mp4', 'video/quicktime', 'video/mov'] as const

export const ALLOWED_MIME_TYPES = [
  ...ALLOWED_IMAGE_MIME_TYPES,
  ...ALLOWED_VIDEO_MIME_TYPES,
] as const

/** 列表分页默认值与上限 */
export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 50

/**
 * 附件临时访问链接的有效期（秒）。
 * 主理人没有后台账号，靠企微通知里带签名的链接查看附件。
 */
export const MEDIA_SIGNATURE_TTL_SECONDS = 7 * 24 * 60 * 60

/**
 * Storage 签名 URL 的有效期（秒）。
 * 这是「业务签名校验通过后」再向对象存储申请的短时效直链，
 * 只在本次重定向中使用，无需与业务签名同寿命。
 */
export const STORAGE_SIGNED_URL_TTL_SECONDS = 300

/** 附件存储桶名（私有桶，仅 service_role 可读写） */
export const WATCH_STORAGE_BUCKET = 'watch-media'

/** 创建成功后的用户侧提示（引导添加主理人微信，沟通主要在线下 / 社交软件完成） */
export const WATCH_SUCCESS_MESSAGE = '事项创建成功，可添加小蜜蜂主理人-17602135810持续沟通'

/**
 * 附件对象在存储侧的缓存时长（秒）。
 * 对象键含 UUID 且不可枚举，一年足够长又不至于永久缓存；
 * 注意 Supabase Storage 的 cacheControl 只接受秒数（内部拼成 max-age=<秒>）。
 */
export const ATTACHMENT_CACHE_MAX_AGE_SECONDS = 31536000
