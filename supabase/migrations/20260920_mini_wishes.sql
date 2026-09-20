-- ============================================================
-- 小程序许愿池心愿表
-- 用途：持久化「洋泾小蜜蜂」等小程序用户在许愿池提交的心愿与还愿记录。
-- 说明：
--   1) 与博客端 wishlist（许愿墙/留言板）解耦，避免字段语义混乱。
--   2) 以 make_trade_no 作为唯一键，确保一次支付只创建一条心愿（幂等）。
--   3) 通过 openid + appid 实现多租户隔离；心愿状态仅用户自己可改写。
--   4) 开启 RLS 且不为 anon / authenticated 建策略：服务端用 service_role 访问。
-- ============================================================

CREATE TABLE IF NOT EXISTS mini_wishes (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    openid             TEXT NOT NULL,                                       -- 用户 openid
    appid              TEXT NOT NULL,                                       -- 小程序 appid（多租户）
    content            TEXT NOT NULL CHECK (char_length(content) <= 120),   -- 心愿内容（最多 120 字）
    status             TEXT NOT NULL DEFAULT 'pending'                      -- pending / fulfilled / deleted
                       CHECK (status IN ('pending', 'fulfilled', 'deleted')),
    make_trade_no      TEXT NOT NULL,                                       -- 许愿支付单号（关联 xpay_orders）
    fulfill_trade_no   TEXT,                                                -- 还愿支付单号
    fulfilled_at       TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mini_wishes_make_trade_no ON mini_wishes (make_trade_no);
CREATE INDEX IF NOT EXISTS idx_mini_wishes_openid ON mini_wishes (openid);
CREATE INDEX IF NOT EXISTS idx_mini_wishes_appid ON mini_wishes (appid);
CREATE INDEX IF NOT EXISTS idx_mini_wishes_status ON mini_wishes (status);
CREATE INDEX IF NOT EXISTS idx_mini_wishes_created_at ON mini_wishes (created_at DESC);

-- 开启 RLS：仅 service_role（服务端）可读写，anon / authenticated 一律拒绝
ALTER TABLE mini_wishes ENABLE ROW LEVEL SECURITY;

-- 更新时间触发器（复用项目已有的 update_updated_at_column 函数）
DROP TRIGGER IF EXISTS update_mini_wishes_updated_at ON mini_wishes;
CREATE TRIGGER update_mini_wishes_updated_at
    BEFORE UPDATE ON mini_wishes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
