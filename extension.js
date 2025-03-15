const vscode = require('vscode');
const commands = require('./src/commands');
const I18nDecorator = require('./src/decorators/i18nDecorator');
const registerRefreshI18nDecorations = require('./src/commands/refreshI18nDecorations');

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
    ),
    vscode.commands.registerCommand(
      'i18n-swapper.openApiTranslationConfig', 
      () => commands.openApiTranslationConfig(context)
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

  // 初始化i18n装饰器
  const i18nDecorator = new I18nDecorator(context);
  i18nDecorator.initialize();
  
  // 注册刷新i18n装饰命令
  registerRefreshI18nDecorations(context, i18nDecorator);
  
  // 注册销毁函数
  context.subscriptions.push({
    dispose: () => {
      i18nDecorator.dispose();
    }
  });
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
}; 