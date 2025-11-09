-- 创建任务分配与跟踪表
CREATE TABLE IF NOT EXISTS public.document_tasks (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    -- 任务位置信息（关联到文档中的位置）
    anchor_text TEXT, -- 关联的文本
    anchor_index INTEGER, -- 在文档中的位置索引
    anchor_length INTEGER, -- 文本长度
    -- 任务分配
    created_by INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    assigned_to INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
    -- 任务状态
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    -- 时间信息
    due_date TIMESTAMPTZ, -- 截止日期
    completed_at TIMESTAMPTZ, -- 完成时间
    completed_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
    -- 时间戳
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_tasks_document_id ON public.document_tasks(document_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.document_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.document_tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.document_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON public.document_tasks(created_at DESC);

-- 添加更新时间触发器
CREATE OR REPLACE FUNCTION update_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_tasks_updated_at
    BEFORE UPDATE ON public.document_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_tasks_updated_at();

