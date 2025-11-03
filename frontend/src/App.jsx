import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import axios from "axios";

// 组件和页面
import Register from "./components/Register";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import EditorPage from "./pages/EditorPage";

import "./App.css";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const validateToken = async () => {
      const token = localStorage.getItem("authToken");
      if (token) {
        axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
        try {
          const response = await axios.get("/api/users/profile");
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
    delete axios.defaults.headers.common["Authorization"];
    // 登出后导航回主页
    return <Navigate to="/" replace />;
  };

  if (loading) {
    return <div>正在加载应用...</div>;
  }

  return (
    <Router>
      <div className="App">
        <header className="App-header">
          <h1>多人在线协作编辑软件, @swpota</h1>
          {user && (
            <button onClick={handleLogout} style={{ float: "right" }}>
              退出登录
            </button>
          )}
        </header>
        <main>
          <Routes>
            <Route
              path="/"
              element={
                user ? (
                  <Dashboard user={user} />
                ) : (
                  <div
                    style={{ display: "flex", justifyContent: "space-around" }}
                  >
                    <div style={{ flex: 1, padding: "20px" }}>
                      <Register />
                    </div>
                    <div
                      style={{
                        flex: 1,
                        padding: "20px",
                        borderLeft: "1px solid #ccc",
                      }}
                    >
                      <Login
                        onLoginSuccess={(loggedInUser) => setUser(loggedInUser)}
                      />
                    </div>
                  </div>
                )
              }
            />

            <Route
              path="/documents/:documentId"
              element={user ? <EditorPage user={user} /> : <Navigate to="/" />}
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
