/**
 * Axios API 封装
 * 
 * 统一封装所有HTTP请求，提供以下功能：
 * - 自动添加JWT token到请求头
 * - 请求去重：防止同一个请求短时间内发多次
 * - 失败重试：网络错误或5xx错误会自动重试最多3次
 * - 401处理：token过期自动跳转登录页
 * - 慢请求警告：超过3秒的请求会在控制台警告
 */
import axios from "axios";

// axios实例，baseURL设为/api，前端用vite代理到后端
const api = axios.create({
  baseURL: "/api",
  timeout: 30000,  // 30秒超时
});

// 重试配置：最多重试3次，初始延迟1秒，指数退避
const MAX_RETRY_COUNT = 3;
const RETRY_DELAY = 1000;
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 请求去重：用Map记录正在进行的请求，重复请求会被取消
const pendingRequests = new Map();

// 生成请求的唯一key
const generateRequestKey = (config) => {
  const { method, url, params, data } = config;
  return `${method}:${url}:${JSON.stringify(params)}:${JSON.stringify(data)}`;
};

// 取消重复请求
const removePendingRequest = (config) => {
  const requestKey = generateRequestKey(config);
  if (pendingRequests.has(requestKey)) {
    const cancel = pendingRequests.get(requestKey);
    cancel(`取消重复请求: ${requestKey}`);
    pendingRequests.delete(requestKey);
  }
};

// 添加待处理请求
const addPendingRequest = (config) => {
  const requestKey = generateRequestKey(config);
  config.cancelToken = config.cancelToken || new axios.CancelToken((cancel) => {
    if (!pendingRequests.has(requestKey)) {
      pendingRequests.set(requestKey, cancel);
    }
  });
};

// 请求拦截器：在请求发出前做处理
api.interceptors.request.use(
  (config) => {
    // GET请求去重（开发环境禁用，因为React.StrictMode会双渲染）
    const isDev = import.meta.env.DEV;
    if (!isDev && config.method === 'get' && !config.skipDedupe) {
      removePendingRequest(config);
      addPendingRequest(config);
    }

    // 从localStorage读取token，加到Authorization请求头
    const token = localStorage.getItem("authToken");
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }

    // 记录开始时间，用于计算请求耗时
    config.metadata = { startTime: Date.now() };

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器：处理响应和错误
api.interceptors.response.use(
  (response) => {
    removePendingRequest(response.config);

    // 请求超过3秒，在控制台警告
    if (response.config.metadata) {
      const duration = Date.now() - response.config.metadata.startTime;
      if (duration > 3000) {
        console.warn(`慢请求: ${response.config.url} 耗时 ${duration}ms`);
      }
    }
    return response;
  },
  async (error) => {
    const { config, response } = error;

    // 移除失败的请求
    if (config) {
      removePendingRequest(config);
    }

    // 如果请求被取消，不进行重试
    if (axios.isCancel(error)) {
      console.log('请求已取消:', error.message);
      return Promise.reject(error);
    }

    // 401表示token无效或过期，需要重新登录
    if (response && response.status === 401) {
      const currentPath = window.location.pathname;
      // 避免在登录注册页循环跳转
      if (currentPath !== "/login" && currentPath !== "/register" && currentPath !== "/") {
        console.log("Token 已过期或无效，正在重定向到登录页...");
        localStorage.removeItem("authToken");
        setTimeout(() => {
          if (window.location.pathname !== "/login") {
            window.location.href = "/login";
          }
        }, 100);
      }
      return Promise.reject(error);
    }

    // 判断是否需要重试：网络错误、5xx服务器错误、超时
    const shouldRetry = (
      !response ||                    // 网络错误（无响应）
      response.status >= 500 ||       // 服务器错误
      error.code === 'ECONNABORTED'   // 超时
    );

    if (shouldRetry && config) {
      config.__retryCount = config.__retryCount || 0;

      if (config.__retryCount >= MAX_RETRY_COUNT) {
        console.error(`请求失败，已重试 ${MAX_RETRY_COUNT} 次: ${config.url}`);
        return Promise.reject(error);
      }

      config.__retryCount += 1;

      // 指数退避：每次重试延迟翻倍（1s -> 2s -> 4s）
      const retryDelay = RETRY_DELAY * Math.pow(2, config.__retryCount - 1);

      console.log(`请求失败，${retryDelay}ms 后进行第 ${config.__retryCount} 次重试: ${config.url}`);

      // 等待后重试
      await delay(retryDelay);

      // 重新发起请求
      return api(config);
    }

    // 增强错误信息
    if (error.message === 'Network Error') {
      error.friendlyMessage = '网络连接失败，请检查网络连接';
    } else if (error.code === 'ECONNABORTED') {
      error.friendlyMessage = '请求超时，请稍后重试';
    } else if (response) {
      error.friendlyMessage = response.data?.message || `请求失败 (${response.status})`;
    } else {
      error.friendlyMessage = '请求失败，请稍后重试';
    }

    return Promise.reject(error);
  }
);

// 组件卸载时取消所有请求
export const cancelAllRequests = () => {
  pendingRequests.forEach((cancel, key) => {
    cancel(`组件卸载，取消请求: ${key}`);
  });
  pendingRequests.clear();
};

export default api;
