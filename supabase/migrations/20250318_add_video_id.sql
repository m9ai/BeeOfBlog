-- 为 posts 表添加 video_id 字段（视频号作品ID，用于导出）
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS video_id TEXT;

COMMENT ON COLUMN public.posts.video_id IS '视频号作品ID，导出时使用此值作为ID';

-- 为 drafts 表也添加 video_id 字段（如果存在）
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'drafts') THEN
        ALTER TABLE public.drafts 
        ADD COLUMN IF NOT EXISTS video_id TEXT;
        
        COMMENT ON COLUMN public.drafts.video_id IS '视频号作品ID，导出时使用此值作为ID';
    END IF;
END $$;
