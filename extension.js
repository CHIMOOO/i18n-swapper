const vscode = require('vscode');
const commands = require('./src/commands');

/**
 * 激活扩展
 * @param {vscode.ExtensionContext} context 扩展上下文
 */
function activate(context) {
  console.log('i18n-swapper 扩展已激活');

  // 注册所有命令
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'i18n-swapper.replaceWithI18n', 
      commands.replaceWithI18n
    ),
    vscode.commands.registerCommand(
      'i18n-swapper.batchReplaceWithI18n', 
      () => commands.batchReplaceWithI18n(context)
    ),
    vscode.commands.registerCommand(
      'i18n-swapper.quickBatchReplace', 
      commands.quickBatchReplace
    ),
    vscode.commands.registerCommand(
      'i18n-swapper.setLocalesPaths', 
      commands.setLocalesPaths
    )
  );

  // 检查并设置默认配置
  const config = vscode.workspace.getConfiguration('i18n-swapper');
  const scanPatterns = config.get('scanPatterns', []);
  
  // 如果扫描模式未配置，添加默认值
  if (!scanPatterns || scanPatterns.length === 0) {
    config.update('scanPatterns', [
      "value",
      "label",
      "placeholder",
      "message",
      "title",
      "text"
    ], vscode.ConfigurationTarget.Workspace);
  }
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
}; 