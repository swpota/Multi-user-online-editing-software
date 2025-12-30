/**
 * useMediaQuery Hook 测试
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMediaQuery, useBreakpoint, useDeviceType } from './useMediaQuery';

describe('useMediaQuery Hooks', () => {
  beforeEach(() => {
    // 重置 matchMedia mock
    window.matchMedia = vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  describe('useMediaQuery', () => {
    it('应该返回初始匹配状态', () => {
      window.matchMedia = vi.fn().mockImplementation(() => ({
        matches: true,
        media: '(min-width: 768px)',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));

      const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
      expect(result.current).toBe(true);
    });

    it('应该返回 false 当不匹配时', () => {
      const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
      expect(result.current).toBe(false);
    });

    it('应该监听媒体查询变化', () => {
      let changeHandler;
      window.matchMedia = vi.fn().mockImplementation(() => ({
        matches: false,
        media: '(min-width: 768px)',
        addEventListener: vi.fn((event, handler) => {
          if (event === 'change') {
            changeHandler = handler;
          }
        }),
        removeEventListener: vi.fn(),
      }));

      const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
      expect(result.current).toBe(false);

      // 模拟媒体查询变化
      if (changeHandler) {
        changeHandler({ matches: true });
      }
    });
  });

  describe('useBreakpoint', () => {
    it('应该检测移动端', () => {
      window.matchMedia = vi.fn().mockImplementation(query => {
        if (query === '(max-width: 767px)') {
          return {
            matches: true,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
          };
        }
        return {
          matches: false,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        };
      });

      const { result } = renderHook(() => useBreakpoint());
      expect(result.current.isMobile).toBe(true);
      expect(result.current.isTablet).toBe(false);
      expect(result.current.isDesktop).toBe(false);
    });

    it('应该检测平板', () => {
      window.matchMedia = vi.fn().mockImplementation(query => {
        if (query === '(min-width: 768px) and (max-width: 1023px)') {
          return {
            matches: true,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
          };
        }
        return {
          matches: false,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        };
      });

      const { result } = renderHook(() => useBreakpoint());
      expect(result.current.isTablet).toBe(true);
      expect(result.current.isMobile).toBe(false);
    });

    it('应该检测桌面端', () => {
      window.matchMedia = vi.fn().mockImplementation(query => {
        if (query === '(min-width: 1024px)') {
          return {
            matches: true,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
          };
        }
        return {
          matches: false,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        };
      });

      const { result } = renderHook(() => useBreakpoint());
      expect(result.current.isDesktop).toBe(true);
    });
  });

  describe('useDeviceType', () => {
    it('应该返回 mobile', () => {
      window.matchMedia = vi.fn().mockImplementation(query => {
        if (query === '(max-width: 767px)') {
          return {
            matches: true,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
          };
        }
        return {
          matches: false,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        };
      });

      const { result } = renderHook(() => useDeviceType());
      expect(result.current).toBe('mobile');
    });

    it('应该返回 tablet', () => {
      window.matchMedia = vi.fn().mockImplementation(query => {
        if (query === '(min-width: 768px) and (max-width: 1023px)') {
          return {
            matches: true,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
          };
        }
        return {
          matches: false,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        };
      });

      const { result } = renderHook(() => useDeviceType());
      expect(result.current).toBe('tablet');
    });

    it('应该返回 desktop', () => {
      window.matchMedia = vi.fn().mockImplementation(query => {
        if (query === '(min-width: 1024px)') {
          return {
            matches: true,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
          };
        }
        return {
          matches: false,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        };
      });

      const { result } = renderHook(() => useDeviceType());
      expect(result.current).toBe('desktop');
    });
  });
});
