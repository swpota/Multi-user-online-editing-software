-- 创建通知表
CREATE TABLE IF NOT EXISTS public.notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 通知类型: comment, task, mention, document_shared, document_updated, etc.
    title VARCHAR(255) NOT NULL,
    content TEXT,
    -- 关联的资源信息
    resource_type VARCHAR(50), -- document, comment, task, etc.
    resource_id INTEGER, -- 关联的资源ID
    -- 发送者信息
    sender_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
    -- 通知元数据
    metadata JSONB DEFAULT '{}'::jsonb, -- 存储额外的通知信息，如文档标题、评论内容等
    -- 状态
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    -- 时间戳
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, is_read, created_at DESC);

-- 创建通知设置表（用于用户自定义通知偏好）
CREATE TABLE IF NOT EXISTS public.notification_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
    -- 通知类型开关
    email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    push_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    -- 各类通知的开关
    comment_notifications BOOLEAN NOT NULL DEFAULT TRUE,
    task_notifications BOOLEAN NOT NULL DEFAULT TRUE,
    mention_notifications BOOLEAN NOT NULL DEFAULT TRUE,
    document_shared_notifications BOOLEAN NOT NULL DEFAULT TRUE,
    document_updated_notifications BOOLEAN NOT NULL DEFAULT TRUE,
    -- 时间戳
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_notification_settings_user_id ON public.notification_settings(user_id);

-- 添加更新时间触发器
CREATE OR REPLACE FUNCTION update_notification_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_notification_settings_updated_at
    BEFORE UPDATE ON public.notification_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_notification_settings_updated_at();

