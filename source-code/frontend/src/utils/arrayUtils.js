/**
 * 数组工具函数库
 * 统一处理数组相关操作
 */

/**
 * 将各种类型的值转换为数组
 * @param {*} value - 需要转换的值
 * @returns {Array} 转换后的数组
 */
export const toArray = (value) => {
  // 已经是数组，直接返回
  if (Array.isArray(value)) {
    return value;
  }

  // 空值返回空数组
  if (!value) {
    return [];
  }

  // 字符串类型
  if (typeof value === "string") {
    try {
      // 尝试解析 JSON
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (_error) {
      // JSON 解析失败，按逗号分割（支持中英文逗号）
      return value
        .split(/[,，]/)
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  // 对象类型（非数组）
  if (typeof value === "object") {
    return Array.isArray(value) ? value : [];
  }

  // 其他类型返回空数组
  return [];
};

/**
 * 数组去重
 * @param {Array} items - 需要去重的数组
 * @returns {Array} 去重后的数组
 */
export const dedupe = (items) => {
  if (!Array.isArray(items)) {
    return [];
  }
  return Array.from(new Set(items));
};

/**
 * 解析标签输入字符串
 * @param {string} input - 标签输入字符串（逗号分隔，支持中英文逗号）
 * @returns {Array<string>} 标签数组
 */
export const parseTagsInput = (input) => {
  if (!input || typeof input !== "string") {
    return [];
  }
  return input
    .split(/[,，]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
};

/**
 * 对数组进行分组
 * @param {Array} array - 需要分组的数组
 * @param {Function} keyGetter - 获取分组键的函数
 * @returns {Object} 分组后的对象
 */
export const groupBy = (array, keyGetter) => {
  if (!Array.isArray(array)) {
    return {};
  }
  return array.reduce((result, item) => {
    const key = keyGetter(item);
    if (!result[key]) {
      result[key] = [];
    }
    result[key].push(item);
    return result;
  }, {});
};

/**
 * 数组分页
 * @param {Array} array - 需要分页的数组
 * @param {number} page - 页码（从 1 开始）
 * @param {number} pageSize - 每页数量
 * @returns {Array} 分页后的数组
 */
export const paginate = (array, page = 1, pageSize = 10) => {
  if (!Array.isArray(array)) {
    return [];
  }
  const startIndex = (page - 1) * pageSize;
  return array.slice(startIndex, startIndex + pageSize);
};
