# BlogOfBee 接口文档

## 1. 数据模型

### 1.1 Post (文章/视频)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 唯一标识 |
| title | string | 标题 |
| slug | string | URL 友好标识 |
| excerpt | string \| null | 摘要 |
| content | string \| null | 内容 |
| cover_image | string \| null | 封面图 URL |
| category_id | string \| null | 分类 ID |
| type | 'video' \| 'article' | 类型 |
| video_id | string \| null | 视频号作品ID |
| external_link | string \| null | 外部链接 |
| status | 'published' \| 'draft' | 状态 |
| view_count | number | 浏览次数 |
| created_at | string | 创建时间 |
| updated_at | string | 更新时间 |
| wechat_source | string | 微信公众号文章或视频号作品链接 |

### 1.2 Category (分类)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 唯一标识 |
| name | string | 名称 |
| slug | string | URL 标识 |
| type | 'video' \| 'article' | 类型 |
| icon | string \| null | 图标 |
| sort_order | number | 排序 |
| created_at | string | 创建时间 |

### 1.3 Wishlist (心愿单)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 唯一标识 |
| title | string | 标题 |
| content | string | 内容 |
| category | 'old_renovation' \| 'municipal' \| 'cooperation' \| 'other' | 分类 |
| contact_name | string \| null | 联系人 |
| contact_phone | string \| null | 联系电话 |
| contact_email | string \| null | 联系邮箱 |
| status | 'pending' \| 'processing' \| 'completed' \| 'rejected' | 状态 |
| admin_reply | string \| null | 管理员回复 |
| priority | 'low' \| 'medium' \| 'high' \| 'urgent' | 优先级 |
| assigned_to | string \| null | 分配给 |
| created_at | string | 创建时间 |
| updated_at | string | 更新时间 |

---

## 2. 静态数据接口

### 2.1 最新资讯列表

```
GET /feeds/latest.json
```

**响应格式：**

```json
[
  {
    "id": "1",
    "title": "洋泾水环绒绣园开工建设...",
    "date": "2025-01-28",
    "type": "renewal",
    "url": "https://mp.weixin.qq.com/..."
  }
]
```

### 2.2 新闻列表

```
GET /feeds/news.json
```

**响应格式：**

```json
[
  {
    "id": 1,
    "title": "洋泾水环口袋公园绒绣园五一前竣工",
    "summary": "你知道吗？洋泾这个施工中的公园下面...",
    "coverImage": "https://...",
    "publishTime": "2026-01-29",
    "source": "洋泾小蜜蜂视频号",
    "type": "video",
    "url": "https://weixin.qq.com/..."
  }
]
```

---

## 3. Supabase 数据库接口

### 3.1 内容管理

#### 获取文章/视频列表

```typescript
supabase
  .from('posts')
  .select(`*, category:categories(*)`)
  .eq('status', 'published')
  .eq('type', 'video' | 'article')
  .order('created_at', { ascending: false })
```

#### 获取单条内容

```typescript
supabase
  .from('posts')
  .select(`*, category:categories(*)`)
  .eq('id', id)
  .single()
```

#### 创建内容

```typescript
supabase
  .from('posts')
  .insert({
    title: string,
    slug: string,
    type: 'video' | 'article',
    // ...其他字段
  })
```

#### 更新内容

```typescript
supabase
  .from('posts')
  .update({ ...data })
  .eq('id', id)
```

#### 删除内容

```typescript
supabase
  .from('posts')
  .delete()
  .eq('id', id)
```

#### 切换发布状态

```typescript
supabase
  .from('posts')
  .update({ status: 'published' | 'draft' })
  .eq('id', id)
```

### 3.2 分类管理

#### 获取分类列表

```typescript
supabase
  .from('categories')
  .select('*')
  .eq('type', 'video' | 'article')
  .order('sort_order')
```

### 3.3 心愿单管理

#### 获取心愿单列表

```typescript
supabase
  .from('wishlist')
  .select('*', { count: 'exact' })
  .eq('status', statusFilter)  // 可选
  .order('created_at', { ascending: false })
  .range(from, to)
```

#### 创建心愿单

```typescript
supabase
  .from('wishlist')
  .insert({
    title: string,
    content: string,
    category: 'old_renovation' | 'municipal' | 'cooperation' | 'other',
    contact_name?: string,
    contact_phone?: string,
    contact_email?: string,
    status: 'pending'
  })
```

#### 更新心愿单状态

```typescript
supabase
  .from('wishlist')
  .update({
    status: 'pending' | 'processing' | 'completed' | 'rejected',
    admin_reply?: string,
    priority?: 'low' | 'medium' | 'high' | 'urgent'
  })
  .eq('id', id)
```

#### 获取待处理数量

```typescript
supabase
  .from('wishlist')
  .select('*', { count: 'exact', head: true })
  .in('status', ['pending', 'processing'])
```

---

## 4. 认证接口

### 4.1 Supabase Auth

#### 获取当前会话

```typescript
supabase.auth.getSession()
```

#### 登录

```typescript
supabase.auth.signInWithPassword({
  email: string,
  password: string
})
```

#### 登出

```typescript
supabase.auth.signOut()
```

#### 检查管理员权限

```typescript
supabase
  .from('user_roles')
  .select('role')
  .eq('user_id', userId)
  .single()
// 检查 role === 'admin'
```

---

## 5. 页面路由

| 路由 | 说明 | 权限 |
|------|------|------|
| `/` | 首页 - 瀑布流展示 | 公开 |
| `/posts` | 公众号文章列表 | 公开 |
| `/posts/[id]` | 文章详情页 | 公开 |
| `/videos` | 视频号作品列表 | 公开 |
| `/videos/[id]` | 视频详情页 | 公开 |
| `/wishlist` | 心愿单页面 | 公开 |
| `/admin` | 管理后台首页 | 管理员 |
| `/admin/login` | 管理员登录 | 公开 |
| `/admin/new` | 新建内容 | 管理员 |
| `/admin/edit/[id]` | 编辑内容 | 管理员 |
| `/admin/wishlist` | 心愿单管理 | 管理员 |
| `/search` | 搜索页面 | 公开 |

---

## 6. 环境变量配置

```bash
# Supabase 配置
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# 微信小程序凭证（用于文本内容安全检测接口）
WX_APPID=wx_your_appid
WX_SECRET=your_app_secret
```

---

## 7. 微信内容安全检测代理

为避免在小程序端暴露 `access_token` / `appsecret`，后端封装了微信
`wxa/msg_sec_check` 接口，供小程序调用。

> **前置条件说明（重要）**
> 调用 `wxa/msg_sec_check` 需要两个必要条件，缺一不可：
> 1. **access_token**：通过官方推荐的稳定版接口
>    `POST https://api.weixin.qq.com/cgi-bin/stable_token`（普通模式 `force_refresh=false`）获取，
>    且必须使用**与小程序的 appid 相同**的 `WX_APPID` / `WX_SECRET`。
>    （不推荐使用 `GET /cgi-bin/token`：多实例 Serverless 环境下会互相顶掉 token。）
> 2. **openid**：`msg_sec_check` 请求体**必填**，且必须属于上述 appid。

### 7.1 检测文本内容

```
POST /api/wx/msg-sec-check
Content-Type: application/json
```

**请求体：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| content | string | 是 | 待检测文本，<= 2500 字 |
| scene | number | 否 | 1 资料 / 2 评论 / 3 论坛 / 4 社交日志，默认 1 |
| code | string | 否* | `wx.login()` 返回的登录 code，后端通过 code2Session 换取 openid |
| openid | string | 否* | 已知的用户 openid，优先级高于 code |

> \* 微信 `msg_sec_check` 接口的 `openid` 为**必填**参数，因此 `code` 与 `openid`
> 至少要传一个，否则无法完成检测（接口会返回 `degraded: true` 并放行）。
> 推荐小程序端先 `wx.login()` 获取 `code` 并传入，由后端安全地换取 `openid`。

**调用链：**

```
小程序 wx.login() → code
      ↓
POST /api/wx/msg-sec-check { content, scene, code }
      ↓
后端 POST /cgi-bin/stable_token  → access_token（与 WX_APPID 同源）
后端 sns/jscode2session { code } → openid（与 WX_APPID 同源）
      ↓
后端 wxa/msg_sec_check { content, version:2, scene, openid }
      ↓
errcode=40001/42001 时自动刷新 token 重试一次
```

**响应体（包装后的微信结果）：**

```json
{
  "success": true,
  "pass": true,
  "errcode": 0,
  "errmsg": "ok",
  "openid": "oXXXX-xxxxxxxxxxxxxxxxx",
  "detail": [],
  "trace_id": "xxx"
}
```

- `pass = true` 表示通过；`pass = false` 表示违规，需要拦截。
- `openid` 会回传，客户端可选择缓存复用，减少 `code2Session` 调用。
- 当微信接口 / 凭证异常时，接口采用 **fail-open** 策略：`pass = true` 且带
  `degraded: true` 字段，便于排查而不影响正常用户。

**常见错误码：**

| errcode | 说明 | 处理 |
|---------|------|------|
| 0 | 检测成功 | 依据 `pass` 判断 |
| -4 | 缺少 openid/code 或 code2Session 失败 | 客户端需先 `wx.login()` 传 code |
| -3 | access_token 获取失败 | 检查 `WX_APPID` / `WX_SECRET` 是否正确、AppSecret 是否被冻结 |
| 40001 | invalid credential（access_token 过期/无效） | 接口已自动刷新 token 重试一次 |
| 40013 | invalid appid | `WX_APPID` 与小程序 appid 不一致或含异常字符 |
| 40003 | invalid openid（微信返回） | openid 不合法 / 未传，或 access_token 与 openid 不属于同一 appid |
| 61010 | code is expired（微信返回） | 用户超 2 小时未访问小程序，需重新 `wx.login()` |
| 87014 | 内容违规（微信返回） | 拦截并提示用户 |

---

## 8. 类型定义文件

所有 TypeScript 类型定义位于 `/src/types/database.ts`，包含：

- `Database` - 完整数据库类型
- `Tables<T>` - 表类型辅助函数
- `Enums<T>` - 枚举类型辅助函数

### 使用示例

```typescript
import type { Tables } from '@/types/database'

type Post = Tables<'posts'>
type Category = Tables<'categories'>
type Wishlist = Tables<'wishlist'>
```

---

## 9. 客户端/服务端 Supabase 客户端

### 8.1 浏览器客户端

```typescript
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()
```

### 8.2 服务端客户端

```typescript
import { createClient } from '@/lib/supabase/server'

const supabase = await createClient()
```
