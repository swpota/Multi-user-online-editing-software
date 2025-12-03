import React, { useState, useEffect, lazy, Suspense } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import api from "./api";
import logo from "./assets/logo.svg";
import LazyImage from "./components/common/LazyImage";

// 小型组件和页面（直接导入）
import Register from "./components/Register";
import Login from "./components/Login";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import LandingPage from "./pages/LandingPage";
import { ToastProvider } from "./components/ToastContainer";
import LoadingSpinner from "./components/common/LoadingSpinner";
import ErrorBoundary from "./components/common/ErrorBoundary";
import PWAInstallPrompt from "./components/common/PWAInstallPrompt";
import PerformancePanel from "./components/common/PerformancePanel";

// 大型页面组件（懒加载）
const Dashboard = lazy(() => import("./components/DashBoard"));
const EditorPage = lazy(() => import("./pages/EditorPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const AdminDashboardPage = lazy(() => import("./pages/AdminDashboardPage"));

// import "./styles/theme/Animations.css";  // 已移除，动画在各页面单独引入
import "./styles/App.css";
import "./styles/App-modern.css";

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
    <ErrorBoundary>
      <ToastProvider>
        <Router>
          <AppContent user={user} setUser={setUser} handleLogout={handleLogout} />
        </Router>
        {/* PWA 安装提示 */}
        <PWAInstallPrompt />
        {/* 性能监控面板（仅开发环境）*/}
        <PerformancePanel />
      </ToastProvider>
    </ErrorBoundary>
  );
}

function AppContent({ user, setUser, handleLogout }) {
  const location = useLocation();
  // 认证相关页面不显示header（包括landing、登录、注册、忘记密码等）
  const authPages = ["/", "/login", "/register", "/forgot-password", "/reset-password"];
  const isAuthPage = authPages.some(page =>
    location.pathname === page || location.pathname.startsWith(page + "/")
  ) && !user;
  const isLandingPage = location.pathname === "/" && !user;

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
              {user.role === "admin" && (
                <a href="/admin" className="app-header-link">
                  管理后台
                </a>
              )}
              <a href="/profile" className="app-header-profile-link">
                <LazyImage
                  src={user.avatar_url || "/default-avatar.png"}
                  alt={user.full_name || user.email}
                  className="app-header-avatar"
                  placeholder="/placeholder.svg"
                  width="36px"
                  height="36px"
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
      )}
      <main className="app-main">
        <Suspense fallback={<LoadingSpinner size="large" text="页面加载中..." />}>
          <Routes>
            <Route
              path="/"
              element={
                user ? (
                  <Dashboard user={user} />
                ) : (
                  <LandingPage />
                )
              }
            />

            {/* --- 登录页面路由 --- */}
            <Route
              path="/login"
              element={
                user ? (
                  <Navigate to="/" />
                ) : (
                  <Login
                    onLoginSuccess={(loggedInUser) => setUser(loggedInUser)}
                  />
                )
              }
            />

            {/* --- 注册页面路由 --- */}
            <Route
              path="/register"
              element={
                user ? (
                  <Navigate to="/" />
                ) : (
                  <Register />
                )
              }
            />

            {/* --- 忘记密码页面路由 --- */}
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />

            {/* --- 重置密码页面路由 --- */}
            <Route
              path="/reset-password/:token"
              element={<ResetPasswordPage />}
            />

            <Route
              path="/documents/:documentId"
              element={user ? <EditorPage user={user} /> : <Navigate to="/login" />}
            />
            <Route
              path="/profile"
              element={
                user ? (
                  <ProfilePage user={user} setUser={setUser} />
                ) : (
                  <Navigate to="/login" />
                )
              }
            />
            {/* --- 管理员专属路由 --- */}
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
        </Suspense>
      </main>
    </div>
  );
}

export default App;
