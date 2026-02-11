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
| video_url | string \| null | 视频链接 |
| external_link | string \| null | 外部链接 |
| status | 'published' \| 'draft' | 状态 |
| view_count | number | 浏览次数 |
| created_at | string | 创建时间 |
| updated_at | string | 更新时间 |

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
```

---

## 7. 类型定义文件

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

## 8. 客户端/服务端 Supabase 客户端

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
