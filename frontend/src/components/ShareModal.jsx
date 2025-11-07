import React, { useState, useEffect } from "react";
import api from "../api";

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
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <button onClick={onClose} style={styles.closeButton}>
          &times;
        </button>
        <h2>分享文档</h2>
        {error && <p style={{ color: "red" }}>{error}</p>}

        {/* 搜索和添加 */}
        <div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="通过邮箱搜索用户..."
            style={styles.input}
          />
          {searchResults.length > 0 && (
            <ul style={styles.searchResults}>
              {searchResults.map((user) => (
                <li key={user.id} style={styles.searchResultItem}>
                  <span>{user.email}</span>
                  <button
                    onClick={() => handleAddCollaborator(user, "viewer")}
                    style={styles.actionButton}
                  >
                    添加为查看者
                  </button>
                  <button
                    onClick={() => handleAddCollaborator(user, "editor")}
                    style={styles.actionButton}
                  >
                    添加为编辑者
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 已有协作者列表 */}
        <h3 style={{ marginTop: "20px" }}>已有协作者</h3>
        {loading ? (
          <p>加载中...</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {collaborators.map((c) => (
              <li key={c.id} style={styles.collaboratorItem}>
                <span>
                  {c.email} ({c.role})
                </span>
                <button
                  onClick={() => handleRemoveCollaborator(c.id)}
                  style={styles.removeButton}
                >
                  移除
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

// 为方便起见，将样式直接写在这里
const styles = {
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  modal: {
    background: "white",
    padding: "20px 40px",
    borderRadius: "8px",
    width: "500px",
    position: "relative",
  },
  closeButton: {
    position: "absolute",
    top: "10px",
    right: "10px",
    background: "none",
    border: "none",
    fontSize: "1.5em",
    cursor: "pointer",
  },
  input: { width: "100%", padding: "8px", boxSizing: "border-box" },
  searchResults: {
    border: "1px solid #ccc",
    listStyle: "none",
    padding: 0,
    margin: 0,
  },
  searchResultItem: {
    display: "flex",
    justifyContent: "space-between",
    padding: "8px",
    borderBottom: "1px solid #eee",
  },
  collaboratorItem: {
    display: "flex",
    justifyContent: "space-between",
    padding: "8px",
    borderBottom: "1px solid #eee",
  },
  actionButton: { marginLeft: "10px", cursor: "pointer" },
  removeButton: {
    background: "#f44336",
    color: "white",
    border: "none",
    padding: "4px 8px",
    borderRadius: "4px",
    cursor: "pointer",
  },
};

export default ShareModal;
