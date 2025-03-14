const i18nHelper = require('./i18n-helper');
const textAnalyzer = require('./text-analyzer');
const textReplacer = require('./text-replacer');

/**
 * 根据路径设置对象中的值
 * @param {Object} obj 目标对象
 * @param {string} path 键路径，如 'a.b.c'
 * @param {any} value 要设置的值
 */
function setValueByPath(obj, path, value) {
  if (!obj || typeof obj !== 'object') {
    return;
  }
  
  const keys = path.split('.');
  let current = obj;
  
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!current[key] || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }
  
  current[keys[keys.length - 1]] = value;
}

module.exports = {
  ...i18nHelper,
  ...textAnalyzer,
  ...textReplacer,
  setValueByPath,
}; 