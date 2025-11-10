import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import "../styles/pages/AdminDashboardPage.css";

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
    <div className="admin-dashboard-page">
      <div className="admin-dashboard-container">
        {/* 头部 */}
        <div className="admin-dashboard-header">
          <div className="admin-dashboard-header-left">
            <h2 className="admin-dashboard-title">
              🔐 后台管理面板
            </h2>
            <p className="admin-dashboard-subtitle">
              管理系统用户和权限
            </p>
          </div>
          <Link
            to="/"
            className="admin-dashboard-back-link"
          >
            ← 返回仪表盘
          </Link>
        </div>

        {/* 内容区域 */}
        <div className="admin-dashboard-content">
          <h3 className="admin-dashboard-section-title">
            用户管理
          </h3>

          {loading && (
            <div className="admin-dashboard-loading">
              <div className="admin-dashboard-loading-spinner" />
              正在加载用户...
            </div>
          )}

          {error && (
            <div className="admin-dashboard-error">
              {error}
            </div>
          )}

          {!loading && !error && (
            <div className="admin-dashboard-table-wrapper">
              <table className="admin-dashboard-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>头像</th>
                    <th>邮箱</th>
                    <th>姓名</th>
                    <th>当前角色</th>
                    <th>操作</th>
                    <th>注册时间</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((userInList) => (
                    <tr key={userInList.id}>
                      <td>{userInList.id}</td>
                      <td>
                        <img
                          src={userInList.avatar_url || "/default-avatar.png"}
                          alt="avatar"
                          className="admin-dashboard-avatar"
                        />
                      </td>
                      <td>{userInList.email}</td>
                      <td>{userInList.full_name || "-"}</td>
                      <td>
                        <span
                          className={`admin-dashboard-role-badge ${
                            userInList.role === "admin"
                              ? "admin-dashboard-role-badge-admin"
                              : "admin-dashboard-role-badge-user"
                          }`}
                          style={{
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
                      <td>
                        {loggedInUser.id === userInList.id ? (
                          <span className="admin-dashboard-self-label">
                            （你自己）
                          </span>
                        ) : userInList.role === "admin" ? (
                          <button
                            onClick={() =>
                              handleRoleChange(userInList.id, "editor")
                            }
                            className="admin-dashboard-button admin-dashboard-button-danger"
                          >
                            降为编辑者
                          </button>
                        ) : (
                          <button
                            onClick={() =>
                              handleRoleChange(userInList.id, "admin")
                            }
                            className="admin-dashboard-button admin-dashboard-button-primary"
                          >
                            提升为管理员
                          </button>
                        )}
                      </td>
                      <td>
                        {new Date(userInList.created_at).toLocaleString("zh-CN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && !error && users.length === 0 && (
            <div className="admin-dashboard-empty">
              暂无用户数据
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardPage;
