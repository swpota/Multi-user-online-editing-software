/**
 * UserManagementTab 用户管理标签页
 * 显示用户列表和角色管理功能
 * 使用 React.memo 优化性能
 */
import React, { memo } from "react";
import "../../styles/components/admin/AdminTabs.css";

function UserManagementTab({ 
  users, 
  usersLoading, 
  usersError, 
  loggedInUser, 
  onRoleChange 
}) {
  return (
    <>
      <h3 className="admin-dashboard-section-title">用户管理</h3>

      {usersLoading && (
        <div className="admin-dashboard-loading">
          <div className="admin-dashboard-loading-spinner" />
          正在加载用户...
        </div>
      )}

      {usersError && (
        <div className="admin-dashboard-error">{usersError}</div>
      )}

      {!usersLoading && !usersError && (
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
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td>
                    <img
                      src={user.avatar_url || "/default-avatar.png"}
                      alt="avatar"
                      className="admin-dashboard-avatar"
                    />
                  </td>
                  <td>{user.email}</td>
                  <td>{user.full_name || "-"}</td>
                  <td>
                    <span
                      className={`admin-dashboard-role-badge ${
                        user.role === "admin"
                          ? "admin-dashboard-role-badge-admin"
                          : "admin-dashboard-role-badge-user"
                      }`}
                    >
                      {user.role === "admin" ? "管理员" : "编辑者"}
                    </span>
                  </td>
                  <td>
                    {loggedInUser.id === user.id ? (
                      <span className="admin-dashboard-self-label">
                        （你自己）
                      </span>
                    ) : user.role === "admin" ? (
                      <button
                        onClick={() => onRoleChange(user.id, "editor")}
                        className="admin-dashboard-button admin-dashboard-button-danger"
                      >
                        降为编辑者
                      </button>
                    ) : (
                      <button
                        onClick={() => onRoleChange(user.id, "admin")}
                        className="admin-dashboard-button admin-dashboard-button-primary"
                      >
                        提升为管理员
                      </button>
                    )}
                  </td>
                  <td>
                    {new Date(user.created_at).toLocaleString("zh-CN")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!usersLoading && !usersError && users.length === 0 && (
        <div className="admin-dashboard-empty">暂无用户数据</div>
      )}
    </>
  );
}

// 使用 React.memo 优化，仅在 props 变化时重渲染
export default memo(UserManagementTab);
