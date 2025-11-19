/**
 * 对象工具函数库
 * 统一处理对象相关操作
 */

/**
 * 深度克隆对象
 * @param {*} obj - 需要克隆的对象
 * @returns {*} 克隆后的对象
 */
export const deepClone = (obj) => {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  try {
    return JSON.parse(JSON.stringify(obj));
  } catch (_error) {
    console.warn("Deep clone failed:", _error);
    return obj;
  }
};

/**
 * 克隆 Quill Delta 对象
 * @param {Object} delta - Quill Delta 对象
 * @returns {Object} 克隆后的 Delta 对象
 */
export const cloneDelta = (delta) => {
  if (!delta || typeof delta !== "object") {
    return { ops: [{ insert: "\n" }] };
  }
  try {
    return JSON.parse(JSON.stringify(delta));
  } catch (_error) {
    return { ops: [{ insert: "\n" }] };
  }
};

/**
 * 比较两个 Delta 对象是否相等
 * @param {Object} a - Delta 对象 A
 * @param {Object} b - Delta 对象 B
 * @returns {boolean} 是否相等
 */
export const deltasEqual = (a, b) => {
  try {
    return JSON.stringify(a || {}) === JSON.stringify(b || {});
  } catch (_error) {
    return false;
  }
};

/**
 * 合并对象（浅合并）
 * @param {Object} target - 目标对象
 * @param {Object} source - 源对象
 * @returns {Object} 合并后的对象
 */
export const merge = (target, source) => {
  return { ...target, ...source };
};

/**
 * 深度合并对象
 * @param {Object} target - 目标对象
 * @param {Object} source - 源对象
 * @returns {Object} 合并后的对象
 */
export const deepMerge = (target, source) => {
  const output = { ...target };
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach((key) => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  return output;
};

/**
 * 判断是否为对象
 * @param {*} item - 需要判断的值
 * @returns {boolean} 是否为对象
 */
export const isObject = (item) => {
  return item && typeof item === "object" && !Array.isArray(item);
};

/**
 * 从对象中提取指定键
 * @param {Object} obj - 源对象
 * @param {Array<string>} keys - 需要提取的键
 * @returns {Object} 提取后的对象
 */
export const pick = (obj, keys) => {
  if (!isObject(obj) || !Array.isArray(keys)) {
    return {};
  }
  return keys.reduce((result, key) => {
    if (key in obj) {
      result[key] = obj[key];
    }
    return result;
  }, {});
};

/**
 * 从对象中排除指定键
 * @param {Object} obj - 源对象
 * @param {Array<string>} keys - 需要排除的键
 * @returns {Object} 排除后的对象
 */
export const omit = (obj, keys) => {
  if (!isObject(obj) || !Array.isArray(keys)) {
    return {};
  }
  const result = { ...obj };
  keys.forEach((key) => {
    delete result[key];
  });
  return result;
};
