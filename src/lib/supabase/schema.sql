-- 创建分类表
CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  type TEXT CHECK (type IN ('video', 'article')) NOT NULL,
  icon TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建内容表
CREATE TABLE IF NOT EXISTS posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  excerpt TEXT,
  content TEXT,
  cover_image TEXT,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  type TEXT CHECK (type IN ('video', 'article')) NOT NULL,
  video_url TEXT,
  external_link TEXT,
  status TEXT CHECK (status IN ('published', 'draft')) DEFAULT 'draft',
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建标签表
CREATE TABLE IF NOT EXISTS tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建内容标签关联表
CREATE TABLE IF NOT EXISTS post_tags (
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_posts_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 创建用户角色表
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('admin', 'editor')) DEFAULT 'editor',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 启用 RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- 创建访问策略
CREATE POLICY "Allow public read access" ON categories
  FOR SELECT USING (true);

CREATE POLICY "Allow public read access" ON posts
  FOR SELECT USING (status = 'published');

CREATE POLICY "Allow public read access" ON tags
  FOR SELECT USING (true);

CREATE POLICY "Allow public read access" ON post_tags
  FOR SELECT USING (true);

-- 用户角色策略 - 只有管理员可以管理角色
CREATE POLICY "Allow admin full access" ON user_roles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 允许已认证用户查看自己的角色
CREATE POLICY "Allow users read own role" ON user_roles
  FOR SELECT USING (user_id = auth.uid());

-- 插入初始分类数据
INSERT INTO categories (name, slug, type, icon, sort_order) VALUES
  ('短视频', 'short-video', 'video', 'Video', 1),
  ('长视频', 'long-video', 'video', 'Film', 2),
  ('技术文章', 'tech-article', 'article', 'Code', 3),
  ('生活随笔', 'life-essay', 'article', 'Pen', 4);

-- 插入示例内容
INSERT INTO posts (title, slug, excerpt, content, cover_image, category_id, type, status, view_count) VALUES
  (
    '我的第一条视频号作品',
    'my-first-video',
    '这是我的第一条视频号作品，记录了我在上海的美好时光...',
    '# 我的第一条视频号作品

这是我的第一条视频号作品，记录了我在上海的美好时光。

## 视频背景

这次拍摄是在外滩进行的，清晨的阳光非常美...

## 拍摄心得

第一次使用手机拍摄短视频，学到了很多技巧...',
    'https://images.unsplash.com/photo-1537531383496-f4749b8032cf?w=800',
    (SELECT id FROM categories WHERE slug = 'short-video'),
    'video',
    'published',
    128
  ),
  (
    'Next.js 14 新特性详解',
    'nextjs-14-features',
    '深入解析 Next.js 14 带来的全新特性，包括 Server Actions、Partial Prerendering 等...',
    '# Next.js 14 新特性详解

Next.js 14 带来了很多令人兴奋的新特性。

## Server Actions

Server Actions 让我们可以直接在组件中调用服务端函数...

## Partial Prerendering

部分预渲染是 Next.js 14 的重要特性...',
    'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800',
    (SELECT id FROM categories WHERE slug = 'tech-article'),
    'article',
    'published',
    256
  ),
  (
    '周末的咖啡时光',
    'weekend-coffee',
    '周末去了一家新开的咖啡馆，环境非常棒...',
    '# 周末的咖啡时光

周末去了一家新开的咖啡馆，环境非常棒。

## 咖啡馆介绍

这家店位于静安区，装修风格是日式简约风...

## 咖啡品鉴

点了一杯手冲埃塞俄比亚，口感非常干净...',
    'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800',
    (SELECT id FROM categories WHERE slug = 'life-essay'),
    'article',
    'published',
    89
  );
