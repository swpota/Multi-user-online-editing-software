-- 检查管理员模块所需的数据库表是否存在以及结构是否正确

-- 1. 检查 system_settings 表
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'system_settings'
        ) THEN '✓ system_settings 表已存在'
        ELSE '✗ system_settings 表不存在，请执行 create_admin_tables.sql'
    END as system_settings_status;

-- 检查 system_settings 表的字段
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'system_settings'
ORDER BY ordinal_position;

-- 检查是否有默认设置数据
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM system_settings WHERE setting_key = 'enable_registration') 
        THEN '✓ 默认系统设置已存在'
        ELSE '✗ 默认系统设置不存在，请执行 create_admin_tables.sql 中的 INSERT 语句'
    END as default_settings_status;

-- 2. 检查 user_activities 表
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'user_activities'
        ) THEN '✓ user_activities 表已存在'
        ELSE '✗ user_activities 表不存在，请执行 create_admin_tables.sql'
    END as user_activities_status;

-- 检查 user_activities 表的字段
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'user_activities'
ORDER BY ordinal_position;

-- 3. 检查 satisfaction_surveys 表
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'satisfaction_surveys'
        ) THEN '✓ satisfaction_surveys 表已存在'
        ELSE '✗ satisfaction_surveys 表不存在，请执行 create_admin_tables.sql'
    END as satisfaction_surveys_status;

-- 检查 satisfaction_surveys 表的字段
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'satisfaction_surveys'
ORDER BY ordinal_position;

-- 4. 检查 system_logs 表
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'system_logs'
        ) THEN '✓ system_logs 表已存在'
        ELSE '✗ system_logs 表不存在，请执行 create_admin_tables.sql'
    END as system_logs_status;

-- 检查 system_logs 表的字段
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'system_logs'
ORDER BY ordinal_position;

-- 5. 检查 system_metrics 表
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'system_metrics'
        ) THEN '✓ system_metrics 表已存在'
        ELSE '✗ system_metrics 表不存在，请执行 create_admin_tables.sql'
    END as system_metrics_status;

-- 检查 system_metrics 表的字段
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'system_metrics'
ORDER BY ordinal_position;

-- 6. 检查 audit_logs 表
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'audit_logs'
        ) THEN '✓ audit_logs 表已存在'
        ELSE '✗ audit_logs 表不存在，请执行 create_admin_tables.sql'
    END as audit_logs_status;

-- 检查 audit_logs 表的字段
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'audit_logs'
ORDER BY ordinal_position;

-- 7. 检查索引是否存在
SELECT 
    indexname,
    tablename
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('system_settings', 'user_activities', 'satisfaction_surveys', 'system_logs', 'system_metrics', 'audit_logs')
ORDER BY tablename, indexname;

-- 8. 检查触发器是否存在
SELECT 
    trigger_name,
    event_object_table as table_name,
    action_timing,
    event_manipulation
FROM information_schema.triggers
WHERE event_object_schema = 'public'
AND event_object_table IN ('system_settings', 'user_activities', 'satisfaction_surveys', 'system_logs', 'system_metrics', 'audit_logs')
ORDER BY event_object_table, trigger_name;

-- 9. 统计每个表的数据量（如果表存在）
DO $$
DECLARE
    table_name_var TEXT;
    count_var INTEGER;
BEGIN
    FOR table_name_var IN 
        SELECT unnest(ARRAY['system_settings', 'user_activities', 'satisfaction_surveys', 'system_logs', 'system_metrics', 'audit_logs'])
    LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = table_name_var
        ) THEN
            EXECUTE format('SELECT COUNT(*) FROM %I', table_name_var) INTO count_var;
            RAISE NOTICE '表 % 中有 % 条记录', table_name_var, count_var;
        ELSE
            RAISE NOTICE '表 % 不存在', table_name_var;
        END IF;
    END LOOP;
END $$;

-- 10. 检查必需的系统设置是否存在
SELECT 
    setting_key,
    setting_value,
    setting_type,
    description
FROM system_settings
WHERE setting_key IN (
    'enable_registration',
    'password_min_length',
    'enable_chat',
    'enable_comments',
    'enable_tasks',
    'enable_notifications',
    'enable_video_conference',
    'max_file_size_mb',
    'session_timeout_minutes'
)
ORDER BY setting_key;

