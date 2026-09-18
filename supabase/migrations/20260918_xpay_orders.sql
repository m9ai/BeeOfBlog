-- ============================================================
-- 虚拟支付（道具直购）订单表
-- 用途：小程序班次页「期盼金山通地铁」助力道具的订单与发货记录
-- 说明：
--   1) 表名为 xpay_orders，一张表同时承担「订单」与「助力记账」两个职责：
--      累计助力数 = status = 'delivered' 的 quantity 之和（服务端聚合，避免维护计数器的漂移）。
--   2) 只允许服务端用 service_role 访问：anon key 是公开的，
--      若对 anon 开放写入，任何人都能伪造「已支付」记录把助力数刷起来。
--      因此这里开启 RLS 且不建任何 anon 策略（service_role 天然绕过 RLS）。
--   3) 幂等键：out_trade_no（业务单号，唯一）；wx_order_id（平台单号）用于对账。
-- ============================================================

CREATE TABLE IF NOT EXISTS xpay_orders (
    out_trade_no   TEXT PRIMARY KEY,                                    -- 业务单号（8-32 位，一次有效）
    wx_order_id    TEXT,                                                -- 微信内部单号（推送 WeChatPayInfo.MchOrderNo）
    openid         TEXT NOT NULL,                                       -- 付款用户 openid
    product_id     TEXT NOT NULL,                                       -- 道具 ID（MP 后台【道具管理】配置）
    quantity       INTEGER NOT NULL DEFAULT 1,                          -- 购买份数
    goods_price    INTEGER NOT NULL,                                    -- 道具单价（分，与后台配置一致）
    total_fee      INTEGER NOT NULL,                                    -- 订单金额（分）
    status         TEXT NOT NULL DEFAULT 'created'                      -- created / paid / delivered / closed
                   CHECK (status IN ('created', 'paid', 'delivered', 'closed')),
    attach         TEXT,                                                -- 下单透传字段（本业务用于标记来源页）
    env            INTEGER NOT NULL DEFAULT 0,                          -- 0 正式环境 / 1 沙箱环境
    paid_at        TIMESTAMPTZ,
    delivered_at   TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_xpay_orders_openid ON xpay_orders (openid);
CREATE INDEX IF NOT EXISTS idx_xpay_orders_product_status ON xpay_orders (product_id, status);
CREATE INDEX IF NOT EXISTS idx_xpay_orders_created_at ON xpay_orders (created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_xpay_orders_wx_order_id ON xpay_orders (wx_order_id) WHERE wx_order_id IS NOT NULL;

-- 开启 RLS：仅 service_role（服务端）可读写，anon / authenticated 一律拒绝
ALTER TABLE xpay_orders ENABLE ROW LEVEL SECURITY;

-- 更新时间触发器（复用项目已有的 update_updated_at_column 函数，见 supabase-schema.sql）
DROP TRIGGER IF EXISTS update_xpay_orders_updated_at ON xpay_orders;
CREATE TRIGGER update_xpay_orders_updated_at
    BEFORE UPDATE ON xpay_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 校验：累计助力份数 / 参与人数（服务端聚合口径，可用于对账）
-- SELECT COUNT(*) FILTER (WHERE status = 'delivered')                        AS orders,
--        SUM(quantity) FILTER (WHERE status = 'delivered')                   AS total_count,
--        COUNT(DISTINCT openid) FILTER (WHERE status = 'delivered')          AS supporter_count
-- FROM xpay_orders;
