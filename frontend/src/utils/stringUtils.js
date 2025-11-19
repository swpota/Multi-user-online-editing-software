/**
 * 字符串工具函数库
 * 统一处理字符串相关操作
 */

/**
 * 根据字符串生成一致的颜色值
 * @param {string} str - 输入字符串
 * @returns {string} 十六进制颜色值
 */
export const stringToColor = (str) => {
  if (!str || str.length === 0) {
    return "#000000";
  }

  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }

  let color = "#";
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xff;
    color += ("00" + value.toString(16)).substr(-2);
  }

  return color;
};

/**
 * 截断字符串并添加省略号
 * @param {string} str - 输入字符串
 * @param {number} maxLength - 最大长度
 * @returns {string} 截断后的字符串
 */
export const truncate = (str, maxLength = 50) => {
  if (!str || typeof str !== "string") {
    return "";
  }
  if (str.length <= maxLength) {
    return str;
  }
  return str.substring(0, maxLength) + "...";
};

/**
 * 首字母大写
 * @param {string} str - 输入字符串
 * @returns {string} 首字母大写的字符串
 */
export const capitalize = (str) => {
  if (!str || typeof str !== "string") {
    return "";
  }
  return str.charAt(0).toUpperCase() + str.slice(1);
};

/**
 * 转换为 kebab-case
 * @param {string} str - 输入字符串
 * @returns {string} kebab-case 字符串
 */
export const toKebabCase = (str) => {
  if (!str || typeof str !== "string") {
    return "";
  }
  return str
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/\s+/g, "-")
    .toLowerCase();
};

/**
 * 转换为 camelCase
 * @param {string} str - 输入字符串
 * @returns {string} camelCase 字符串
 */
export const toCamelCase = (str) => {
  if (!str || typeof str !== "string") {
    return "";
  }
  return str
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ""))
    .replace(/^[A-Z]/, (c) => c.toLowerCase());
};

/**
 * 高亮搜索关键词
 * @param {string} text - 原始文本
 * @param {string} keyword - 搜索关键词
 * @returns {string} 带高亮标记的 HTML
 */
export const highlightText = (text, keyword) => {
  if (!text || !keyword) {
    return text;
  }
  const regex = new RegExp(`(${keyword})`, "gi");
  return text.replace(regex, '<mark class="highlight">$1</mark>');
};
