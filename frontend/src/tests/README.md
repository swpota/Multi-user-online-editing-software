# 测试文档

## 测试框架

本项目使用以下测试工具：

- **Vitest** - 快速的单元测试框架
- **@testing-library/react** - React 组件测试
- **@testing-library/jest-dom** - DOM 断言扩展

## 运行测试

### 开发模式（监听变化）
```bash
npm run test
```

### 运行一次
```bash
npm run test:run
```

### 查看覆盖率
```bash
npm run test:coverage
```

### UI 模式
```bash
npm run test:ui
```

## 测试结构

```
src/
├── tests/
│   ├── setup.js          # 测试环境设置
│   ├── utils.jsx         # 测试工具函数
│   └── README.md         # 本文档
├── components/
│   └── *.test.jsx        # 组件测试
├── hooks/
│   └── *.test.js         # Hooks 测试
└── utils/
    └── *.test.js         # 工具函数测试
```

## 测试示例

### 1. 组件测试

```javascript
import { render, screen, fireEvent } from '@testing-library/react';
import MyComponent from './MyComponent';

describe('MyComponent', () => {
  it('应该渲染正确的内容', () => {
    render(<MyComponent title="测试" />);
    expect(screen.getByText('测试')).toBeInTheDocument();
  });

  it('应该处理点击事件', () => {
    const handleClick = vi.fn();
    render(<MyComponent onClick={handleClick} />);
    
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

### 2. Hooks 测试

```javascript
import { renderHook } from '@testing-library/react';
import { useMyHook } from './useMyHook';

describe('useMyHook', () => {
  it('应该返回正确的值', () => {
    const { result } = renderHook(() => useMyHook());
    expect(result.current).toBe(expectedValue);
  });
});
```

### 3. 工具函数测试

```javascript
import { formatDate } from './formatters';

describe('formatDate', () => {
  it('应该格式化日期', () => {
    const result = formatDate(new Date('2024-01-01'));
    expect(result).toBe('2024-01-01 00:00');
  });
});
```

## 测试覆盖率目标

- **语句覆盖率**: 80%
- **分支覆盖率**: 80%
- **函数覆盖率**: 80%
- **行覆盖率**: 80%

## 最佳实践

### 1. 测试命名
- 使用 `describe` 描述测试对象
- 使用 `it` 或 `test` 描述测试场景
- 使用清晰的中文描述

### 2. 测试组织
- 一个文件对应一个测试文件
- 测试文件放在源文件同目录
- 使用 `.test.js` 或 `.test.jsx` 后缀

### 3. 测试内容
- 测试核心功能
- 测试边界情况
- 测试错误处理
- 测试用户交互

### 4. Mock 使用
- 使用 `vi.fn()` 创建 mock 函数
- 使用 `vi.mock()` mock 模块
- 适当使用 mock，避免过度

### 5. 断言选择
```javascript
// ✅ 推荐
expect(element).toBeInTheDocument();
expect(element).toHaveClass('active');
expect(element).toHaveTextContent('内容');

// ❌ 避免
expect(element.classList.contains('active')).toBe(true);
```

## 常用工具函数

### renderWithProviders
自动包含必要的 Provider 渲染组件

```javascript
import { renderWithProviders } from '../tests/utils';

renderWithProviders(<MyComponent />, {
  route: '/dashboard',
  user: mockUser,
});
```

### wait
等待异步操作

```javascript
import { wait } from '../tests/utils';

await wait(100); // 等待 100ms
```

### Mock 数据
使用预定义的 mock 数据

```javascript
import { mockUser, mockDocument, mockDocuments } from '../tests/utils';
```

## 持续集成

测试会在以下情况自动运行：
- Git commit 前（通过 husky）
- Pull Request 时
- 部署前

## 常见问题

### Q: 测试运行缓慢？
A: 使用 `vitest --no-threads` 或检查是否有未清理的定时器

### Q: Mock 不生效？
A: 确保 mock 在测试前设置，并在 `beforeEach` 中重置

### Q: 异步测试失败？
A: 使用 `waitFor` 等待异步操作完成

## 参考资源

- [Vitest 文档](https://vitest.dev/)
- [Testing Library 文档](https://testing-library.com/)
- [Jest DOM 匹配器](https://github.com/testing-library/jest-dom)
