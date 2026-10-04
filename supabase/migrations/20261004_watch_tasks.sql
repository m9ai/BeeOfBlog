-- ============================================================
-- 小程序「小蜜蜂盯」事项表 + 附件表
-- 用途：持久化「洋泾小蜜蜂」等小程序用户提交的「盯」事项（问题上报）及其图片/视频附件。
-- 说明：
--   1) 归属维度固定为 openid + appid：同一用户在不同小程序的事项互相隔离，
--      所有查询都必须带上这两个条件，避免跨用户 / 跨小程序读取。
--   2) task_no 是对外编号（WD-20261004-XXXXXX），便于企微通知与线下沟通时指代某条事项，
--      唯一键冲突由服务端重试生成。
--   3) 附件本体存 Supabase Storage 私有桶 watch-media，本表只存检索用的元数据（file_key）。
--      上传时先落库（task_id 为空 = 已上传但未提交的孤儿文件），提交事项时再绑定。
--   4) 开启 RLS 且不为 anon / authenticated 建策略：服务端统一用 service_role 访问。
--   5) MVP 阶段只做「写 + 本人读」，不做后台 / 跟进 / 删除（status='deleted' 仅预留）。
-- ============================================================

CREATE TABLE IF NOT EXISTS watch_tasks (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_no       TEXT NOT NULL,                                          -- 对外编号 WD-yyyyMMdd-XXXXXX
    openid        TEXT NOT NULL,                                          -- 提交者 openid
    appid         TEXT NOT NULL,                                          -- 小程序 appid（多租户）
    title         TEXT NOT NULL CHECK (char_length(title) <= 40),         -- 事项名称
    location      TEXT NOT NULL CHECK (char_length(location) <= 100),     -- 地点
    detail        TEXT CHECK (detail IS NULL OR char_length(detail) <= 300), -- 详情（可选）
    status        TEXT NOT NULL DEFAULT 'submitted'                       -- submitted/watching/resolved/closed/deleted
                  CHECK (status IN ('submitted', 'watching', 'resolved', 'closed', 'deleted')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_watch_tasks_task_no ON watch_tasks (task_no);
CREATE INDEX IF NOT EXISTS idx_watch_tasks_openid_appid ON watch_tasks (openid, appid);
CREATE INDEX IF NOT EXISTS idx_watch_tasks_status_created_at ON watch_tasks (status, created_at DESC);

-- 开启 RLS：仅 service_role（服务端）可读写，anon / authenticated 一律拒绝
ALTER TABLE watch_tasks ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_watch_tasks_updated_at ON watch_tasks;
CREATE TRIGGER update_watch_tasks_updated_at
    BEFORE UPDATE ON watch_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 事项附件（图片 / 视频）元数据表
-- ============================================================

CREATE TABLE IF NOT EXISTS watch_attachments (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id       UUID REFERENCES watch_tasks (id),                       -- 为空表示尚未绑定到任何事项
    kind          TEXT NOT NULL CHECK (kind IN ('image', 'video')),
    file_key      TEXT NOT NULL,                                          -- Storage 对象键 watch/<appid>/<yyyyMM>/<uuid><ext>
    mime_type     TEXT NOT NULL,                                          -- 按 magic bytes 探测出的真实类型
    size          INTEGER NOT NULL CHECK (size > 0),                      -- 字节数
    width         INTEGER,                                                -- 图片/视频宽（客户端上报，仅做合理性过滤）
    height        INTEGER,                                                -- 图片/视频高
    duration_ms   INTEGER,                                                -- 视频时长（毫秒）
    openid        TEXT NOT NULL,                                          -- 上传者：用于校验 file_key 归属，防止绑定他人文件
    appid         TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_watch_attachments_task_id ON watch_attachments (task_id);
CREATE INDEX IF NOT EXISTS idx_watch_attachments_openid_appid ON watch_attachments (openid, appid);
-- 绑定附件时按 file_key 批量命中，且必须是未绑定的记录
CREATE INDEX IF NOT EXISTS idx_watch_attachments_file_key ON watch_attachments (file_key);

ALTER TABLE watch_attachments ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 附件私有存储桶（Supabase Storage）
-- 说明：
--   1) public = false：对象不可枚举、不可匿名读取，一律经 /api/wx/watch/attachments/:id 鉴权后
--      由服务端签发短时效签名 URL 重定向访问。
--   2) 桶已开启 RLS（Supabase 默认），未建任何策略 → 仅 service_role 可读写，与表的访问策略一致。
--   3) 若部署环境不是 Supabase（无 storage  schema），下面的 DO 块会静默跳过，
--      此时需在对象存储控制台手工创建同名私有桶。
-- ============================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'storage' AND table_name = 'buckets'
    ) THEN
        INSERT INTO storage.buckets (id, name, public)
        VALUES ('watch-media', 'watch-media', false)
        ON CONFLICT (id) DO NOTHING;
    END IF;
EXCEPTION WHEN others THEN
    RAISE NOTICE '跳过 storage.buckets 初始化（请手工创建私有桶 watch-media）: %', SQLERRM;
END $$;
