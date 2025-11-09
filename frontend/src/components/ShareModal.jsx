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
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.45)",
        backdropFilter: "blur(4px)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: "8px",
          width: "100%",
          maxWidth: "600px",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 4px 24px rgba(0,0,0,0.2)",
          position: "relative",
        }}
      >
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid #e8e8e8",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: "20px",
              fontWeight: 600,
              color: "#333",
            }}
          >
            🔗 分享文档
          </h2>
          <button
            onClick={onClose}
            style={{
              padding: "6px 12px",
              border: "none",
              backgroundColor: "transparent",
              cursor: "pointer",
              fontSize: "24px",
              color: "#666",
              borderRadius: "4px",
              transition: "all 0.2s",
              lineHeight: "1",
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = "#f5f5f5";
              e.target.style.color = "#ff4d4f";
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = "transparent";
              e.target.style.color = "#666";
            }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: "24px", overflowY: "auto" }}>
          {error && (
            <div
              style={{
                padding: "12px 16px",
                marginBottom: "16px",
                backgroundColor: "#fff2e8",
                color: "#fa8c16",
                borderRadius: "6px",
                fontSize: "14px",
                border: "1px solid #ffd591",
              }}
            >
              {error}
            </div>
          )}

          {/* 搜索和添加 */}
          <div style={{ marginBottom: "24px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontSize: "14px",
                fontWeight: 500,
                color: "#333",
              }}
            >
              搜索用户
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="通过邮箱搜索用户..."
              style={{
                width: "100%",
                padding: "10px 12px",
                fontSize: "14px",
                border: "1px solid #d9d9d9",
                borderRadius: "6px",
                transition: "all 0.2s",
                outline: "none",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "#1890ff";
                e.target.style.boxShadow = "0 0 0 2px rgba(24, 144, 255, 0.2)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#d9d9d9";
                e.target.style.boxShadow = "none";
              }}
            />
            {searchResults.length > 0 && (
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  marginTop: "12px",
                  border: "1px solid #e8e8e8",
                  borderRadius: "6px",
                  backgroundColor: "#fafafa",
                  maxHeight: "200px",
                  overflowY: "auto",
                }}
              >
                {searchResults.map((user) => (
                  <li
                    key={user.id}
                    style={{
                      padding: "12px 16px",
                      borderBottom: "1px solid #e8e8e8",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontSize: "14px", color: "#333" }}>
                      {user.email}
                    </span>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        onClick={() => handleAddCollaborator(user, "viewer")}
                        style={{
                          padding: "6px 12px",
                          backgroundColor: "#fff",
                          border: "1px solid #d9d9d9",
                          borderRadius: "6px",
                          color: "#333",
                          cursor: "pointer",
                          fontSize: "12px",
                          transition: "all 0.2s",
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.borderColor = "#1890ff";
                          e.target.style.color = "#1890ff";
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.borderColor = "#d9d9d9";
                          e.target.style.color = "#333";
                        }}
                      >
                        查看者
                      </button>
                      <button
                        onClick={() => handleAddCollaborator(user, "editor")}
                        style={{
                          padding: "6px 12px",
                          backgroundColor: "#1890ff",
                          border: "none",
                          borderRadius: "6px",
                          color: "#fff",
                          cursor: "pointer",
                          fontSize: "12px",
                          transition: "all 0.2s",
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = "#40a9ff";
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = "#1890ff";
                        }}
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
          <div>
            <h3
              style={{
                margin: "0 0 16px 0",
                fontSize: "16px",
                fontWeight: 600,
                color: "#333",
              }}
            >
              已有协作者 ({collaborators.length})
            </h3>
            {loading ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px",
                  color: "#666",
                  fontSize: "14px",
                }}
              >
                加载中...
              </div>
            ) : collaborators.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px",
                  color: "#999",
                  fontSize: "14px",
                }}
              >
                暂无协作者
              </div>
            ) : (
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                }}
              >
                {collaborators.map((c) => (
                  <li
                    key={c.id}
                    style={{
                      padding: "12px 16px",
                      border: "1px solid #e8e8e8",
                      borderRadius: "6px",
                      marginBottom: "8px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      backgroundColor: "#fafafa",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#f0f0f0";
                      e.currentTarget.style.borderColor = "#d9d9d9";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "#fafafa";
                      e.currentTarget.style.borderColor = "#e8e8e8";
                    }}
                  >
                    <div>
                      <span style={{ fontSize: "14px", color: "#333", fontWeight: 500 }}>
                        {c.email}
                      </span>
                      <span
                        style={{
                          marginLeft: "8px",
                          padding: "2px 8px",
                          backgroundColor:
                            c.role === "editor" ? "#e6f7ff" : "#f6ffed",
                          color: c.role === "editor" ? "#1890ff" : "#52c41a",
                          borderRadius: "4px",
                          fontSize: "12px",
                          fontWeight: 500,
                        }}
                      >
                        {c.role === "editor" ? "编辑者" : "查看者"}
                      </span>
                    </div>
                    <button
                      onClick={() => handleRemoveCollaborator(c.id)}
                      style={{
                        padding: "6px 12px",
                        backgroundColor: "#fff",
                        border: "1px solid #ff4d4f",
                        borderRadius: "6px",
                        color: "#ff4d4f",
                        cursor: "pointer",
                        fontSize: "12px",
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.backgroundColor = "#ff4d4f";
                        e.target.style.color = "#fff";
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = "#fff";
                        e.target.style.color = "#ff4d4f";
                      }}
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

// 保留旧的styles对象以避免错误（虽然不再使用）
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
