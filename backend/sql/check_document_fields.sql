-- 检查并添加 documents 表所需的字段
-- 如果字段不存在，则添加；如果已存在，则忽略

-- 检查并添加 is_locked 字段
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'documents' 
        AND column_name = 'is_locked'
    ) THEN
        ALTER TABLE public.documents ADD COLUMN is_locked BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
END $$;

-- 检查并添加 locked_by 字段
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'documents' 
        AND column_name = 'locked_by'
    ) THEN
        ALTER TABLE public.documents ADD COLUMN locked_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 检查并添加 locked_at 字段
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'documents' 
        AND column_name = 'locked_at'
    ) THEN
        ALTER TABLE public.documents ADD COLUMN locked_at TIMESTAMPTZ;
    END IF;
END $$;

-- 检查并添加 content_format 字段
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'documents' 
        AND column_name = 'content_format'
    ) THEN
        ALTER TABLE public.documents ADD COLUMN content_format TEXT NOT NULL DEFAULT 'rich';
    END IF;
END $$;

-- 检查并添加 markdown_content 字段
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'documents' 
        AND column_name = 'markdown_content'
    ) THEN
        ALTER TABLE public.documents ADD COLUMN markdown_content TEXT;
    END IF;
END $$;

-- 检查并添加 category 字段
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'documents' 
        AND column_name = 'category'
    ) THEN
        ALTER TABLE public.documents ADD COLUMN category TEXT;
    END IF;
END $$;

-- 检查并添加 tags 字段
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'documents' 
        AND column_name = 'tags'
    ) THEN
        ALTER TABLE public.documents ADD COLUMN tags JSONB NOT NULL DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_documents_is_locked ON public.documents(is_locked);
CREATE INDEX IF NOT EXISTS idx_documents_locked_by ON public.documents(locked_by);
CREATE INDEX IF NOT EXISTS idx_documents_content_format ON public.documents(content_format);
CREATE INDEX IF NOT EXISTS idx_documents_category ON public.documents(category);

