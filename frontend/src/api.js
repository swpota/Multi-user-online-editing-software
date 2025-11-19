import axios from "axios";

// 创建 axios 实例
const api = axios.create({
  baseURL: "/api",
  timeout: 30000, // 30秒超时
});

// 请求重试配置
const MAX_RETRY_COUNT = 3; // 最大重试次数
const RETRY_DELAY = 1000; // 重试延迟（毫秒）

// 延迟函数
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 请求取消管理
const pendingRequests = new Map();

// 生成请求链接
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

// 请求拦截器：添加 token 和请求去重
api.interceptors.request.use(
  (config) => {
    // 注意：开发环境下 React.StrictMode 会双重渲染，暂时禁用 GET 请求去重
    // 生产环境可以启用
    const isDev = import.meta.env.DEV;
    if (!isDev && config.method === 'get' && !config.skipDedupe) {
      removePendingRequest(config);
      addPendingRequest(config);
    }

    // 添加 token
    const token = localStorage.getItem("authToken");
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }

    // 添加请求开始时间（用于性能监控）
    config.metadata = { startTime: Date.now() };

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器：处理错误和重试
api.interceptors.response.use(
  (response) => {
    // 移除已完成的请求
    removePendingRequest(response.config);

    // 记录请求耗时（性能监控）
    if (response.config.metadata) {
      const duration = Date.now() - response.config.metadata.startTime;
      if (duration > 3000) {
        console.warn(`慢请求警告: ${response.config.url} 耗时 ${duration}ms`);
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

    // 401 错误处理（token 过期）
    if (response && response.status === 401) {
      const currentPath = window.location.pathname;
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

    // 网络错误或服务器错误进行重试
    const shouldRetry = (
      !response || // 网络错误
      response.status >= 500 || // 5xx 错误
      error.code === 'ECONNABORTED' // 超时
    );

    if (shouldRetry && config) {
      // 初始化重试计数
      config.__retryCount = config.__retryCount || 0;

      // 检查是否超过最大重试次数
      if (config.__retryCount >= MAX_RETRY_COUNT) {
        console.error(`请求失败，已重试 ${MAX_RETRY_COUNT} 次: ${config.url}`);
        return Promise.reject(error);
      }

      // 增加重试计数
      config.__retryCount += 1;

      // 计算指数退避延迟（递增延迟）
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

// 导出取消所有请求的方法（用于组件卸载）
export const cancelAllRequests = () => {
  pendingRequests.forEach((cancel, key) => {
    cancel(`组件卸载，取消请求: ${key}`);
  });
  pendingRequests.clear();
};

export default api;
