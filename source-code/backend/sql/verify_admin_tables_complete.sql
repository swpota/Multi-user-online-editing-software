-- 完整验证管理员模块数据库表
-- 检查所有表的结构和必需数据

-- ============================================
-- 1. 验证所有必需的表是否存在
-- ============================================
SELECT 
    '表存在性检查' as check_type,
    table_name,
    CASE 
        WHEN table_name IN ('system_settings', 'user_activities', 'satisfaction_surveys', 'system_logs', 'system_metrics', 'audit_logs')
        THEN '✓ 存在'
        ELSE '✗ 不存在'
    END as status
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('system_settings', 'user_activities', 'satisfaction_surveys', 'system_logs', 'system_metrics', 'audit_logs')
ORDER BY table_name;

-- ============================================
-- 2. 验证 system_settings 表的必需字段
-- ============================================
SELECT 
    'system_settings 字段检查' as check_type,
    column_name,
    data_type,
    is_nullable,
    CASE 
        WHEN column_name IN ('id', 'setting_key', 'setting_value', 'setting_type', 'description', 'created_at', 'updated_at')
        THEN '✓ 必需字段'
        ELSE '其他字段'
    END as status
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'system_settings'
ORDER BY ordinal_position;

-- ============================================
-- 3. 验证 system_settings 表的必需设置
-- ============================================
SELECT 
    'system_settings 必需设置检查' as check_type,
    setting_key,
    setting_value,
    setting_type,
    CASE 
        WHEN setting_key IN (
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
        THEN '✓ 必需设置'
        ELSE '其他设置'
    END as status
FROM system_settings
ORDER BY 
    CASE 
        WHEN setting_key IN (
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
        THEN 0
        ELSE 1
    END,
    setting_key;

-- 检查是否缺少必需设置
SELECT 
    '缺少的必需设置' as check_type,
    missing_key as setting_key,
    '✗ 缺失' as status
FROM (
    SELECT unnest(ARRAY[
        'enable_registration',
        'password_min_length',
        'enable_chat',
        'enable_comments',
        'enable_tasks',
        'enable_notifications',
        'enable_video_conference',
        'max_file_size_mb',
        'session_timeout_minutes'
    ]) as missing_key
) as required
WHERE NOT EXISTS (
    SELECT 1 FROM system_settings 
    WHERE setting_key = required.missing_key
);

-- ============================================
-- 4. 验证 user_activities 表的必需字段
-- ============================================
SELECT 
    'user_activities 字段检查' as check_type,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'user_activities'
ORDER BY ordinal_position;

-- ============================================
-- 5. 验证 satisfaction_surveys 表的必需字段
-- ============================================
SELECT 
    'satisfaction_surveys 字段检查' as check_type,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'satisfaction_surveys'
ORDER BY ordinal_position;

-- ============================================
-- 6. 验证 system_logs 表的必需字段
-- ============================================
SELECT 
    'system_logs 字段检查' as check_type,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'system_logs'
ORDER BY ordinal_position;

-- ============================================
-- 7. 验证 system_metrics 表的必需字段
-- ============================================
SELECT 
    'system_metrics 字段检查' as check_type,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'system_metrics'
ORDER BY ordinal_position;

-- ============================================
-- 8. 验证 audit_logs 表的必需字段
-- ============================================
SELECT 
    'audit_logs 字段检查' as check_type,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'audit_logs'
ORDER BY ordinal_position;

-- ============================================
-- 9. 验证索引是否存在
-- ============================================
SELECT 
    '索引检查' as check_type,
    tablename,
    indexname,
    '✓ 存在' as status
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('system_settings', 'user_activities', 'satisfaction_surveys', 'system_logs', 'system_metrics', 'audit_logs')
ORDER BY tablename, indexname;

-- ============================================
-- 10. 统计每个表的数据量
-- ============================================
SELECT 
    '数据量统计' as check_type,
    'system_settings' as table_name,
    COUNT(*) as record_count
FROM system_settings
UNION ALL
SELECT 
    '数据量统计',
    'user_activities',
    COUNT(*)
FROM user_activities
UNION ALL
SELECT 
    '数据量统计',
    'satisfaction_surveys',
    COUNT(*)
FROM satisfaction_surveys
UNION ALL
SELECT 
    '数据量统计',
    'system_logs',
    COUNT(*)
FROM system_logs
UNION ALL
SELECT 
    '数据量统计',
    'system_metrics',
    COUNT(*)
FROM system_metrics
UNION ALL
SELECT 
    '数据量统计',
    'audit_logs',
    COUNT(*)
FROM audit_logs
ORDER BY table_name;

-- ============================================
-- 11. 最终验证总结
-- ============================================
SELECT 
    '最终验证总结' as summary,
    CASE 
        WHEN (
            -- 检查所有表是否存在
            (SELECT COUNT(*) FROM information_schema.tables 
             WHERE table_schema = 'public' 
             AND table_name IN ('system_settings', 'user_activities', 'satisfaction_surveys', 'system_logs', 'system_metrics', 'audit_logs')) = 6
            -- 检查必需设置是否存在
            AND (SELECT COUNT(*) FROM system_settings 
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
                 )) >= 9
        )
        THEN '✓ 所有表和数据都已就绪，可以正常使用管理模块功能'
        ELSE '✗ 部分表或数据缺失，请检查上述结果'
    END as status;

