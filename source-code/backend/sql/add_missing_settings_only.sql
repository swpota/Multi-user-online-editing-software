-- 添加缺失的3个必需系统设置
-- 这个脚本只会添加缺失的设置，不会覆盖现有设置

-- 1. 添加 enable_notifications 设置（如果不存在）
INSERT INTO public.system_settings (setting_key, setting_value, setting_type, description)
VALUES 
    ('enable_notifications', 'true', 'boolean', '是否启用通知功能')
ON CONFLICT (setting_key) DO NOTHING;

-- 2. 添加 max_file_size_mb 设置（如果不存在）
INSERT INTO public.system_settings (setting_key, setting_value, setting_type, description)
VALUES 
    ('max_file_size_mb', '10', 'number', '最大文件上传大小（MB）')
ON CONFLICT (setting_key) DO NOTHING;

-- 3. 添加 session_timeout_minutes 设置（如果不存在）
INSERT INTO public.system_settings (setting_key, setting_value, setting_type, description)
VALUES 
    ('session_timeout_minutes', '60', 'number', '会话超时时间（分钟）')
ON CONFLICT (setting_key) DO NOTHING;

-- 验证所有9个必需设置是否存在
SELECT 
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

-- 检查是否还有缺失的设置
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

-- 如果上面的查询返回0行，说明所有必需设置都已存在
SELECT 
    CASE 
        WHEN NOT EXISTS (
            SELECT 1 FROM (
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
            )
        )
        THEN '✓ 所有9个必需设置都已存在'
        ELSE '✗ 仍有缺失的设置，请查看上面的结果'
    END as final_status;

