-- ============================================================
-- 虚拟支付订单表：多小程序（多租户）支持
-- 用途：名下多款小程序（金铁班次助手 / 洋泾小蜜蜂 / 健康笔记）共用
--       同一张 xpay_orders 记账，以 appid 列区分归属。
-- 说明：
--   1) 新增 appid 列：下单时写入调用方小程序的 appid。
--   2) 存量行 appid 为 NULL，语义为「默认小程序（金铁，环境变量 WX_APPID）」：
--      服务端统计对默认小程序兼容 NULL（appid = WX_APPID OR appid IS NULL），
--      其它小程序的统计绝不包含 NULL 行，防止跨租户污染。
--   3) out_trade_no 仍为全局唯一主键（业务单号含随机后缀，跨小程序不会冲突），
--      幂等逻辑不依赖 appid 过滤。
--   4) wx_order_id 唯一索引不变（平台单号在微信侧全局唯一）。
-- ============================================================

ALTER TABLE xpay_orders ADD COLUMN IF NOT EXISTS appid TEXT;

-- 存量数据回填：将 NULL 语义显式化为默认小程序 appid（执行前替换为实际值，
-- 即环境变量 WX_APPID 的值——金铁班次助手）：
-- UPDATE xpay_orders SET appid = '<WX_APPID_金铁>' WHERE appid IS NULL;

-- 多租户统计/对账索引（替换旧的 product_id+status 组合索引口径）
CREATE INDEX IF NOT EXISTS idx_xpay_orders_appid_product_status
    ON xpay_orders (appid, product_id, status);

-- 校验（按小程序分口径对账）：
-- SELECT appid, COUNT(*) FILTER (WHERE status = 'delivered')              AS orders,
--        SUM(quantity) FILTER (WHERE status = 'delivered')                AS total_count,
--        COUNT(DISTINCT openid) FILTER (WHERE status = 'delivered')       AS supporter_count
-- FROM xpay_orders GROUP BY appid;
