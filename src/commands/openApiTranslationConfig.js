const vscode = require('vscode');
const ApiTranslationPanel = require('../panels/ApiTranslationPanel');

/**
 * 打开API翻译配置面板
 * @param {vscode.ExtensionContext} context 扩展上下文
 */
async function openApiTranslationConfig(context) {
  // 创建API翻译配置面板
  const panel = new ApiTranslationPanel(context);
  panel.createOrShow();
}

module.exports = openApiTranslationConfig; 