/**
 * 文档版本管理路由模块
 * 
 * 功能：提供文档版本的完整管理功能
 * 特性：
 * 1. 版本列表查询（包含创建者信息）
 * 2. 创建版本快照（保存当前文档状态）
 * 3. 查看单个版本详情
 * 4. 版本对比（使用diff-match-patch算法）
 * 5. 恢复历史版本（回滚到指定版本）
 * 6. 支持富文本和Markdown两种格式的版本管理
 * 
 * 说明：从原documentRoutes.js拆分出来，专注于版本管理操作
 */
const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const pool = require("../db");
const { logActivity } = require("../services/logService");
const { validateDocumentId } = require("../middleware/validators");
const { getDocumentAccess, ensureDelta, normalizeArray } = require("../utils/documentUtils");
const { deltaToSimpleHtml } = require("../utils/exportUtils");
const logger = require("../utils/logger");
const { diff_match_patch } = require("diff-match-patch");

const dmp = new diff_match_patch();

/**
 * createDocumentVersionRoutes - 创建文档版本管理路由
 * 
 * @param {object} io - Socket.IO实例，用于实时推送版本更新
 * @returns {Router} - Express路由器
 */
const createDocumentVersionRoutes = (io) => {
  const router = express.Router();

  /**
   * GET /api/documents/:id/versions/compare
   * 比较两个版本的差异
   * 
   * 功能：使用diff-match-patch算法计算两个版本之间的文本差异
   * 权限：需要登录，且对文档有查看权限
   * 
   * 请求参数：
   * - id (路径参数): 文档ID
   * - from (查询参数): 源版本ID
   * - to (查询参数): 目标版本ID
   * 
   * 响应：差异对比结果，包含：
   * - from: 源版本信息（id, title, created_at）
   * - to: 目标版本信息（id, title, created_at）
   * - diffs: diff-match-patch格式的差异数组
   * - format: 对比格式（markdown/rich）
   * 
   * 算法：
   * - 使用Google的diff-match-patch库进行文本差异分析
   * - 支持语义化清理，提高差异可读性
   * - 格式智能适配：两个版本都是Markdown时用Markdown对比，否则转HTML对比
   * - 支持对比同一版本（from === to）
   */
  router.get("/:id/versions/compare", protect, validateDocumentId, async (req, res) => {
    try {
      const documentId = parseInt(req.params.id, 10);
      const fromId = parseInt(req.query.from, 10);
      const toId = parseInt(req.query.to, 10);

      if (isNaN(documentId) || isNaN(fromId) || isNaN(toId)) {
        return res.status(400).json({ message: "无效的版本参数" });
      }

      const access = await getDocumentAccess(documentId, req.user);
      if (access.notFound) {
        return res.status(404).json({ message: "文档不存在" });
      }
      if (!access.canView) {
        return res.status(403).json({ message: "无权查看该文档" });
      }

      // 如果对比同一个版本，只查询一次
      const versionsResult = await pool.query(
        `SELECT id, title, content, category, tags, summary, created_at, content_format, markdown_content
           FROM document_versions
          WHERE document_id = $1 AND id IN ($2, $3)`,
        [documentId, fromId, toId]
      );

      // 允许对比同一个版本（fromId === toId时只会返回1个结果）
      if (versionsResult.rows.length === 0) {
        return res.status(404).json({ message: "版本不存在" });
      }

      const fromVersion = versionsResult.rows.find((v) => v.id === fromId);
      
      if (!fromVersion) {
        return res.status(404).json({ message: "源版本不存在" });
      }
      
      const toVersion = versionsResult.rows.find((v) => v.id === toId) || fromVersion;

      const fromFormat = fromVersion.content_format || "rich";
      const toFormat = toVersion.content_format || "rich";
      const compareFormat = fromFormat === "markdown" && toFormat === "markdown" ? "markdown" : "rich";

      let fromText, toText;

      if (compareFormat === "markdown") {
        fromText = fromVersion.markdown_content || "";
        toText = toVersion.markdown_content || "";
      } else {
        fromText = deltaToSimpleHtml(ensureDelta(fromVersion.content));
        toText = deltaToSimpleHtml(ensureDelta(toVersion.content));
      }

      const diffs = dmp.diff_main(fromText, toText);
      dmp.diff_cleanupSemantic(diffs);

      res.json({
        from: {
          id: fromVersion.id,
          title: fromVersion.title,
          created_at: fromVersion.created_at,
        },
        to: {
          id: toVersion.id,
          title: toVersion.title,
          created_at: toVersion.created_at,
        },
        diffs,
        format: compareFormat,
      });
    } catch (error) {
      logger.error("比较版本失败:", error);
      res.status(500).json({ message: "服务器内部错误" });
    }
  });

  /**
   * GET /api/documents/:id/versions
   * 获取文档的所有版本列表
   * 
   * 功能：查询指定文档的所有历史版本，按创建时间降序排列
   * 权限：需要登录，且对文档有查看权限
   * 
   * 请求参数：
   * - id (路径参数): 文档ID
   * 
   * 响应：版本数组，每个版本包含：
   * - id: 版本ID
   * - title: 版本标题
   * - category: 分类
   * - tags: 标签数组
   * - summary: 版本描述/备注
   * - created_at: 创建时间
   * - created_by_email: 创建者邮箱
   * - created_by_name: 创建者姓名
   * - content_format: 内容格式（rich/markdown）
   * 
   * 排序：按创建时间降序，最新版本在最前
   */
  router.get("/:id/versions", protect, validateDocumentId, async (req, res) => {
    try {
      const documentId = parseInt(req.params.id, 10);
      if (isNaN(documentId)) {
        return res.status(400).json({ message: "无效的文档 ID" });
      }

      const access = await getDocumentAccess(documentId, req.user);
      if (access.notFound) {
        return res.status(404).json({ message: "文档不存在" });
      }
      if (!access.canView) {
        return res.status(403).json({ message: "无权查看该文档" });
      }

      const versionsResult = await pool.query(
        `SELECT dv.id,
                dv.title,
                dv.category,
                dv.tags,
                dv.summary,
                dv.created_at,
                dv.created_by,
                dv.content_format,
                dv.markdown_content,
                u.email AS created_by_email,
                u.full_name AS created_by_name
           FROM document_versions dv
      LEFT JOIN users u ON dv.created_by = u.id
          WHERE dv.document_id = $1
       ORDER BY dv.created_at DESC`,
        [documentId]
      );

      const versions = versionsResult.rows.map((version) => ({
        ...version,
        tags: normalizeArray(version.tags),
      }));

      res.json(versions);
    } catch (error) {
      logger.error("获取版本列表失败:", error);
      res.status(500).json({ message: "服务器内部错误" });
    }
  });

  /**
   * POST /api/documents/:id/versions
   * 创建文档版本快照
   * 
   * 功能：保存当前文档的完整快照作为一个新版本
   * 权限：需要登录，且对文档有编辑权限
   * 
   * 请求参数：
   * - id (路径参数): 文档ID
   * - summary (可选): 版本描述/备注，用于记录此版本的重要变更
   * 
   * 响应：创建的版本对象
   * 
   * 快照内容：
   * - 标题、分类、标签
   * - 完整的文档内容（Delta格式）
   * - Markdown内容（如果是Markdown文档）
   * - 内容格式标识
   * - 创建者和创建时间
   * 
   * 应用场景：
   * - 重要修改前手动保存快照
   * - 里程碑版本记录
   * - 多人协作前的备份
   */
  router.post("/:id/versions", protect, validateDocumentId, async (req, res) => {
    try {
      const documentId = parseInt(req.params.id, 10);
      if (isNaN(documentId)) {
        return res.status(400).json({ message: "无效的文档 ID" });
      }

      const { summary } = req.body;

      const access = await getDocumentAccess(documentId, req.user);
      if (access.notFound) {
        return res.status(404).json({ message: "文档不存在" });
      }
      if (!access.canEdit) {
        return res.status(403).json({ message: "无权保存版本" });
      }

      const { document } = access;
      const deltaContent = ensureDelta(document.content);
      const storedContent = JSON.stringify(deltaContent);
      const storedTags = normalizeArray(document.tags);
      const storedFormat = document.content_format || "rich";
      const storedMarkdown = document.markdown_content || null;

      const newVersionResult = await pool.query(
        `INSERT INTO document_versions (document_id, title, content, category, tags, created_by, summary, content_format, markdown_content)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id,
                title,
                category,
                tags,
                summary,
                created_at,
                created_by,
                content_format,
                markdown_content`,
        [
          documentId,
          document.title,
          storedContent,
          document.category,
          JSON.stringify(storedTags),
          req.user.id,
          summary || null,
          storedFormat,
          storedMarkdown,
        ]
      );

      await logActivity(req.user.id, "SAVE_DOCUMENT_VERSION", "document", documentId, {
        versionId: newVersionResult.rows[0].id,
      });

      res.status(201).json({
        ...newVersionResult.rows[0],
        tags: storedTags,
      });
    } catch (error) {
      logger.error("保存文档版本失败:", error);
      res.status(500).json({ message: "服务器内部错误" });
    }
  });

  /**
   * GET /api/documents/:id/versions/:versionId
   * 获取单个版本的详细信息
   * 
   * 功能：查看指定版本的完整内容和元数据
   * 权限：需要登录，且对文档有查看权限
   * 
   * 请求参数：
   * - id (路径参数): 文档ID
   * - versionId (路径参数): 版本ID
   * 
   * 响应：版本详情对象，包含：
   * - id: 版本ID
   * - title: 版本标题
   * - content: 完整的文档内容（Delta格式）
   * - category: 分类
   * - tags: 标签数组
   * - summary: 版本描述
   * - created_at: 创建时间
   * - created_by_email: 创建者邮箱
   * - created_by_name: 创建者姓名
   * 
   * 用途：
   * - 预览历史版本
   * - 恢复前查看内容
   * - 版本对比
   */
  router.get("/:id/versions/:versionId", protect, validateDocumentId, async (req, res) => {
    try {
      const documentId = parseInt(req.params.id, 10);
      const versionId = parseInt(req.params.versionId, 10);

      if (isNaN(documentId) || isNaN(versionId)) {
        return res.status(400).json({ message: "无效的版本请求" });
      }

      const access = await getDocumentAccess(documentId, req.user);
      if (access.notFound) {
        return res.status(404).json({ message: "文档不存在" });
      }
      if (!access.canView) {
        return res.status(403).json({ message: "无权查看该文档" });
      }

      const versionResult = await pool.query(
        `SELECT dv.id,
                dv.title,
                dv.content,
                dv.category,
                dv.tags,
                dv.summary,
                dv.created_at,
                dv.created_by,
                u.email AS created_by_email,
                u.full_name AS created_by_name
           FROM document_versions dv
      LEFT JOIN users u ON dv.created_by = u.id
          WHERE dv.document_id = $1 AND dv.id = $2`,
        [documentId, versionId]
      );

      if (versionResult.rows.length === 0) {
        return res.status(404).json({ message: "版本不存在" });
      }

      const version = versionResult.rows[0];
      res.json({
        ...version,
        tags: normalizeArray(version.tags),
      });
    } catch (error) {
      logger.error("获取版本失败:", error);
      res.status(500).json({ message: "服务器内部错误" });
    }
  });

  /**
   * POST /api/documents/:id/versions/:versionId/restore
   * 恢复历史版本
   * 
   * 功能：将文档回滚到指定的历史版本
   * 权限：需要登录，且对文档有编辑权限
   * 
   * 请求参数：
   * - id (路径参数): 文档ID
   * - versionId (路径参数): 要恢复的版本ID
   * 
   * 响应：恢复成功消息
   * 
   * 恢复内容：
   * - 文档内容（完整的Delta格式）
   * - 分类
   * - 标签
   * - 内容格式（rich/markdown）
   * - Markdown内容（如果适用）
   * - 更新时间（自动设置为当前时间）
   * 
   * 注意事项：
   * - 这是一个覆盖操作，会替换当前文档的所有内容
   * - 建议在恢复前先创建当前版本的快照
   * - 恢复操作会被记录到活动日志
   * - 文档标题不会被恢复（保留当前标题）
   * 
   * 应用场景：
   * - 误操作后的回滚
   * - 恢复到某个稳定版本
   * - 撤销最近的修改
   */
  router.post("/:id/versions/:versionId/restore", protect, validateDocumentId, async (req, res) => {
    try {
      const documentId = parseInt(req.params.id, 10);
      const versionId = parseInt(req.params.versionId, 10);

      if (isNaN(documentId) || isNaN(versionId)) {
        return res.status(400).json({ message: "无效的版本请求" });
      }

      const access = await getDocumentAccess(documentId, req.user);
      if (access.notFound) {
        return res.status(404).json({ message: "文档不存在" });
      }
      if (!access.canEdit) {
        return res.status(403).json({ message: "无权恢复版本" });
      }

      const versionResult = await pool.query(
        `SELECT * FROM document_versions WHERE document_id = $1 AND id = $2`,
        [documentId, versionId]
      );

      if (versionResult.rows.length === 0) {
        return res.status(404).json({ message: "版本不存在" });
      }

      const version = versionResult.rows[0];

      await pool.query(
        `UPDATE documents
            SET content = $1,
                category = $2,
                tags = $3,
                content_format = $4,
                markdown_content = $5,
                updated_at = NOW()
          WHERE id = $6`,
        [
          version.content,
          version.category,
          version.tags,
          version.content_format || "rich",
          version.markdown_content,
          documentId,
        ]
      );

      await logActivity(req.user.id, "RESTORE_DOCUMENT_VERSION", "document", documentId, {
        versionId: version.id,
      });

      res.json({ message: "版本已恢复" });
    } catch (error) {
      logger.error("恢复版本失败:", error);
      res.status(500).json({ message: "服务器内部错误" });
    }
  });

  return router;
};

module.exports = createDocumentVersionRoutes;

