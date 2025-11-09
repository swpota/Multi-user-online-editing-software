import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import api from "./api";

// 组件和页面
import Register from "./components/Register";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import EditorPage from "./pages/EditorPage";
import ProfilePage from "./pages/ProfilePage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";

import "./App.css";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const validateToken = async () => {
      const token = localStorage.getItem("authToken");
      if (token) {
        try {
          const response = await api.get("/users/profile");
          setUser(response.data.user);
        } catch (error) {
          console.error("Token validation failed:", error);
          localStorage.removeItem("authToken");
        }
      }
      setLoading(false);
    };
    validateToken();
  }, []);

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("authToken"); // 3. 登出时，只需要清除 token 和 user state
    // 不再需要操作 axios.defaults，因为 api 实例的拦截器会自动处理
    return <Navigate to="/" replace />;
  };

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          backgroundColor: "#f5f5f5",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: "50px",
              height: "50px",
              border: "4px solid #f3f3f3",
              borderTop: "4px solid #1890ff",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 16px",
            }}
          />
          <p style={{ color: "#666", fontSize: "14px" }}>正在加载应用...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="App" style={{ minHeight: "100vh", backgroundColor: "#f5f5f5" }}>
        <header
          className="App-header"
          style={{
            backgroundColor: "#fff",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            padding: "0 24px",
            height: "64px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "sticky",
            top: 0,
            zIndex: 1000,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <h1
              style={{
                margin: 0,
                fontSize: "20px",
                fontWeight: 600,
                color: "#1890ff",
                cursor: "pointer",
              }}
              onClick={() => window.location.href = "/"}
            >
              📝 协作文档
            </h1>
          </div>
          {user && (
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              {user.role === "admin" && (
                <a
                  href="/admin"
                  style={{
                    padding: "6px 12px",
                    color: "#1890ff",
                    textDecoration: "none",
                    fontSize: "14px",
                    borderRadius: "4px",
                    transition: "background-color 0.2s",
                  }}
                  onMouseEnter={(e) => (e.target.style.backgroundColor = "#e6f7ff")}
                  onMouseLeave={(e) => (e.target.style.backgroundColor = "transparent")}
                >
                  管理后台
                </a>
              )}
              <a
                href="/profile"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  textDecoration: "none",
                  color: "#333",
                  fontSize: "14px",
                  padding: "4px 8px",
                  borderRadius: "4px",
                  transition: "background-color 0.2s",
                }}
                onMouseEnter={(e) => (e.target.style.backgroundColor = "#f5f5f5")}
                onMouseLeave={(e) => (e.target.style.backgroundColor = "transparent")}
              >
                <img
                  src={user.avatar_url || "/default-avatar.png"}
                  alt={user.full_name || user.email}
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    objectFit: "cover",
                    border: "2px solid #e8e8e8",
                  }}
                />
                <span>{user.full_name || user.email}</span>
              </a>
              <button
                onClick={() => {
                  handleLogout();
                  window.location.href = "/";
                }}
                style={{
                  padding: "6px 16px",
                  backgroundColor: "transparent",
                  border: "1px solid #d9d9d9",
                  borderRadius: "4px",
                  color: "#666",
                  cursor: "pointer",
                  fontSize: "14px",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.target.style.borderColor = "#ff4d4f";
                  e.target.style.color = "#ff4d4f";
                }}
                onMouseLeave={(e) => {
                  e.target.style.borderColor = "#d9d9d9";
                  e.target.style.color = "#666";
                }}
              >
                退出登录
              </button>
            </div>
          )}
        </header>
        <main style={{ minHeight: "calc(100vh - 64px)" }}>
          <Routes>
            <Route
              path="/"
              element={
                user ? (
                  <Dashboard user={user} />
                ) : (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      minHeight: "calc(100vh - 64px)",
                      padding: "40px 20px",
                      backgroundColor: "#f5f5f5",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        maxWidth: "1000px",
                        width: "100%",
                        gap: "40px",
                        backgroundColor: "#fff",
                        borderRadius: "8px",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          flex: 1,
                          padding: "40px",
                          borderRight: "1px solid #e8e8e8",
                        }}
                      >
                        <Register />
                      </div>
                      <div
                        style={{
                          flex: 1,
                          padding: "40px",
                        }}
                      >
                        <Login
                          onLoginSuccess={(loggedInUser) => setUser(loggedInUser)}
                        />
                      </div>
                    </div>
                  </div>
                )
              }
            />

            {/* --- (新增) 添加忘记密码页面的路由 --- */}
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />

            {/* --- (新增) 添加重置密码页面的【动态路由】 --- */}
            {/* ':token' 是一个占位符，可以匹配任何字符串 */}
            <Route
              path="/reset-password/:token"
              element={<ResetPasswordPage />}
            />

            <Route
              path="/documents/:documentId"
              element={user ? <EditorPage user={user} /> : <Navigate to="/" />}
            />
            <Route
              path="/profile" // <-- 新增路由
              element={
                user ? (
                  <ProfilePage user={user} setUser={setUser} />
                ) : (
                  <Navigate to="/" />
                )
              }
            />
            {/* --- (新增) 管理员专属路由 --- */}
            <Route
              path="/admin"
              element={
                // 只有当用户存在且角色为 'admin' 时，才渲染该页面
                user && user.role === "admin" ? (
                  <AdminDashboardPage user={user} />
                ) : (
                  // 否则重定向回主页
                  <Navigate to="/" />
                )
              }
            />
            {/* 如果访问任何其他不存在的页面，则重定向回主页 */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
