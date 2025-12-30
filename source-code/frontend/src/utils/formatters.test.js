/**
 * 格式化工具函数测试
 */
import { describe, it, expect } from 'vitest';
import { formatDate, formatFileSize, truncateText } from './formatters';

describe('formatters 工具函数', () => {
  describe('formatDate', () => {
    it('应该正确格式化日期', () => {
      const date = new Date('2024-01-15T12:30:00Z');
      const result = formatDate(date);
      expect(result).toMatch(/2024/);
    });

    it('应该处理字符串日期', () => {
      const result = formatDate('2024-01-15');
      expect(result).toMatch(/2024/);
    });

    it('应该处理无效日期', () => {
      const result = formatDate('invalid');
      expect(result).toBe('无效日期');
    });

    it('应该处理 null/undefined', () => {
      expect(formatDate(null)).toBe('-');
      expect(formatDate(undefined)).toBe('-');
    });
  });

  describe('formatFileSize', () => {
    it('应该格式化字节', () => {
      expect(formatFileSize(500)).toBe('500 B');
    });

    it('应该格式化 KB', () => {
      expect(formatFileSize(1024)).toBe('1.00 KB');
      expect(formatFileSize(1536)).toBe('1.50 KB');
    });

    it('应该格式化 MB', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1.00 MB');
      expect(formatFileSize(1024 * 1024 * 2.5)).toBe('2.50 MB');
    });

    it('应该格式化 GB', () => {
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1.00 GB');
    });

    it('应该处理 0', () => {
      expect(formatFileSize(0)).toBe('0 B');
    });

    it('应该处理负数', () => {
      expect(formatFileSize(-100)).toBe('0 B');
    });
  });

  describe('truncateText', () => {
    it('应该截断长文本', () => {
      const text = '这是一段很长的文本内容';
      const result = truncateText(text, 10);
      expect(result).toBe('这是一段很长的文...');
      expect(result.length).toBeLessThanOrEqual(13); // 10 + '...'
    });

    it('应该保留短文本', () => {
      const text = '短文本';
      const result = truncateText(text, 10);
      expect(result).toBe(text);
    });

    it('应该处理空字符串', () => {
      expect(truncateText('', 10)).toBe('');
    });

    it('应该处理 null/undefined', () => {
      expect(truncateText(null, 10)).toBe('');
      expect(truncateText(undefined, 10)).toBe('');
    });

    it('应该使用自定义后缀', () => {
      const result = truncateText('很长的文本', 5, '---');
      expect(result).toBe('很长的文本---');
    });
  });
});
