import axios from "axios";

const api = axios.create({
  baseURL: "/api",
});

// 请求拦截器：添加 token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("authToken");
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器：处理 401 错误（token 过期或无效）
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // 如果是 401 错误（未授权），清除 token 并重定向到登录页
    if (error.response && error.response.status === 401) {
      const currentPath = window.location.pathname;
      // 如果不是在登录或注册页面，才清除 token 并重定向
      if (currentPath !== "/login" && currentPath !== "/register" && currentPath !== "/") {
        console.log("Token 已过期或无效，正在重定向到登录页...");
        localStorage.removeItem("authToken");
        // 延迟跳转，避免多次重定向
        setTimeout(() => {
          if (window.location.pathname !== "/login") {
            window.location.href = "/login";
          }
        }, 100);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
