-- 为 document_templates 表添加 format 列
-- 用于存储模板的格式类型（rich 或 markdown）

-- 检查列是否已存在
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'document_templates'
        AND column_name = 'format'
    ) THEN
        -- 添加 format 列，默认值为 'rich'
        ALTER TABLE document_templates
        ADD COLUMN format VARCHAR(20) DEFAULT 'rich';
        
        RAISE NOTICE 'format 列已成功添加到 document_templates 表';
    ELSE
        RAISE NOTICE 'format 列已存在于 document_templates 表中';
    END IF;
END $$;

-- 为现有模板设置默认格式
-- 如果 content 包含 ops 字段，设置为 rich；否则设置为 markdown
UPDATE document_templates
SET format = CASE
    WHEN content::text LIKE '%"ops"%' THEN 'rich'
    ELSE 'markdown'
END
WHERE format IS NULL OR format = '';

-- 验证修改
SELECT 
    column_name, 
    data_type, 
    column_default
FROM information_schema.columns
WHERE table_name = 'document_templates'
AND column_name = 'format';
