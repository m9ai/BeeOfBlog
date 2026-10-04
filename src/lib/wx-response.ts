/**
 * 小程序接口统一响应包装
 *
 * 与 m9ai-server 的 src/wx/common/wx-response.ts 保持一致：
 * 业务失败就地转成 `{ success: false, enabled: true, errcode, errmsg }` 并返回 HTTP 200，
 * 端上按 success 判断（HTTP 状态码只反映传输层结果）。
 *
 * 这样小程序端只需一套判错逻辑，也避免把「内容审核不通过」这类业务错误
 * 混进 4xx 里导致端上弹出无意义的网络错误。
 */

export type WxFailureBody = {
  success: false
  enabled: true
  errcode: number
  errmsg: string
}

export function wxFailure(error: unknown, fallback: string, errcode = -99): WxFailureBody {
  const errmsg = error instanceof Error && error.message ? error.message : fallback

  return { success: false, enabled: true, errcode, errmsg }
}

export function wxSuccess<T extends object>(
  payload: T
): T & { success: true; enabled: boolean } {
  return { ...payload, success: true as const, enabled: true }
}
