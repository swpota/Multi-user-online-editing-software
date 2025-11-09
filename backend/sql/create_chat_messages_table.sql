-- 创建聊天消息表（文档级别的聊天）
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    -- 消息类型: text, file, image, etc.
    message_type VARCHAR(20) NOT NULL DEFAULT 'text',
    -- 文件信息（如果是文件消息）
    file_name VARCHAR(255),
    file_path VARCHAR(500),
    file_size INTEGER,
    file_type VARCHAR(100),
    -- 回复的消息ID（用于回复功能）
    reply_to INTEGER REFERENCES public.chat_messages(id) ON DELETE SET NULL,
    -- 时间戳
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_chat_messages_document_id ON public.chat_messages(document_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON public.chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_document_created ON public.chat_messages(document_id, created_at DESC);

