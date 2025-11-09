-- 创建评论与批注表
CREATE TABLE IF NOT EXISTS public.document_comments (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    parent_id INTEGER REFERENCES public.document_comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    author_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    -- 评论位置信息（用于行内评论）
    anchor_text TEXT, -- 锚点文本（选中的文本）
    anchor_index INTEGER, -- 锚点在文档中的位置索引
    anchor_length INTEGER, -- 锚点文本长度
    -- 批注位置信息（用于批注）
    selection_range JSONB, -- 选中的范围 {index: number, length: number}
    -- 提及的用户列表
    mentioned_user_ids INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    -- 状态
    is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    -- 时间戳
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_comments_document_id ON public.document_comments(document_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON public.document_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_author_id ON public.document_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON public.document_comments(created_at DESC);

-- 添加更新时间触发器
CREATE OR REPLACE FUNCTION update_comments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_comments_updated_at
    BEFORE UPDATE ON public.document_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_comments_updated_at();

