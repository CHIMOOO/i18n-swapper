/**
 * 转义HTML特殊字符，防止XSS攻击
 * @param {string} text 需要转义的文本
 * @returns {string} 转义后的文本
 */
function escapeHtml(text) {
  if (text === undefined || text === null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

module.exports = {
  escapeHtml
}; 