-- 创建满意度调查表（如果不存在）

-- 创建 satisfaction_surveys 表
CREATE TABLE IF NOT EXISTS public.satisfaction_surveys (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES public.users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5), -- 1-5分
    feedback TEXT,
    category VARCHAR(50), -- overall, usability, performance, features, support
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_satisfaction_surveys_user_id ON public.satisfaction_surveys(user_id);
CREATE INDEX IF NOT EXISTS idx_satisfaction_surveys_rating ON public.satisfaction_surveys(rating);
CREATE INDEX IF NOT EXISTS idx_satisfaction_surveys_category ON public.satisfaction_surveys(category);
CREATE INDEX IF NOT EXISTS idx_satisfaction_surveys_created_at ON public.satisfaction_surveys(created_at DESC);

-- 验证表是否创建成功
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'satisfaction_surveys'
        ) THEN '✓ satisfaction_surveys 表创建成功'
        ELSE '✗ satisfaction_surveys 表创建失败'
    END as status;

-- 显示表结构
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'satisfaction_surveys'
ORDER BY ordinal_position;

