# 数据库验证指南

## 如何验证数据库表是否满足要求

### 方法一：使用 SQL 检查脚本（推荐）

1. **打开数据库管理工具**（如 DBeaver、pgAdmin 等）

2. **执行检查脚本**：
   ```sql
   -- 在 DBeaver 或其他数据库工具中执行
   -- 打开并执行 backend/sql/check_admin_tables.sql
   ```

3. **查看结果**：
   - 脚本会显示每个表是否存在（✓ 表示存在，✗ 表示不存在）
   - 显示每个表的字段结构
   - 显示索引和触发器信息
   - 显示每个表的数据量
   - 显示系统设置是否存在

### 方法二：使用修复脚本（如果表缺失）

如果检查脚本显示某些表不存在，可以执行修复脚本：

```sql
-- 在 DBeaver 或其他数据库工具中执行
-- 打开并执行 backend/sql/fix_missing_admin_tables.sql
```

这个脚本会：
- 检查每个表是否存在
- 如果不存在则创建表
- 创建必要的索引
- 创建触发器
- 插入默认系统设置

### 方法三：手动检查（使用 SQL 查询）

在数据库管理工具中执行以下查询：

#### 1. 检查所有必需的表是否存在

```sql
SELECT 
    table_name,
    CASE 
        WHEN table_name IN ('system_settings', 'user_activities', 'satisfaction_surveys', 'system_logs', 'system_metrics', 'audit_logs')
        THEN '✓ 必需表'
        ELSE '其他表'
    END as status
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('system_settings', 'user_activities', 'satisfaction_surveys', 'system_logs', 'system_metrics', 'audit_logs')
ORDER BY table_name;
```

#### 2. 检查 system_settings 表是否有默认数据

```sql
SELECT 
    setting_key,
    setting_value,
    setting_type
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
```

应该看到 9 条记录，如果少于 9 条，说明默认设置不完整。

#### 3. 检查表结构是否正确

```sql
-- 检查 system_settings 表的字段
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'system_settings'
ORDER BY ordinal_position;
```

应该包含以下字段：
- id (integer)
- setting_key (character varying)
- setting_value (text)
- setting_type (character varying)
- description (text)
- created_at (timestamp with time zone)
- updated_at (timestamp with time zone)

### 方法四：使用命令行（PostgreSQL）

如果你使用命令行工具，可以执行：

```bash
# 连接到数据库
psql -U your_username -d your_database

# 执行检查脚本
\i backend/sql/check_admin_tables.sql

# 或者执行修复脚本
\i backend/sql/fix_missing_admin_tables.sql
```

## 必需的表和字段清单

### 1. system_settings 表
必需字段：
- `id` (SERIAL PRIMARY KEY)
- `setting_key` (VARCHAR(100) UNIQUE)
- `setting_value` (TEXT)
- `setting_type` (VARCHAR(50))
- `description` (TEXT)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

必需索引：
- `idx_system_settings_key` (on setting_key)

必需触发器：
- `trigger_update_system_settings_updated_at`

必需数据：
- 9 条默认系统设置记录

### 2. user_activities 表
必需字段：
- `id` (SERIAL PRIMARY KEY)
- `user_id` (INTEGER, REFERENCES users(id))
- `activity_type` (VARCHAR(50))
- `resource_type` (VARCHAR(50))
- `resource_id` (INTEGER)
- `details` (JSONB)
- `ip_address` (VARCHAR(45))
- `user_agent` (TEXT)
- `created_at` (TIMESTAMPTZ)

必需索引：
- `idx_user_activities_user_id`
- `idx_user_activities_type`
- `idx_user_activities_created_at`
- `idx_user_activities_user_type`

### 3. satisfaction_surveys 表
必需字段：
- `id` (SERIAL PRIMARY KEY)
- `user_id` (INTEGER, REFERENCES users(id))
- `rating` (INTEGER, CHECK 1-5)
- `feedback` (TEXT)
- `category` (VARCHAR(50))
- `metadata` (JSONB)
- `created_at` (TIMESTAMPTZ)

必需索引：
- `idx_satisfaction_surveys_user_id`
- `idx_satisfaction_surveys_rating`
- `idx_satisfaction_surveys_category`
- `idx_satisfaction_surveys_created_at`

### 4. system_logs 表
必需字段：
- `id` (SERIAL PRIMARY KEY)
- `log_level` (VARCHAR(20))
- `log_type` (VARCHAR(50))
- `message` (TEXT)
- `details` (JSONB)
- `user_id` (INTEGER, REFERENCES users(id))
- `ip_address` (VARCHAR(45))
- `user_agent` (TEXT)
- `created_at` (TIMESTAMPTZ)

必需索引：
- `idx_system_logs_level`
- `idx_system_logs_type`
- `idx_system_logs_created_at`
- `idx_system_logs_level_type`

### 5. system_metrics 表
必需字段：
- `id` (SERIAL PRIMARY KEY)
- `metric_type` (VARCHAR(50))
- `metric_value` (NUMERIC)
- `metric_unit` (VARCHAR(20))
- `details` (JSONB)
- `created_at` (TIMESTAMPTZ)

必需索引：
- `idx_system_metrics_type`
- `idx_system_metrics_created_at`

### 6. audit_logs 表
必需字段：
- `id` (SERIAL PRIMARY KEY)
- `user_id` (INTEGER, REFERENCES users(id))
- `action` (VARCHAR(100))
- `target_type` (VARCHAR(50))
- `target_id` (INTEGER)
- `details` (JSONB)
- `ip_address` (VARCHAR(45))
- `user_agent` (TEXT)
- `created_at` (TIMESTAMPTZ)

必需索引：
- `idx_audit_logs_user_id`
- `idx_audit_logs_action`
- `idx_audit_logs_created_at`

## 常见问题

### Q: 如果表已存在但缺少某些字段怎么办？
A: 需要手动添加缺失的字段。可以使用 `ALTER TABLE` 语句添加字段。

### Q: 如果表已存在但缺少索引怎么办？
A: 可以执行修复脚本，它会创建缺失的索引（使用 `CREATE INDEX IF NOT EXISTS`）。

### Q: 如果系统设置数据不完整怎么办？
A: 可以执行修复脚本，它会插入缺失的默认设置（使用 `ON CONFLICT DO NOTHING`，不会覆盖现有数据）。

### Q: 如何确认所有表都正确创建了？
A: 执行检查脚本 `check_admin_tables.sql`，它会显示所有表的状态和结构。

## 快速验证命令

在数据库管理工具中执行以下命令，快速查看所有表是否存在：

```sql
SELECT 
    table_name,
    CASE 
        WHEN table_name IN ('system_settings', 'user_activities', 'satisfaction_surveys', 'system_logs', 'system_metrics', 'audit_logs')
        THEN '✓'
        ELSE '✗'
    END as exists
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('system_settings', 'user_activities', 'satisfaction_surveys', 'system_logs', 'system_metrics', 'audit_logs')
ORDER BY table_name;
```

如果所有表都显示 ✓，说明表都已创建。

