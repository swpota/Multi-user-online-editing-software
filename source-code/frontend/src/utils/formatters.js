/**
 * 格式化工具函数
 */

/**
 * 格式化日期
 * @param {Date|string} date - 日期对象或字符串
 * @param {string} format - 格式化模式
 * @returns {string} 格式化后的日期字符串
 */
export function formatDate(date, format = 'YYYY-MM-DD HH:mm') {
  if (!date) return '-';
  
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '无效日期';
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    
    return format
      .replace('YYYY', year)
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hours)
      .replace('mm', minutes)
      .replace('ss', seconds);
  } catch (error) {
    return '无效日期';
  }
}

/**
 * 格式化文件大小
 * @param {number} bytes - 字节数
 * @param {number} decimals - 小数位数
 * @returns {string} 格式化后的文件大小
 */
export function formatFileSize(bytes, decimals = 2) {
  if (bytes === 0 || bytes < 0) return '0 B';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * 截断文本
 * @param {string} text - 原文本
 * @param {number} maxLength - 最大长度
 * @param {string} suffix - 后缀
 * @returns {string} 截断后的文本
 */
export function truncateText(text, maxLength, suffix = '...') {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  
  return text.substring(0, maxLength) + suffix;
}

/**
 * 格式化数字
 * @param {number} num - 数字
 * @returns {string} 格式化后的数字（千分位）
 */
export function formatNumber(num) {
  if (typeof num !== 'number') return '0';
  return num.toLocaleString('zh-CN');
}

/**
 * 格式化时间差
 * @param {Date|string} date - 日期
 * @returns {string} 相对时间（如：2小时前）
 */
export function formatTimeAgo(date) {
  if (!date) return '-';
  
  const now = new Date();
  const past = new Date(date);
  const diff = now - past;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 7) {
    return formatDate(date, 'YYYY-MM-DD');
  } else if (days > 0) {
    return `${days} 天前`;
  } else if (hours > 0) {
    return `${hours} 小时前`;
  } else if (minutes > 0) {
    return `${minutes} 分钟前`;
  } else {
    return '刚刚';
  }
}

export default {
  formatDate,
  formatFileSize,
  truncateText,
  formatNumber,
  formatTimeAgo,
};
