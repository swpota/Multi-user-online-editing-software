import React, { useState, useEffect, lazy, Suspense } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import api from "./api";
import logo from "./assets/logo.png";
import { ToastProvider } from "./components/ToastContainer";
import Loading from "./components/common/Loading";

import "./styles/App.css";

// ==================== 代码分割 ====================

// 立即加载的组件（小型、关键）
import Register from "./components/Register";
import Login from "./components/Login";

// 懒加载的页面组件（大型、非关键）
const Dashboard = lazy(() => import("./components/DashBoard"));
const EditorPage = lazy(() => import("./pages/EditorPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const AdminDashboardPage = lazy(() => import("./pages/AdminDashboardPage"));
const LandingPage = lazy(() => import("./pages/LandingPage"));

// ==================== 主应用 ====================

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
    localStorage.removeItem("authToken");
    return <Navigate to="/" replace />;
  };

  if (loading) {
    return <Loading fullScreen text="正在加载应用..." />;
  }

  return (
    <ToastProvider>
      <Router>
        <AppContent user={user} setUser={setUser} handleLogout={handleLogout} />
      </Router>
    </ToastProvider>
  );
}

function AppContent({ user, setUser, handleLogout }) {
  const location = useLocation();
  
  // 认证相关页面不显示header
  const authPages = ["/", "/login", "/register", "/forgot-password", "/reset-password"];
  const isAuthPage = authPages.some(page => 
    location.pathname === page || location.pathname.startsWith(page + "/")
  ) && !user;

  return (
    <div className="App">
      {!isAuthPage && (
        <header className="App-header">
          <div className="app-header-left">
            <h1
              className="app-header-title"
              onClick={() => window.location.href = "/"}
            >
              <img src={logo} alt="MindFlow" className="app-header-logo" />
              <span className="app-header-title-text">
                <span className="app-logo-text-m">M</span>ind
                <span className="app-logo-text-f">F</span>low
              </span>
            </h1>
          </div>
          {user && (
            <div className="app-header-right">
              <span className="app-user-welcome">
                欢迎, {user.username}
              </span>
              <button
                onClick={handleLogout}
                className="app-header-logout-button"
              >
                登出
              </button>
            </div>
          )}
        </header>
      )}

      <main className="App-main">
        {/* 使用 Suspense 包裹懒加载的路由 */}
        <Suspense fallback={<Loading fullScreen text="页面加载中..." />}>
          <Routes>
            {/* 公开路由 */}
            <Route
              path="/"
              element={
                user ? (
                  <Navigate to="/dashboard" replace />
                ) : (
                  <LandingPage />
                )
              }
            />
            <Route
              path="/login"
              element={
                user ? (
                  <Navigate to="/dashboard" replace />
                ) : (
                  <Login setUser={setUser} />
                )
              }
            />
            <Route
              path="/register"
              element={
                user ? (
                  <Navigate to="/dashboard" replace />
                ) : (
                  <Register setUser={setUser} />
                )
              }
            />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route
              path="/reset-password/:token"
              element={<ResetPasswordPage />}
            />

            {/* 需要认证的路由 */}
            <Route
              path="/dashboard"
              element={
                user ? (
                  <Dashboard user={user} />
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />
            <Route
              path="/editor/:documentId"
              element={
                user ? (
                  <EditorPage user={user} />
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />
            <Route
              path="/profile"
              element={
                user ? (
                  <ProfilePage user={user} setUser={setUser} />
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />
            <Route
              path="/admin"
              element={
                user && user.role === "admin" ? (
                  <AdminDashboardPage user={user} />
                ) : (
                  <Navigate to="/dashboard" replace />
                )
              }
            />

            {/* 404 路由 */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}

export default App;
