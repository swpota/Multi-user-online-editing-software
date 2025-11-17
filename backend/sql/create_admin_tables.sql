-- 创建管理员模块所需的数据库表

-- 1. 系统设置表
CREATE TABLE IF NOT EXISTS public.system_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value TEXT NOT NULL,
    setting_type VARCHAR(50) NOT NULL DEFAULT 'string', -- string, number, boolean, json
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON public.system_settings(setting_key);

-- 添加更新时间触发器
CREATE OR REPLACE FUNCTION update_system_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_system_settings_updated_at
    BEFORE UPDATE ON public.system_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_system_settings_updated_at();

-- 插入默认系统设置
INSERT INTO public.system_settings (setting_key, setting_value, setting_type, description)
VALUES 
    ('enable_registration', 'true', 'boolean', '是否允许用户注册'),
    ('password_min_length', '6', 'number', '密码最小长度'),
    ('enable_chat', 'true', 'boolean', '是否启用聊天功能'),
    ('enable_comments', 'true', 'boolean', '是否启用评论功能'),
    ('enable_tasks', 'true', 'boolean', '是否启用任务功能'),
    ('enable_notifications', 'true', 'boolean', '是否启用通知功能'),
    ('enable_video_conference', 'true', 'boolean', '是否启用视频会议功能'),
    ('max_file_size_mb', '10', 'number', '最大文件上传大小（MB）'),
    ('session_timeout_minutes', '60', 'number', '会话超时时间（分钟）')
ON CONFLICT (setting_key) DO NOTHING;

-- 2. 用户行为分析表
CREATE TABLE IF NOT EXISTS public.user_activities (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES public.users(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL, -- login, logout, document_create, document_edit, document_view, comment_create, task_create, etc.
    resource_type VARCHAR(50), -- document, comment, task, etc.
    resource_id INTEGER,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_activities_user_id ON public.user_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activities_type ON public.user_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_user_activities_created_at ON public.user_activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activities_user_type ON public.user_activities(user_id, activity_type, created_at DESC);

-- 3. 满意度调查表
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

-- 4. 系统日志表（用于错误日志和性能监控）
CREATE TABLE IF NOT EXISTS public.system_logs (
    id SERIAL PRIMARY KEY,
    log_level VARCHAR(20) NOT NULL, -- info, warning, error, critical
    log_type VARCHAR(50) NOT NULL, -- error, performance, security, system
    message TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON public.system_logs(log_level);
CREATE INDEX IF NOT EXISTS idx_system_logs_type ON public.system_logs(log_type);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON public.system_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_level_type ON public.system_logs(log_level, log_type, created_at DESC);

-- 5. 系统性能监控表
CREATE TABLE IF NOT EXISTS public.system_metrics (
    id SERIAL PRIMARY KEY,
    metric_type VARCHAR(50) NOT NULL, -- cpu, memory, disk, network, response_time, etc.
    metric_value NUMERIC NOT NULL,
    metric_unit VARCHAR(20), -- %, MB, ms, etc.
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_system_metrics_type ON public.system_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_system_metrics_created_at ON public.system_metrics(created_at DESC);

-- 6. 审计日志表（如果不存在）
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50),
    target_id INTEGER,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

