-- 检查评论表和任务表是否存在
-- 如果表不存在，请先执行 create_comments_table.sql 和 create_tasks_table.sql

-- 检查 document_comments 表
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'document_comments'
        ) THEN 'document_comments 表已存在'
        ELSE 'document_comments 表不存在，请执行 create_comments_table.sql'
    END as comments_table_status;

-- 检查 document_tasks 表
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'document_tasks'
        ) THEN 'document_tasks 表已存在'
        ELSE 'document_tasks 表不存在，请执行 create_tasks_table.sql'
    END as tasks_table_status;

-- 显示表结构（如果表存在）
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'document_comments'
ORDER BY ordinal_position;

SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'document_tasks'
ORDER BY ordinal_position;

