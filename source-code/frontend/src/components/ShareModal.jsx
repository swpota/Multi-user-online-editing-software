/**
 * 分享弹窗组件
 * 
 * 用于管理文档的协作者。可以搜索用户并邀请他们作为编辑者或查看者。
 * 
 * 两种协作者角色：
 * - 编辑者(editor)：可以编辑文档内容
 * - 查看者(viewer)：只能查看，不能编辑
 * 
 * 使用流程：
 * 1. 在搜索框输入邮箱搜索用户
 * 2. 点击"编辑者"或"查看者"按钮邀请
 * 3. 被邀请的用户会出现在协作者列表中
 */
import React, { useState, useEffect } from "react";
import api from "../api";
import "../styles/components/ShareModal.css";

/**
 * @param {string} documentId - 文档ID
 * @param {function} onClose - 关闭弹窗回调
 */
const ShareModal = ({ documentId, onClose }) => {
  const [collaborators, setCollaborators] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 获取当前协作者列表
  const fetchCollaborators = async () => {
    try {
      // 注意：不再需要手动处理 token 和 headers!
      const response = await api.get(`/documents/${documentId}/collaborators`);
      setCollaborators(response.data);
      setLoading(false);
    } catch (err) {
      setError("加载协作者失败");
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCollaborators();
  }, [documentId]);

  // 搜索用户
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const handler = setTimeout(async () => {
      try {
        // 注意：不再需要手动处理 token 和 headers!
        const response = await api.get(`/users/search?q=${searchQuery}`);
        setSearchResults(response.data);
      } catch (err) {
        console.error("搜索用户失败", err);
      }
    }, 500);

    return () => clearTimeout(handler);
  }, [searchQuery]);

  // 添加或更新协作者
  const handleAddCollaborator = async (user, role = "viewer") => {
    try {
      // 注意：不再需要手动处理 token 和 headers!
      await api.post(`/documents/${documentId}/collaborators`, {
        email: user.email,
        role,
      });
      fetchCollaborators();
      setSearchQuery("");
      setSearchResults([]);
    } catch (err) {
      setError(err.response?.data?.message || "添加失败");
    }
  };

  // 移除协作者
  const handleRemoveCollaborator = async (userId) => {
    try {
      // 注意：不再需要手动处理 token 和 headers!
      await api.delete(`/documents/${documentId}/collaborators/${userId}`);
      fetchCollaborators();
    } catch (err) {
      setError("移除失败");
    }
  };

  return (
    <div className="share-modal-overlay">
      <div className="share-modal-container">
        <div className="share-modal-header">
          <h2 className="share-modal-title">
            🔗 分享文档
          </h2>
          <button
            onClick={onClose}
            className="share-modal-close-btn"
          >
            ×
          </button>
        </div>
        <div className="share-modal-body">
          {error && (
            <div className="share-modal-error">
              {error}
            </div>
          )}

          {/* 搜索和添加 */}
          <div className="share-modal-search-section">
            <label className="share-modal-label">
              搜索用户
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="通过邮箱搜索用户..."
              className="share-modal-input"
            />
            {searchResults.length > 0 && (
              <ul className="share-modal-search-results">
                {searchResults.map((user) => (
                  <li key={user.id} className="share-modal-search-item">
                    <span className="share-modal-search-email">
                      {user.email}
                    </span>
                    <div className="share-modal-search-actions">
                      <button
                        onClick={() => handleAddCollaborator(user, "viewer")}
                        className="share-modal-btn-viewer"
                      >
                        查看者
                      </button>
                      <button
                        onClick={() => handleAddCollaborator(user, "editor")}
                        className="share-modal-btn-editor"
                      >
                        编辑者
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 已有协作者列表 */}
          <div className="share-modal-collaborators-section">
            <h3 className="share-modal-collaborators-title">
              已有协作者 ({collaborators.length})
            </h3>
            {loading ? (
              <div className="share-modal-loading">
                加载中...
              </div>
            ) : collaborators.length === 0 ? (
              <div className="share-modal-empty">
                暂无协作者
              </div>
            ) : (
              <ul className="share-modal-collaborators-list">
                {collaborators.map((c) => (
                  <li key={c.id} className="share-modal-collaborator-item">
                    <div className="share-modal-collaborator-info">
                      <span className="share-modal-collaborator-email">
                        {c.email}
                      </span>
                      <span
                        className={`share-modal-role-badge ${
                          c.role === "editor"
                            ? "share-modal-role-badge-editor"
                            : "share-modal-role-badge-viewer"
                        }`}
                      >
                        {c.role === "editor" ? "编辑者" : "查看者"}
                      </span>
                    </div>
                    <button
                      onClick={() => handleRemoveCollaborator(c.id)}
                      className="share-modal-remove-btn"
                    >
                      移除
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};


export default ShareModal;
