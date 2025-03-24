const vscode = require('vscode');
const crypto = require('crypto');
const https = require('https');
const { LANGUAGE_NAMES } = require('../../utils/language-mappings');

/**
 * 从文本生成键名
 * @param {string} text 原文本
 * @returns {string} 生成的键名
 */
function generateKeyFromText(text) {
  if (!text) return '';
  
  // 移除标点符号和特殊字符
  let key = text
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, ' ')  // 保留中文、英文和数字
    .replace(/\s+/g, ' ')                        // 合并空格
    .trim();
  
  // 限制长度
  if (key.length > 20) {
    key = key.substring(0, 20);
  }
  
  // 如果是纯中文，提取首字母作为键名
  if (/^[\u4e00-\u9fa5]+$/.test(key)) {
    const pinyinKey = key
      .split('')
      .map(char => char.charAt(0))
      .join('');
    return pinyinKey;
  }
  
  // 驼峰命名
  return key
    .split(' ')
    .map((word, index) => {
      if (!word) return '';
      return index === 0 
        ? word.toLowerCase() 
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join('');
}


/**
 * 获取语言名称
 * @param {string} code 语言代码
 * @returns {string} 语言名称
 */
function getLanguageName(code) {
  return LANGUAGE_NAMES[code] || code;
}

module.exports = {
  generateKeyFromText,
  getLanguageName
}; 