-- 为 user_activities 表添加 details 字段（如果不存在）
-- 这个脚本用于修复缺少 details 字段的问题

-- 检查并添加 details 字段
DO $$
BEGIN
    -- 检查字段是否存在
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'user_activities' 
        AND column_name = 'details'
    ) THEN
        -- 添加 details 字段
        ALTER TABLE public.user_activities 
        ADD COLUMN details JSONB DEFAULT '{}'::jsonb;
        
        RAISE NOTICE '已添加 details 字段到 user_activities 表';
    ELSE
        RAISE NOTICE 'details 字段已存在，无需添加';
    END IF;
END $$;

-- 验证字段是否已添加
SELECT 
    'user_activities 表字段检查' as check_type,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'user_activities'
ORDER BY ordinal_position;

