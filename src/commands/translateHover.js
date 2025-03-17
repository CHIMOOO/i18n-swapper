const vscode = require('vscode');
const { translateTextToAllLanguages } = require('../services/translationService');

/**
 * 处理悬浮窗中的翻译请求
 * @param {Object} params 参数对象，包含文本和可选的键名
 */
async function handleHoverTranslate(params) {
  try {
    let { text, key } = params;
    
    if (!text) {
      // 提示用户输入文本
      text = await vscode.window.showInputBox({
        prompt: '请输入要翻译的文本',
        placeHolder: '例如：提交表单',
        validateInput: input => {
          return input && input.trim() !== '' ? null : '文本不能为空';
        }
      });
      
      // 如果用户取消输入，则终止流程
      if (!text) {
        return null; // 返回 null 表示操作被取消
      }
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