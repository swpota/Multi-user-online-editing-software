import React, { useState, useEffect, useRef } from "react";
import api from "../api";
import "../styles/components/FilePanel.css";

const FilePanel = ({ documentId, user, socket, onClose }) => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [fileDescription, setFileDescription] = useState("");
  const fileInputRef = useRef(null);

  // 获取文件列表
  const fetchFiles = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/documents/${documentId}/files`);
      setFiles(response.data || []);
    } catch (error) {
      console.error("获取文件列表失败", error);
    } finally {
      setLoading(false);
    }
  };

  // 上传文件
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", file);
      if (fileDescription.trim()) {
        formData.append("description", fileDescription.trim());
      }

      await api.post(`/documents/${documentId}/files`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      setFileDescription("");
      setShowUploadForm(false);
      // 文件会通过 Socket.IO 实时更新
    } catch (error) {
      console.error("上传文件失败", error);
      alert(error.response?.data?.message || "上传文件失败");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // 下载文件
  const downloadFile = (fileId, fileName) => {
    window.open(`/api/files/${fileId}/download`, "_blank");
  };

  // 删除文件
  const deleteFile = async (fileId) => {
    if (!window.confirm("确定要删除这个文件吗？")) return;

    try {
      await api.delete(`/files/${fileId}`);
      // 文件删除会通过 Socket.IO 实时更新
    } catch (error) {
      console.error("删除文件失败", error);
      alert(error.response?.data?.message || "删除文件失败");
    }
  };

  // 格式化文件大小
  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  // 格式化时间
  const formatTime = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // 获取文件图标
  const getFileIcon = (fileType, mimeType) => {
    if (mimeType) {
      if (mimeType.startsWith("image/")) return "🖼️";
      if (mimeType.startsWith("video/")) return "🎥";
      if (mimeType.startsWith("audio/")) return "🎵";
      if (mimeType.includes("pdf")) return "📄";
      if (mimeType.includes("word")) return "📝";
      if (mimeType.includes("excel") || mimeType.includes("spreadsheet")) return "📊";
      if (mimeType.includes("powerpoint") || mimeType.includes("presentation")) return "📽️";
      if (mimeType.includes("zip") || mimeType.includes("rar")) return "📦";
    }
    if (fileType) {
      if (fileType === ".pdf") return "📄";
      if (fileType === ".doc" || fileType === ".docx") return "📝";
      if (fileType === ".xls" || fileType === ".xlsx") return "📊";
      if (fileType === ".ppt" || fileType === ".pptx") return "📽️";
      if (fileType === ".jpg" || fileType === ".jpeg" || fileType === ".png" || fileType === ".gif") return "🖼️";
      if (fileType === ".mp4" || fileType === ".avi" || fileType === ".mov") return "🎥";
      if (fileType === ".mp3" || fileType === ".wav") return "🎵";
      if (fileType === ".zip" || fileType === ".rar") return "📦";
    }
    return "📎";
  };

  // 获取用户显示名称
  const getUserDisplayName = (userObj) => {
    return userObj?.full_name || userObj?.email || `用户${userObj?.id}`;
  };

  // 检查是否可以删除文件
  const canDeleteFile = (file) => {
    return (
      file.uploaded_by === user.id ||
      user.role === "admin"
    );
  };

  useEffect(() => {
    fetchFiles();

    // 监听 Socket.IO 事件
    if (socket) {
      const handleNewFile = (file) => {
        setFiles((prev) => {
          // 检查文件是否已存在
          if (prev.some((f) => f.id === file.id)) {
            return prev;
          }
          return [file, ...prev];
        });
      };

      const handleFileDeleted = (data) => {
        setFiles((prev) => prev.filter((f) => f.id !== data.fileId));
      };

      socket.on("newFileUploaded", handleNewFile);
      socket.on("fileDeleted", handleFileDeleted);

      return () => {
        socket.off("newFileUploaded", handleNewFile);
        socket.off("fileDeleted", handleFileDeleted);
      };
    }
  }, [socket, documentId]);

  return (
    <div className="file-panel">
      {/* 头部 */}
      <div className="file-panel-header">
        <h3 className="file-panel-title">
          📁 文件共享
        </h3>
        <div className="file-panel-header-actions">
          <button
            onClick={() => setShowUploadForm(!showUploadForm)}
            className={`file-panel-upload-btn ${showUploadForm ? "file-panel-upload-btn-active" : ""}`}
          >
            {showUploadForm ? "取消" : "上传"}
          </button>
          <button
            onClick={onClose}
            className="file-panel-close-btn"
          >
            ×
          </button>
        </div>
      </div>

      {/* 上传表单 */}
      {showUploadForm && (
        <div className="file-panel-upload-form">
          <div className="file-panel-upload-group">
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileUpload}
              disabled={uploading}
              className="file-panel-file-input"
            />
          </div>
          <div className="file-panel-upload-group">
            <textarea
              value={fileDescription}
              onChange={(e) => setFileDescription(e.target.value)}
              placeholder="文件描述（可选）"
              disabled={uploading}
              className="file-panel-description-textarea"
            />
          </div>
          {uploading && (
            <div className="file-panel-uploading">
              上传中...
            </div>
          )}
        </div>
      )}

      {/* 文件列表 */}
      <div className="file-panel-body">
        {loading ? (
          <div className="file-panel-loading">
            加载中...
          </div>
        ) : files.length === 0 ? (
          <div className="file-panel-empty">
            暂无文件
          </div>
        ) : (
          files.map((file) => (
            <div key={file.id} className="file-panel-item">
              <div className="file-panel-item-content">
                {/* 文件图标 */}
                <div className="file-panel-item-icon">
                  {getFileIcon(file.file_type, file.mime_type)}
                </div>

                {/* 文件信息 */}
                <div className="file-panel-item-info">
                  <div
                    className="file-panel-item-name"
                    title={file.original_name}
                  >
                    {file.original_name}
                  </div>
                  {file.description && (
                    <div className="file-panel-item-description">
                      {file.description}
                    </div>
                  )}
                  <div className="file-panel-item-meta">
                    {formatFileSize(file.file_size)} · 上传于 {formatTime(file.created_at)} ·{" "}
                    {getUserDisplayName(file.uploaded_by_user)}
                  </div>
                  <div className="file-panel-item-actions">
                    <button
                      onClick={() => downloadFile(file.id, file.original_name)}
                      className="file-panel-download-btn"
                    >
                      下载
                    </button>
                    {canDeleteFile(file) && (
                      <button
                        onClick={() => deleteFile(file.id)}
                        className="file-panel-delete-btn"
                      >
                        删除
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default FilePanel;

