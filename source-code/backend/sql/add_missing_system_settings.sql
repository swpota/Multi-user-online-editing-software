-- 添加缺失的系统设置（如果不存在）
-- 这个脚本只会添加缺失的设置，不会覆盖现有设置

-- 插入必需的系统设置（如果不存在）
INSERT INTO public.system_settings (setting_key, setting_value, setting_type, description)
VALUES 
    ('enable_registration', 'true', 'boolean', '是否允许用户注册')
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO public.system_settings (setting_key, setting_value, setting_type, description)
VALUES 
    ('password_min_length', '6', 'number', '密码最小长度')
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO public.system_settings (setting_key, setting_value, setting_type, description)
VALUES 
    ('enable_chat', 'true', 'boolean', '是否启用聊天功能')
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO public.system_settings (setting_key, setting_value, setting_type, description)
VALUES 
    ('enable_comments', 'true', 'boolean', '是否启用评论功能')
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO public.system_settings (setting_key, setting_value, setting_type, description)
VALUES 
    ('enable_tasks', 'true', 'boolean', '是否启用任务功能')
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO public.system_settings (setting_key, setting_value, setting_type, description)
VALUES 
    ('enable_notifications', 'true', 'boolean', '是否启用通知功能')
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO public.system_settings (setting_key, setting_value, setting_type, description)
VALUES 
    ('enable_video_conference', 'true', 'boolean', '是否启用视频会议功能')
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO public.system_settings (setting_key, setting_value, setting_type, description)
VALUES 
    ('max_file_size_mb', '10', 'number', '最大文件上传大小（MB）')
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO public.system_settings (setting_key, setting_value, setting_type, description)
VALUES 
    ('session_timeout_minutes', '60', 'number', '会话超时时间（分钟）')
ON CONFLICT (setting_key) DO NOTHING;

-- 验证所有必需设置是否存在
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

