/**
 * 验证工具函数
 * 统一的验证逻辑，可在前后端共享（前端需要适配）
 */

/**
 * 验证邮箱格式
 * @param {string} email - 邮箱地址
 * @returns {boolean} 是否为有效邮箱
 */
const validateEmail = (email) => {
  if (!email) return false;
  // 改进的邮箱格式验证：要求顶级域名至少2个字符
  const emailRegex = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email.trim());
};

/**
 * 验证手机号格式（中国大陆）
 * @param {string} phone - 手机号
 * @returns {boolean} 是否为有效手机号
 */
const validatePhone = (phone) => {
  if (!phone) return false;
  // 手机号验证：11位数字，以1开头，第二位为3-9
  const phoneRegex = /^1[3-9]\d{9}$/;
  return phoneRegex.test(phone.trim());
};

/**
 * 验证姓名格式
 * @param {string} name - 姓名
 * @returns {boolean} 是否为有效姓名
 */
const validateFullName = (name) => {
  if (!name) return false;
  const trimmedName = name.trim();
  // 姓名不能为空
  if (trimmedName.length === 0) return false;
  // 姓名不能全是数字
  if (/^\d+$/.test(trimmedName)) return false;
  // 姓名长度应该在2-50个字符之间
  if (trimmedName.length < 2 || trimmedName.length > 50) return false;
  // 姓名应该包含至少一个非数字字符（允许中文、英文、空格等）
  if (!/[\u4e00-\u9fa5a-zA-Z\s]/.test(trimmedName)) return false;
  return true;
};

/**
 * 验证密码强度
 * @param {string} password - 密码
 * @param {number} minLength - 最小长度
 * @returns {object} { valid: boolean, message: string }
 */
const validatePassword = (password, minLength = 6) => {
  if (!password) {
    return { valid: false, message: "密码不能为空" };
  }
  if (password.length < minLength) {
    return { valid: false, message: `密码长度不能少于 ${minLength} 位` };
  }
  // 可以添加更多密码强度检查
  // 例如：包含大小写字母、数字、特殊字符等
  return { valid: true, message: "密码有效" };
};

/**
 * 清理和规范化邮箱
 * @param {string} email - 邮箱地址
 * @returns {string|null} 规范化后的邮箱或null
 */
const normalizeEmail = (email) => {
  if (!email) return null;
  return email.trim().toLowerCase();
};

/**
 * 清理和规范化手机号
 * @param {string} phone - 手机号
 * @returns {string|null} 规范化后的手机号或null
 */
const normalizePhone = (phone) => {
  if (!phone) return null;
  return phone.trim();
};

module.exports = {
  validateEmail,
  validatePhone,
  validateFullName,
  validatePassword,
  normalizeEmail,
  normalizePhone,
};

