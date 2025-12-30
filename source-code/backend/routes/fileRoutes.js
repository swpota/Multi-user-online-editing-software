const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const pool = require("../db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// 确保上传目录存在
const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// 配置文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter: (req, file, cb) => {
    // 允许所有文件类型
    cb(null, true);
  },
});

const createFileRoutes = (io) => {
  const router = express.Router();

  // 获取文档的文件列表
  router.get(
    "/documents/:documentId/files",
    protect,
    async (req, res) => {
      try {
        const documentId = parseInt(req.params.documentId, 10);

        // 检查用户是否有权限查看文档
        const docCheck = await pool.query(
          `SELECT d.id, d.owner_id,
                  CASE 
                    WHEN d.owner_id = $2 THEN 'owner'
                    WHEN EXISTS (
                      SELECT 1 FROM document_collaborators dc 
                      WHERE dc.document_id = d.id AND dc.user_id = $2
                    ) THEN (
                      SELECT dc.role FROM document_collaborators dc 
                      WHERE dc.document_id = d.id AND dc.user_id = $2
                    )
                    ELSE NULL
                  END as user_role
           FROM documents d
           WHERE d.id = $1`,
          [documentId, req.user.id]
        );

        if (docCheck.rows.length === 0) {
          return res.status(404).json({ message: "文档不存在" });
        }

        const userRole = docCheck.rows[0].user_role;
        if (!userRole) {
          return res.status(403).json({ message: "无权查看该文档的文件" });
        }

        // 获取文件列表
        const result = await pool.query(
          `SELECT 
            df.*,
            json_build_object(
              'id', u.id,
              'email', u.email,
              'full_name', u.full_name,
              'avatar_url', u.avatar_url
            ) as uploaded_by_user
          FROM document_files df
          JOIN users u ON df.uploaded_by = u.id
          WHERE df.document_id = $1
          ORDER BY df.created_at DESC`,
          [documentId]
        );

        res.json(result.rows);
      } catch (error) {
        console.error("获取文件列表失败:", error);
        res.status(500).json({ message: "服务器内部错误" });
      }
    }
  );

  // 上传文件
  router.post(
    "/documents/:documentId/files",
    protect,
    upload.single("file"),
    async (req, res) => {
      try {
        const documentId = parseInt(req.params.documentId, 10);

        if (!req.file) {
          return res.status(400).json({ message: "没有上传文件" });
        }

        // 检查用户是否有权限访问文档
        const docCheck = await pool.query(
          `SELECT d.id, d.owner_id,
                  CASE 
                    WHEN d.owner_id = $2 THEN 'owner'
                    WHEN EXISTS (
                      SELECT 1 FROM document_collaborators dc 
                      WHERE dc.document_id = d.id AND dc.user_id = $2
                    ) THEN (
                      SELECT dc.role FROM document_collaborators dc 
                      WHERE dc.document_id = d.id AND dc.user_id = $2
                    )
                    ELSE NULL
                  END as user_role
           FROM documents d
           WHERE d.id = $1`,
          [documentId, req.user.id]
        );

        if (docCheck.rows.length === 0) {
          // 删除上传的文件
          fs.unlinkSync(req.file.path);
          return res.status(404).json({ message: "文档不存在" });
        }

        const userRole = docCheck.rows[0].user_role;
        if (!userRole) {
          // 删除上传的文件
          fs.unlinkSync(req.file.path);
          return res.status(403).json({ message: "无权在该文档中上传文件" });
        }

        // 解码文件名（处理中文等特殊字符）
        let originalName = req.file.originalname;
        try {
          // multer可能会错误地将UTF-8字节解释为Latin1，需要重新编码
          originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
        } catch (e) {
          // 如果转换失败，使用原始文件名
          console.warn('文件名编码转换失败，使用原始文件名:', e);
        }

        // 创建文件记录
        const result = await pool.query(
          `INSERT INTO document_files (
            document_id, uploaded_by, file_name, original_name,
            file_path, file_size, file_type, mime_type, description
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
          RETURNING *`,
          [
            documentId,
            req.user.id,
            req.file.filename,
            originalName,
            req.file.path,
            req.file.size,
            path.extname(originalName),
            req.file.mimetype,
            req.body.description || null,
          ]
        );

        // 获取完整的文件信息
        const fullFileResult = await pool.query(
          `SELECT 
            df.*,
            json_build_object(
              'id', u.id,
              'email', u.email,
              'full_name', u.full_name,
              'avatar_url', u.avatar_url
            ) as uploaded_by_user
          FROM document_files df
          JOIN users u ON df.uploaded_by = u.id
          WHERE df.id = $1`,
          [result.rows[0].id]
        );

        const fullFile = fullFileResult.rows[0];

        // 通过 Socket.IO 实时通知
        if (io) {
          io.to(String(documentId)).emit("newFileUploaded", fullFile);
        }

        res.status(201).json(fullFile);
      } catch (error) {
        console.error("上传文件失败:", error);
        // 删除上传的文件
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ message: "服务器内部错误" });
      }
    }
  );

  // 下载文件
  router.get("/files/:fileId/download", protect, async (req, res) => {
    try {
      const fileId = parseInt(req.params.fileId, 10);

      // 获取文件信息
      const fileResult = await pool.query(
        `SELECT df.*, d.id as document_id
         FROM document_files df
         JOIN documents d ON df.document_id = d.id
         WHERE df.id = $1`,
        [fileId]
      );

      if (fileResult.rows.length === 0) {
        return res.status(404).json({ message: "文件不存在" });
      }

      const file = fileResult.rows[0];

      // 检查用户是否有权限访问文档
      const docCheck = await pool.query(
        `SELECT d.id, d.owner_id,
                CASE 
                  WHEN d.owner_id = $2 THEN 'owner'
                  WHEN EXISTS (
                    SELECT 1 FROM document_collaborators dc 
                    WHERE dc.document_id = d.id AND dc.user_id = $2
                  ) THEN (
                    SELECT dc.role FROM document_collaborators dc 
                    WHERE dc.document_id = d.id AND dc.user_id = $2
                  )
                  ELSE NULL
                END as user_role
         FROM documents d
         WHERE d.id = $1`,
        [file.document_id, req.user.id]
      );

      if (docCheck.rows.length === 0) {
        return res.status(404).json({ message: "文档不存在" });
      }

      const userRole = docCheck.rows[0].user_role;
      if (!userRole) {
        return res.status(403).json({ message: "无权下载该文件" });
      }

      // 检查文件是否存在
      if (!fs.existsSync(file.file_path)) {
        return res.status(404).json({ message: "文件不存在" });
      }

      // 设置正确的Content-Disposition header以支持中文文件名
      const fileName = file.original_name || file.file_name || "file";
      const encodedFileName = encodeURIComponent(fileName).replace(/['()]/g, escape).replace(/\*/g, '%2A');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFileName}`);
      res.setHeader('Content-Type', 'application/octet-stream');
      
      // 发送文件（确保使用绝对路径）
      const absolutePath = path.isAbsolute(file.file_path) ? file.file_path : path.resolve(file.file_path);
      res.sendFile(absolutePath, (err) => {
        if (err) {
          console.error("下载文件失败:", err);
          console.error("文件路径:", absolutePath);
          if (!res.headersSent) {
            res.status(500).json({ message: "下载文件失败" });
          }
        }
      });
    } catch (error) {
      console.error("下载文件失败:", error);
      res.status(500).json({ message: "服务器内部错误" });
    }
  });

  // 删除文件
  router.delete("/files/:fileId", protect, async (req, res) => {
    try {
      const fileId = parseInt(req.params.fileId, 10);

      // 获取文件信息
      const fileResult = await pool.query(
        `SELECT df.*, d.id as document_id, d.owner_id
         FROM document_files df
         JOIN documents d ON df.document_id = d.id
         WHERE df.id = $1`,
        [fileId]
      );

      if (fileResult.rows.length === 0) {
        return res.status(404).json({ message: "文件不存在" });
      }

      const file = fileResult.rows[0];

      // 检查权限：只有文件上传者、文档所有者或管理员可以删除
      const canDelete =
        file.uploaded_by === req.user.id ||
        file.owner_id === req.user.id ||
        req.user.role === "admin";

      if (!canDelete) {
        return res.status(403).json({ message: "无权删除该文件" });
      }

      // 删除文件
      if (fs.existsSync(file.file_path)) {
        fs.unlinkSync(file.file_path);
      }

      // 删除数据库记录
      await pool.query("DELETE FROM document_files WHERE id = $1", [fileId]);

      // 通过 Socket.IO 实时通知
      if (io) {
        io.to(String(file.document_id)).emit("fileDeleted", { fileId });
      }

      res.json({ message: "文件已删除" });
    } catch (error) {
      console.error("删除文件失败:", error);
      res.status(500).json({ message: "服务器内部错误" });
    }
  });

  return router;
};

module.exports = createFileRoutes;

