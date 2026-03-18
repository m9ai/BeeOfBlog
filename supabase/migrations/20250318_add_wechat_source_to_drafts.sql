-- 为 drafts 表添加 wechat_source 字段（如果存在 drafts 表）
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'drafts') THEN
        ALTER TABLE public.drafts 
        ADD COLUMN IF NOT EXISTS wechat_source TEXT;
        
        COMMENT ON COLUMN public.drafts.wechat_source IS '微信文章/视频源链接，用于导出';
    END IF;
END $$;
