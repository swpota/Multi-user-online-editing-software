-- 创建文档文件共享表
CREATE TABLE IF NOT EXISTS public.document_files (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    uploaded_by INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INTEGER NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    mime_type VARCHAR(100),
    -- 文件描述
    description TEXT,
    -- 时间戳
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_document_files_document_id ON public.document_files(document_id);
CREATE INDEX IF NOT EXISTS idx_document_files_uploaded_by ON public.document_files(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_document_files_created_at ON public.document_files(created_at DESC);

-- 添加更新时间触发器
CREATE OR REPLACE FUNCTION update_document_files_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_document_files_updated_at
    BEFORE UPDATE ON public.document_files
    FOR EACH ROW
    EXECUTE FUNCTION update_document_files_updated_at();

