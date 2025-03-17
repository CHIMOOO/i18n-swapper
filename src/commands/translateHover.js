const vscode = require('vscode');
const { translateTextToAllLanguages } = require('../services/translationService');

/**
 * 处理悬浮窗中的翻译请求
 * @param {Object} params 参数对象，包含文本和可选的键名
 */
async function handleHoverTranslate(params) {
  try {
    const { text, key } = params;
    
    if (!text) {
      throw new Error('文本不能为空');
    }
    
    console.log(`处理悬浮翻译：文本="${text}", 键="${key}"`);
    
    // 调用翻译服务
    const result = await translateTextToAllLanguages(text, key);
    
    // 显示成功消息
    vscode.window.showInformationMessage(`已翻译"${text.substring(0, 20)}${text.length > 20 ? '...' : ''}"并保存到所有语言文件`);
    
    // 刷新装饰器以显示更新后的翻译
    vscode.commands.executeCommand('i18n-swapper.refreshI18nDecorations');
    
    return result;
  } catch (error) {
    console.error('悬浮窗翻译出错:', error);
    vscode.window.showErrorMessage(`翻译失败: ${error.message}`);
    return null;
  }
}

module.exports = {
  handleHoverTranslate
}; 