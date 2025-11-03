import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  // 服务器配置，包含了 API 代理规则
  server: {
    proxy: {
      // 规则：所有以 /api 开头的请求，都将被转发到 target 指定的地址
      "/api": {
        target: "http://localhost:5000", // 这是你的后端服务器地址
        changeOrigin: true, // 必须设置为 true，用于修改请求头中的源，以避免跨域问题
        secure: false, // 如果你的后端服务是 http 而不是 https，建议加上此项
      },
    },
  },
});
