/**
 * 测试工具函数
 */
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ToastProvider } from '../components/ToastContainer';

/**
 * 自定义渲染函数 - 包含必要的 Provider
 */
export function renderWithProviders(ui, options = {}) {
  const {
    route = '/',
    user = null,
    ...renderOptions
  } = options;

  // 设置初始路由
  window.history.pushState({}, 'Test page', route);

  const Wrapper = ({ children }) => (
    <BrowserRouter>
      <ToastProvider>
        {children}
      </ToastProvider>
    </BrowserRouter>
  );

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    user,
  };
}

/**
 * 等待时间
 */
export const wait = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 模拟用户数据
 */
export const mockUser = {
  id: 1,
  email: 'test@example.com',
  full_name: '测试用户',
  role: 'user',
  avatar_url: '/test-avatar.png',
};

/**
 * 模拟管理员数据
 */
export const mockAdmin = {
  id: 2,
  email: 'admin@example.com',
  full_name: '管理员',
  role: 'admin',
  avatar_url: '/admin-avatar.png',
};

/**
 * 模拟文档数据
 */
export const mockDocument = {
  id: 1,
  title: '测试文档',
  content: '这是测试内容',
  category: 'test',
  owner_id: 1,
  owner_name: '测试用户',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  locked: false,
  locked_by: null,
};

/**
 * 模拟文档列表
 */
export const mockDocuments = Array.from({ length: 10 }, (_, i) => ({
  id: i + 1,
  title: `测试文档 ${i + 1}`,
  content: `内容 ${i + 1}`,
  category: i % 2 === 0 ? 'work' : 'personal',
  owner_id: 1,
  owner_name: '测试用户',
  created_at: new Date(2024, 0, i + 1).toISOString(),
  updated_at: new Date(2024, 0, i + 1).toISOString(),
  locked: false,
  locked_by: null,
}));

/**
 * 创建 mock API 响应
 */
export function createMockResponse(data, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  });
}

/**
 * 创建 mock API 错误
 */
export function createMockError(message = 'Error', status = 500) {
  return Promise.reject({
    response: {
      status,
      data: { message },
    },
  });
}

export default {
  renderWithProviders,
  wait,
  mockUser,
  mockAdmin,
  mockDocument,
  mockDocuments,
  createMockResponse,
  createMockError,
};
