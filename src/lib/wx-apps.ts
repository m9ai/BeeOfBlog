/**
 * 微信小程序多租户（多 appid）共享模块
 *
 * 本服务端同时服务名下多款小程序：
 *   - 金铁班次助手（默认小程序，appid 取环境变量 WX_APPID）
 *   - 洋泾小蜜蜂 wxc9edff70eb75f100
 *   - 健康笔记     wxca56ef69f60a66a0
 *
 * 统一约定：每个小程序的专属配置用扁平环境变量 `<BASE>_<appid>` 提供，
 * 例如 WX_SECRET_wxc9edff70eb75f100 / WX_XPAY_OFFER_ID_wxc9edff70eb75f100。
 * 默认小程序（金铁）向后兼容旧的无后缀变量（WX_SECRET / WX_XPAY_OFFER_ID / ...）。
 *
 * 被 msg-sec-check、wx-xpay（虚拟支付）、wx-msg（消息推送验签）共用。
 */

// ---------------------------------------------------------------- 基础查询

/** 默认小程序（金铁班次助手）的 appid */
export function getDefaultAppid(): string {
  return (process.env.WX_APPID || '').trim()
}

/**
 * 大小写兼容地查找扁平环境变量 `<base>_<appid>`。
 * 部分部署平台（如 Vercel UI）会把环境变量名转成大写，这里按后缀小写比较兜底。
 */
export function findFlatEnv(appid: string, base: string): string | null {
  if (!appid) return null
  const prefix = `${base}_`
  const direct = process.env[`${base}_${appid}`]
  if (direct) return direct
  const suffix = appid.toLowerCase()
  for (const key of Object.keys(process.env)) {
    if (
      key.length > prefix.length &&
      key.slice(0, prefix.length).toUpperCase() === prefix.toUpperCase() &&
      key.slice(prefix.length).toLowerCase() === suffix
    ) {
      return process.env[key] || null
    }
  }
  return null
}

/** 扫描出配置了 `<base>_<appid>` 变量的所有 appid（小写、去重） */
export function listAppidsByEnvBase(base: string): string[] {
  const prefix = `${base}_`
  const appids = new Set<string>()
  for (const key of Object.keys(process.env)) {
    if (
      key.length > prefix.length &&
      key.slice(0, prefix.length).toUpperCase() === prefix.toUpperCase() &&
      process.env[key]
    ) {
      appids.add(key.slice(prefix.length).toLowerCase())
    }
  }
  return Array.from(appids)
}

// ---------------------------------------------------------------- 应用名映射

/** appid → 展示名（日志 / 开发者通知用）。未知 appid 原样展示。 */
const APP_NAMES: Record<string, string> = {
  wxc9edff70eb75f100: '洋泾小蜜蜂',
  wxca56ef69f60a66a0: '健康笔记',
}
const DEFAULT_APP_NAME = '金铁班次助手'

export function appDisplayName(appid?: string | null): string {
  if (!appid || appid === getDefaultAppid()) return DEFAULT_APP_NAME
  return APP_NAMES[appid.toLowerCase()] || appid
}

// ---------------------------------------------------------------- 凭证解析

export type WxCredential = { appid: string; secret: string }

/**
 * 解析小程序凭证（code2Session / stable_token 用）。
 *
 * 来源与回退规则（按优先级）：
 *   1) 扁平环境变量 WX_SECRET_<appid>（推荐）
 *   2) WX_APPS JSON 表（部分平台 UI 不支持含引号的值，仅作兼容）：
 *      {"wxc9edff70eb75f100":{"secret":"..."}}
 *   3) WX_APPID + WX_SECRET：仅当请求的是默认小程序（金铁）时回退。
 *
 * 显式指定 appid 但未命中任何来源 → 抛错而非静默回退：
 * code 只能由签发它的同一 appid 换取，拿错凭证必然失败，
 * 静默回退会把配置错误伪装成业务降级。
 */
export function resolveWxCredential(requestAppid?: string): WxCredential {
  const wanted = (requestAppid || getDefaultAppid()).trim()
  if (!wanted) {
    throw new Error('服务端未配置微信凭证（WX_APPID / WX_SECRET 或 WX_SECRET_<appid>）')
  }

  const fromFlat = (): WxCredential | null => {
    const secret = findFlatEnv(wanted, 'WX_SECRET')
    return secret ? { appid: wanted, secret } : null
  }

  const fromApps = (): WxCredential | null => {
    const appsRaw = process.env.WX_APPS
    if (!appsRaw) return null
    try {
      const apps = JSON.parse(appsRaw) as Record<string, { secret?: string }>
      const entry = apps[wanted]
      if (entry?.secret) return { appid: wanted, secret: entry.secret }
      return null
    } catch {
      console.error('[wx-apps] WX_APPS 环境变量不是合法 JSON，忽略')
      return null
    }
  }

  const fromSingle = (): WxCredential | null => {
    const appid = getDefaultAppid()
    const secret = process.env.WX_SECRET
    return appid && secret && wanted === appid ? { appid, secret } : null
  }

  const cred = fromFlat() || fromApps() || fromSingle()
  if (!cred) {
    throw new Error(
      `未找到 appid=${wanted} 对应的凭证（请检查 WX_SECRET_${wanted} 环境变量配置）`
    )
  }
  return cred
}

// ---------------------------------------------------------------- code2Session

export type Code2SessionResult = {
  openid: string
  sessionKey: string
  unionid?: string
}

/** wx.login() 的 code 换 openid + session_key（code 一次性、约 5 分钟有效） */
export async function code2Session(
  appid: string,
  secret: string,
  code: string
): Promise<Code2SessionResult> {
  const url =
    `https://api.weixin.qq.com/sns/jscode2session?appid=${encodeURIComponent(appid)}` +
    `&secret=${encodeURIComponent(secret)}&js_code=${encodeURIComponent(code)}` +
    `&grant_type=authorization_code`
  const res = await fetch(url, { method: 'GET', cache: 'no-store' })
  const data = (await res.json().catch(() => ({}))) as {
    openid?: string
    session_key?: string
    unionid?: string
    errcode?: number
    errmsg?: string
  }
  if (!data.openid || !data.session_key) {
    throw new Error(`code2Session 失败: errcode=${data.errcode} errmsg=${data.errmsg}`)
  }
  return { openid: data.openid, sessionKey: data.session_key, unionid: data.unionid }
}

// ---------------------------------------------------------------- access_token

// 使用官方推荐的「稳定版接口调用凭据」（stable_token 普通模式）：
// 有效期内重复调用返回同一个 token，天然适合 Vercel 多实例部署，
// 避免旧接口多实例并发刷新互相顶掉 token 导致的 40001。
//
// 缓存按 appid 分桶：不同小程序的 token 互不干扰。
// 本模块是全服务端唯一的 token 缓存（msg-sec-check 与虚拟支付共用，
// stable_token 普通模式下共享缓存是安全的：两处拿到的是同一个 token）。
type TokenCacheEntry = { token: string; expireAt: number }
const tokenCacheMap = new Map<string, TokenCacheEntry>()

export function invalidateAccessToken(appid: string): void {
  tokenCacheMap.delete(appid)
}

export async function getAccessToken(appid: string, secret: string): Promise<string> {
  const now = Date.now()
  const cached = tokenCacheMap.get(appid)
  if (cached && cached.expireAt > now) {
    return cached.token
  }

  const res = await fetch('https://api.weixin.qq.com/cgi-bin/stable_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credential',
      appid,
      secret,
      force_refresh: false, // 普通模式：有效期内不更新 token
    }),
    cache: 'no-store',
  })
  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string
    expires_in?: number
    errcode?: number
    errmsg?: string
  }
  if (!data.access_token) {
    throw new Error(`获取 access_token 失败: errcode=${data.errcode} errmsg=${data.errmsg}`)
  }

  // 提前 5 分钟过期，留出刷新窗口；下限 60 秒防止负 TTL
  const ttlSec = Math.max((data.expires_in || 7200) - 300, 60)
  tokenCacheMap.set(appid, { token: data.access_token, expireAt: now + ttlSec * 1000 })
  return data.access_token
}
