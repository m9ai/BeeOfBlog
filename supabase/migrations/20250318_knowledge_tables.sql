-- 知识库分类表
CREATE TABLE IF NOT EXISTS public.knowledge_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    color TEXT NOT NULL DEFAULT '#3b82f6',
    sort_order INTEGER NOT NULL DEFAULT 0,
    doc_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 知识库文档表
CREATE TABLE IF NOT EXISTS public.knowledge_docs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    title TEXT NOT NULL,
    category_id TEXT NOT NULL REFERENCES public.knowledge_categories(id) ON DELETE CASCADE,
    summary TEXT,
    url TEXT NOT NULL,
    is_hot BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('published', 'draft')),
    update_time DATE NOT NULL DEFAULT CURRENT_DATE,
    view_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_category ON public.knowledge_docs(category_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_status ON public.knowledge_docs(status);
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_hot ON public.knowledge_docs(is_hot);

-- 启用 RLS
ALTER TABLE public.knowledge_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_docs ENABLE ROW LEVEL SECURITY;

-- 允许所有用户读取
CREATE POLICY "Allow public read access on knowledge_categories"
    ON public.knowledge_categories FOR SELECT
    USING (true);

CREATE POLICY "Allow public read access on knowledge_docs"
    ON public.knowledge_docs FOR SELECT
    USING (true);

-- 只有管理员可以写入
CREATE POLICY "Allow admin write access on knowledge_categories"
    ON public.knowledge_categories FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = 'admin'
    ));

CREATE POLICY "Allow admin write access on knowledge_docs"
    ON public.knowledge_docs FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = 'admin'
    ));

-- 更新时间戳的触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为表添加自动更新时间戳的触发器
CREATE TRIGGER update_knowledge_categories_updated_at
    BEFORE UPDATE ON public.knowledge_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_knowledge_docs_updated_at
    BEFORE UPDATE ON public.knowledge_docs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 插入默认分类
INSERT INTO public.knowledge_categories (id, name, icon, description, color, sort_order) VALUES
('history', '历史沿革', '📜', '洋泾历史变迁', '#8b5cf6', 0),
('infrastructure', '公建配套', '🏗️', '道路桥梁建设', '#6366f1', 1),
('transport', '地理交通', '🚇', '地铁公交线路', '#3b82f6', 2),
('education', '教育资源', '🎓', '学校幼儿园', '#10b981', 3),
('medical', '医疗资源', '🏥', '医院卫生站', '#f59e0b', 4),
('culture', '社区文化', '🎭', '文化场馆活动', '#ec4899', 5),
('parks', '公园绿地', '🌳', '公园绿化休闲', '#22c55e', 6),
('ip', '代表性IP', '⭐', '洋泾特色品牌', '#f97316', 7)
ON CONFLICT (id) DO NOTHING;
