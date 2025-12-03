-- ============================================
-- MindFlow 数据库性能测试脚本
-- 执行时间: 优化前后各执行一次
-- 目标: 对比优化效果
-- ============================================

-- 使用方法:
-- 1. 优化前: psql -d mindflow -f performance_test.sql > before_optimization.txt
-- 2. 执行优化: psql -d mindflow -f database_optimization.sql
-- 3. 优化后: psql -d mindflow -f performance_test.sql > after_optimization.txt
-- 4. 对比两个文件

\timing on
\echo ''
\echo '=========================================='
\echo 'MindFlow 数据库性能测试'
\echo '测试时间:' `date`
\echo '=========================================='
\echo ''

-- ============================================
-- 测试 1: 用户文档列表查询（高频）
-- ============================================
\echo '测试 1: 用户文档列表查询（按更新时间倒序）'
EXPLAIN ANALYZE
SELECT 
    d.id,
    d.title,
    d.category,
    d.owner_id,
    d.created_at,
    d.updated_at,
    d.is_locked
FROM documents d
WHERE d.owner_id = 1
ORDER BY d.updated_at DESC
LIMIT 50;

\echo ''

-- ============================================
-- 测试 2: 协作文档查询
-- ============================================
\echo '测试 2: 用户所有相关文档（包含协作文档）'
EXPLAIN ANALYZE
SELECT 
    d.id,
    d.title,
    d.category,
    d.owner_id,
    u.full_name AS owner_name,
    d.created_at,
    d.updated_at,
    d.is_locked
FROM documents d
JOIN users u ON d.owner_id = u.id
LEFT JOIN document_collaborators dc ON d.id = dc.document_id
WHERE d.owner_id = 1 OR dc.user_id = 1
ORDER BY d.updated_at DESC
LIMIT 50;

\echo ''

-- ============================================
-- 测试 3: 全文搜索（标题）
-- ============================================
\echo '测试 3: 文档标题全文搜索'
EXPLAIN ANALYZE
SELECT 
    d.id,
    d.title,
    d.category,
    d.created_at
FROM documents d
WHERE to_tsvector('simple', d.title) @@ to_tsquery('simple', '测试')
ORDER BY d.created_at DESC
LIMIT 20;

\echo ''

-- ============================================
-- 测试 4: 公共模板查询（按分类）
-- ============================================
\echo '测试 4: 公共模板分类查询'
EXPLAIN ANALYZE
SELECT 
    id,
    name,
    description,
    category,
    created_at
FROM document_templates
WHERE is_public = true
  AND category = '会议纪要'
ORDER BY created_at DESC
LIMIT 20;

\echo ''

-- ============================================
-- 测试 5: 锁定文档查询
-- ============================================
\echo '测试 5: 锁定文档列表'
EXPLAIN ANALYZE
SELECT 
    d.id,
    d.title,
    d.locked_by,
    u.full_name AS locked_by_name,
    d.locked_at
FROM documents d
JOIN users u ON d.locked_by = u.id
WHERE d.is_locked = true
ORDER BY d.locked_at DESC;

\echo ''

-- ============================================
-- 测试 6: 用户活动统计（时间范围）
-- ============================================
\echo '测试 6: 用户近30天活动统计'
EXPLAIN ANALYZE
SELECT 
    user_id,
    activity_type,
    COUNT(*) AS activity_count,
    MAX(created_at) AS last_activity
FROM user_activities
WHERE user_id = 1
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY user_id, activity_type
ORDER BY activity_count DESC;

\echo ''

-- ============================================
-- 测试 7: 文档详细信息（含统计）
-- ============================================
\echo '测试 7: 文档详细信息（包含协作者、评论、版本统计）'
EXPLAIN ANALYZE
SELECT 
    d.id,
    d.title,
    d.content,
    d.owner_id,
    u.full_name AS owner_name,
    COUNT(DISTINCT dc.user_id) AS collaborator_count,
    COUNT(DISTINCT c.id) AS comment_count,
    COUNT(DISTINCT dv.id) AS version_count
FROM documents d
JOIN users u ON d.owner_id = u.id
LEFT JOIN document_collaborators dc ON d.id = dc.document_id
LEFT JOIN document_comments c ON d.id = c.document_id
LEFT JOIN document_versions dv ON d.id = dv.document_id
WHERE d.id = 1
GROUP BY d.id, d.title, d.content, d.owner_id, u.full_name;

\echo ''

-- ============================================
-- 测试 8: 任务统计查询
-- ============================================
\echo '测试 8: 用户任务统计（按状态分组）'
EXPLAIN ANALYZE
SELECT 
    status,
    COUNT(*) AS task_count,
    COUNT(CASE WHEN due_date < NOW() THEN 1 END) AS overdue_count
FROM document_tasks
WHERE assigned_to = 1
GROUP BY status;

\echo ''

-- ============================================
-- 测试 9: 通知查询（未读）
-- ============================================
\echo '测试 9: 用户未读通知查询'
EXPLAIN ANALYZE
SELECT 
    id,
    type,
    title,
    content,
    created_at
FROM notifications
WHERE user_id = 1
  AND is_read = false
ORDER BY created_at DESC
LIMIT 50;

\echo ''

-- ============================================
-- 测试 10: 系统活动统计（按日期）
-- ============================================
\echo '测试 10: 近7天系统活动统计'
EXPLAIN ANALYZE
SELECT 
    DATE(created_at) AS activity_date,
    COUNT(*) AS total_activities,
    COUNT(DISTINCT user_id) AS active_users
FROM user_activities
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY activity_date DESC;

\echo ''

-- ============================================
-- 性能监控查询
-- ============================================
\echo '=========================================='
\echo '数据库性能指标'
\echo '=========================================='
\echo ''

\echo '1. 表大小和索引统计:'
SELECT 
    relname AS table_name,
    n_live_tup AS row_count,
    pg_size_pretty(pg_relation_size(relid)) AS table_size,
    pg_size_pretty(pg_total_relation_size(relid) - pg_relation_size(relid)) AS index_size,
    ROUND((pg_total_relation_size(relid) - pg_relation_size(relid))::NUMERIC / 
          NULLIF(pg_relation_size(relid), 0), 2) AS index_ratio
FROM pg_stat_user_tables
WHERE n_live_tup > 0
ORDER BY pg_total_relation_size(relid) DESC;

\echo ''
\echo '2. 索引使用率:'
SELECT 
    relname AS table_name,
    seq_scan AS sequential_scans,
    idx_scan AS index_scans,
    CASE 
        WHEN seq_scan + idx_scan = 0 THEN 0
        ELSE ROUND(idx_scan::NUMERIC / (seq_scan + idx_scan) * 100, 2)
    END AS index_usage_percent
FROM pg_stat_user_tables
WHERE n_live_tup > 0
ORDER BY index_usage_percent ASC;

\echo ''
\echo '3. 缓冲区命中率:'
SELECT 
    ROUND((sum(heap_blks_hit)::NUMERIC / 
           NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0)) * 100, 2) 
    AS cache_hit_ratio_percent
FROM pg_statio_user_tables;

\echo ''
\echo '4. 未使用的索引（扫描次数 < 10）:'
SELECT 
    schemaname,
    relname AS tablename,
    indexrelname AS indexname,
    idx_scan AS scans,
    pg_size_pretty(pg_relation_size(indexrelid)) AS size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND idx_scan < 10
  AND indexrelname NOT LIKE '%_pkey'
ORDER BY pg_relation_size(indexrelid) DESC;

\echo ''
\echo '=========================================='
\echo '性能测试完成!'
\echo '=========================================='
\echo ''
\echo '对比说明:'
\echo '  - 查看每个查询的 "Execution Time"'
\echo '  - 优化后应减少 60-75%'
\echo '  - 注意 "Index Scan" vs "Seq Scan"'
\echo '  - 索引使用率应该提升到 80%+'
\echo ''

\timing off
