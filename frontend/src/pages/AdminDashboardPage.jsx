import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../api";

const AdminDashboardPage = ({ user: loggedInUser }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get("/admin/users");
      setUsers(response.data);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "获取用户列表失败");
      console.error("获取用户列表失败:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (userId, newRole) => {
    if (!window.confirm(`你确定要将该用户的角色更改为 "${newRole}" 吗？`)) {
      return;
    }
    try {
      const response = await api.put(`/admin/users/${userId}/role`, {
        role: newRole,
      });
      setUsers(
        users.map((user) => (user.id === userId ? response.data : user))
      );
    } catch (err) {
      alert("更新角色失败: " + (err.response?.data?.message || "未知错误"));
    }
  };

  return (
    <div
      style={{
        minHeight: "calc(100vh - 64px)",
        backgroundColor: "#f5f5f5",
        padding: "24px",
      }}
    >
      <div
        style={{
          maxWidth: "1400px",
          margin: "0 auto",
          backgroundColor: "#fff",
          borderRadius: "8px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          overflow: "hidden",
        }}
      >
        {/* 头部 */}
        <div
          style={{
            padding: "24px",
            borderBottom: "1px solid #e8e8e8",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: "24px",
                fontWeight: 600,
                color: "#333",
                marginBottom: "8px",
              }}
            >
              🔐 后台管理面板
            </h2>
            <p
              style={{
                margin: 0,
                color: "#666",
                fontSize: "14px",
              }}
            >
              管理系统用户和权限
            </p>
          </div>
          <Link
            to="/"
            style={{
              padding: "8px 16px",
              backgroundColor: "#fff",
              border: "1px solid #d9d9d9",
              borderRadius: "6px",
              textDecoration: "none",
              color: "#333",
              fontSize: "14px",
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
            ← 返回仪表盘
          </Link>
        </div>

        {/* 内容区域 */}
        <div style={{ padding: "24px" }}>
          <h3
            style={{
              margin: "0 0 20px 0",
              fontSize: "18px",
              fontWeight: 600,
              color: "#333",
            }}
          >
            用户管理
          </h3>

          {loading && (
            <div
              style={{
                textAlign: "center",
                padding: "40px",
                color: "#666",
                fontSize: "14px",
              }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  border: "4px solid #f3f3f3",
                  borderTop: "4px solid #1890ff",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                  margin: "0 auto 16px",
                }}
              />
              正在加载用户...
            </div>
          )}

          {error && (
            <div
              style={{
                padding: "12px 16px",
                marginBottom: "20px",
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

          {!loading && !error && (
            <div
              style={{
                overflowX: "auto",
                border: "1px solid #e8e8e8",
                borderRadius: "6px",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  minWidth: "800px",
                }}
              >
                <thead>
                  <tr
                    style={{
                      backgroundColor: "#fafafa",
                      borderBottom: "2px solid #e8e8e8",
                    }}
                  >
                    <th
                      style={{
                        textAlign: "left",
                        padding: "12px 16px",
                        fontSize: "14px",
                        fontWeight: 600,
                        color: "#333",
                      }}
                    >
                      ID
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "12px 16px",
                        fontSize: "14px",
                        fontWeight: 600,
                        color: "#333",
                      }}
                    >
                      头像
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "12px 16px",
                        fontSize: "14px",
                        fontWeight: 600,
                        color: "#333",
                      }}
                    >
                      邮箱
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "12px 16px",
                        fontSize: "14px",
                        fontWeight: 600,
                        color: "#333",
                      }}
                    >
                      姓名
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "12px 16px",
                        fontSize: "14px",
                        fontWeight: 600,
                        color: "#333",
                      }}
                    >
                      当前角色
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "12px 16px",
                        fontSize: "14px",
                        fontWeight: 600,
                        color: "#333",
                      }}
                    >
                      操作
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "12px 16px",
                        fontSize: "14px",
                        fontWeight: 600,
                        color: "#333",
                      }}
                    >
                      注册时间
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((userInList) => (
                    <tr
                      key={userInList.id}
                      style={{
                        borderBottom: "1px solid #e8e8e8",
                        transition: "background-color 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#fafafa";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "#fff";
                      }}
                    >
                      <td
                        style={{
                          padding: "12px 16px",
                          fontSize: "14px",
                          color: "#666",
                        }}
                      >
                        {userInList.id}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <img
                          src={userInList.avatar_url || "/default-avatar.png"}
                          alt="avatar"
                          style={{
                            width: "40px",
                            height: "40px",
                            borderRadius: "50%",
                            objectFit: "cover",
                            border: "2px solid #e8e8e8",
                          }}
                        />
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          fontSize: "14px",
                          color: "#333",
                        }}
                      >
                        {userInList.email}
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          fontSize: "14px",
                          color: "#333",
                        }}
                      >
                        {userInList.full_name || "-"}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span
                          style={{
                            padding: "4px 12px",
                            borderRadius: "4px",
                            fontSize: "12px",
                            fontWeight: 500,
                            backgroundColor:
                              userInList.role === "admin"
                                ? "#fff7e6"
                                : "#e6f7ff",
                            color:
                              userInList.role === "admin"
                                ? "#d46b08"
                                : "#1890ff",
                            border: `1px solid ${
                              userInList.role === "admin"
                                ? "#ffd591"
                                : "#91d5ff"
                            }`,
                          }}
                        >
                          {userInList.role === "admin" ? "管理员" : "编辑者"}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        {loggedInUser.id === userInList.id ? (
                          <span
                            style={{
                              color: "#999",
                              fontSize: "14px",
                              fontStyle: "italic",
                            }}
                          >
                            （你自己）
                          </span>
                        ) : userInList.role === "admin" ? (
                          <button
                            onClick={() =>
                              handleRoleChange(userInList.id, "editor")
                            }
                            style={{
                              padding: "6px 16px",
                              backgroundColor: "#fff",
                              border: "1px solid #d9d9d9",
                              borderRadius: "6px",
                              color: "#333",
                              cursor: "pointer",
                              fontSize: "14px",
                              fontWeight: 500,
                              transition: "all 0.2s",
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.borderColor = "#ff4d4f";
                              e.target.style.color = "#ff4d4f";
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.borderColor = "#d9d9d9";
                              e.target.style.color = "#333";
                            }}
                          >
                            降为编辑者
                          </button>
                        ) : (
                          <button
                            onClick={() =>
                              handleRoleChange(userInList.id, "admin")
                            }
                            style={{
                              padding: "6px 16px",
                              backgroundColor: "#1890ff",
                              border: "none",
                              borderRadius: "6px",
                              color: "#fff",
                              cursor: "pointer",
                              fontSize: "14px",
                              fontWeight: 500,
                              transition: "all 0.2s",
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.backgroundColor = "#40a9ff";
                              e.target.style.transform = "translateY(-1px)";
                              e.target.style.boxShadow =
                                "0 4px 12px rgba(24, 144, 255, 0.3)";
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.backgroundColor = "#1890ff";
                              e.target.style.transform = "translateY(0)";
                              e.target.style.boxShadow = "none";
                            }}
                          >
                            提升为管理员
                          </button>
                        )}
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          fontSize: "14px",
                          color: "#666",
                        }}
                      >
                        {new Date(userInList.created_at).toLocaleString("zh-CN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && !error && users.length === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: "40px",
                color: "#999",
                fontSize: "14px",
              }}
            >
              暂无用户数据
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardPage;
