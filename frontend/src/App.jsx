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

import "./styles/App.css";

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
      <div className="app-loading">
        <div className="app-loading-content">
          <div className="app-loading-spinner" />
          <p className="app-loading-text">正在加载应用...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="App">
        <header className="App-header">
          <div className="app-header-left">
            <h1
              className="app-header-title"
              onClick={() => window.location.href = "/"}
            >
              📝 协作文档
            </h1>
          </div>
          {user && (
            <div className="app-header-right">
              {user.role === "admin" && (
                <a href="/admin" className="app-header-link">
                  管理后台
                </a>
              )}
              <a href="/profile" className="app-header-profile-link">
                <img
                  src={user.avatar_url || "/default-avatar.png"}
                  alt={user.full_name || user.email}
                  className="app-header-avatar"
                />
                <span>{user.full_name || user.email}</span>
              </a>
              <button
                onClick={() => {
                  handleLogout();
                  window.location.href = "/";
                }}
                className="app-header-logout-btn"
              >
                退出登录
              </button>
            </div>
          )}
        </header>
        <main className="app-main">
          <Routes>
            <Route
              path="/"
              element={
                user ? (
                  <Dashboard user={user} />
                ) : (
                  <div className="app-auth-container">
                    <div className="app-auth-wrapper">
                      <div className="app-auth-section">
                        <Login
                          onLoginSuccess={(loggedInUser) => setUser(loggedInUser)}
                        />
                      </div>
                    </div>
                  </div>
                )
              }
            />

            {/* --- (新增) 添加注册页面的路由 --- */}
            <Route
              path="/register"
              element={
                user ? (
                  <Navigate to="/" />
                ) : (
                  <div className="app-auth-container">
                    <div className="app-auth-wrapper">
                      <div className="app-auth-section">
                        <Register />
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
