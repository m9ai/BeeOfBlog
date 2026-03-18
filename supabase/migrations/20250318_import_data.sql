-- 导入现有知识库数据（从 JSON 文件提取）

-- 先清空现有数据（如果需要重新导入）
-- DELETE FROM knowledge_docs;

-- 插入文档数据
INSERT INTO knowledge_docs (id, title, category_id, summary, url, is_hot, status, update_time, view_count) VALUES
-- 历史沿革
('1', '洋泾名称的由来', 'history', '洋泾因洋泾港而得名，历史悠久，可追溯至明代...', 'https://mp.weixin.qq.com/s/UarwhElIN-3PxN7smF66zw', true, 'published', '2025-03-01', 0),
('2', '洋泾老街的记忆', 'history', '曾经的洋泾老街是浦东最繁华的商业街，有浦东南京路之称...', 'https://mp.weixin.qq.com/s/FnPenUUR7-qbm7iEfXECpw', true, 'published', '2025-02-28', 0),
('3', '洋泾港的变迁', 'history', '从主要水道到景观河道的转变...', '', false, 'published', '2025-02-25', 0),
('6', '泾南中学的前身', 'history', '在上海市泾南中学的校门口，一台普通的变压器静静立在路边...', 'https://mp.weixin.qq.com/s/FnPenUUR7-qbm7iEfXECpw', false, 'published', '2026-03-06', 0),
('7', '渡江第一船"京电号"的洋泾记忆', 'history', '在洋泾港的春日里，"京电号"的船影静静伫立...', 'https://mp.weixin.qq.com/s/m7tX-4796kKlh6Gx-4G6XA', false, 'published', '2026-03-10', 0),
('8', '苗圃路碉堡从战场到市井守望', 'history', '漫步洋泾街头，你或许也曾与这座"沉默的老兵"不期而遇...', 'https://mp.weixin.qq.com/s/CT1f9zk7ZU5DzV1gDHvrEA', false, 'published', '2026-03-13', 0),
('9', '洋泾街道建制30周年', 'history', '这张老照片里，是1996年前属于黄浦区的洋泾镇农贸市场...', 'https://mp.weixin.qq.com/s/vR2X3nyz7GiFLTaUarIKoA', false, 'published', '2026-05-15', 0),
-- 地理交通
('4', '地铁14号线昌邑路站', 'transport', '14号线昌邑路站位于浦东大道民生路口...', '', false, 'published', '2025-03-05', 0),
('5', '洋泾公交枢纽', 'transport', '连接浦东浦西的重要公交枢纽...', '', false, 'published', '2025-03-03', 0),
-- 教育资源
('edu_1', '洋泾实验小学', 'education', '洋泾地区优质公办小学...', '', false, 'published', '2025-03-01', 0),
('edu_2', '进才中学北校', 'education', '浦东新区重点中学...', '', false, 'published', '2025-02-28', 0),
('edu_3', '泾南中学', 'education', '历史悠久的完全中学...', '', false, 'published', '2025-02-25', 0),
-- 医疗资源
('med_1', '洋泾社区卫生服务中心', 'medical', '中心提供基本医疗、公共卫生服务，是居民健康的守门人...', 'https://mp.weixin.qq.com/s/xxx', true, 'published', '2025-02-20', 0),
('med_2', '上海市第七人民医院', 'medical', '三级甲等中西医结合医院...', '', false, 'published', '2025-03-01', 0),
-- 公园绿地
('park_1', '泾南公园', 'parks', '洋泾地区标志性城市公园...', '', false, 'published', '2025-03-01', 0),
('park_2', '世纪公园', 'parks', '毗邻洋泾的大型生态公园...', '', false, 'published', '2025-02-28', 0);

-- 更新分类文档计数
UPDATE knowledge_categories SET doc_count = 7 WHERE id = 'history';
UPDATE knowledge_categories SET doc_count = 2 WHERE id = 'transport';
UPDATE knowledge_categories SET doc_count = 3 WHERE id = 'education';
UPDATE knowledge_categories SET doc_count = 2 WHERE id = 'medical';
UPDATE knowledge_categories SET doc_count = 2 WHERE id = 'parks';
UPDATE knowledge_categories SET doc_count = 0 WHERE id IN ('infrastructure', 'culture', 'ip');
