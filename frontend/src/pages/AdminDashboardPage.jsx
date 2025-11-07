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
      // 更新前端 state 中的用户列表，以立即反映变化
      setUsers(
        users.map((user) => (user.id === userId ? response.data : user))
      );
    } catch (err) {
      alert("更新角色失败: " + (err.response?.data?.message || "未知错误"));
    }
  };

  return (
    <div style={{ padding: "2rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h2>后台管理面板</h2>
        <Link to="/" className="button-like">
          返回仪表盘
        </Link>
      </div>

      <hr style={{ margin: "2rem 0" }} />

      <h3>用户管理</h3>
      {loading && <p>正在加载用户...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {!loading && !error && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid black" }}>
              <th style={styles.th}>ID</th>
              <th style={styles.th}>头像</th>
              <th style={styles.th}>邮箱</th>
              <th style={styles.th}>当前角色</th>
              <th style={styles.th}>操作</th>
              <th style={styles.th}>注册时间</th>
            </tr>
          </thead>
          <tbody>
            {/* 2. (核心修复) 在 map 循环中，增加对自己身份的判断 */}
            {users.map(
              (
                userInList // 使用 userInList 以区别于 loggedInUser
              ) => (
                <tr
                  key={userInList.id}
                  style={{ borderBottom: "1px solid #ccc" }}
                >
                  <td style={styles.td}>{userInList.id}</td>
                  <td style={styles.td}>
                    <img
                      src={userInList.avatar_url || "/default-avatar.png"}
                      alt="avatar"
                      style={{
                        width: "40px",
                        height: "40px",
                        borderRadius: "50%",
                      }}
                    />
                  </td>
                  <td style={styles.td}>{userInList.email}</td>
                  <td style={styles.td}>{userInList.role}</td>
                  <td style={styles.td}>
                    {/* --- 3. (核心修复) 只有当列表中的用户不是当前登录的管理员时，才显示按钮 --- */}
                    {loggedInUser.id === userInList.id ? (
                      <span style={{ color: "#888" }}>（你自己）</span>
                    ) : // 如果是其他用户，则正常显示按钮
                    userInList.role === "admin" ? (
                      <button
                        onClick={() =>
                          handleRoleChange(userInList.id, "editor")
                        }
                      >
                        降为 Editor
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRoleChange(userInList.id, "admin")}
                      >
                        提升为 Admin
                      </button>
                    )}
                  </td>
                  <td style={styles.td}>
                    {new Date(userInList.created_at).toLocaleString()}
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      )}
    </div>
  );
};

const styles = {
  th: { textAlign: "left", padding: "12px" },
  td: { padding: "12px" },
};

export default AdminDashboardPage;
