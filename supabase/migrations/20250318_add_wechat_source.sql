-- 为 posts 表添加 wechat_source 字段（微信源链接）
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS wechat_source TEXT;

-- 添加注释
COMMENT ON COLUMN public.posts.wechat_source IS '微信文章/视频源链接，用于导出';
