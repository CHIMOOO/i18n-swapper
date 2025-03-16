const vscode = require('vscode');
const commands = require('./src/commands');
const I18nDecorator = require('./src/decorators/i18nDecorator');
const registerRefreshI18nDecorations = require('./src/commands/refreshI18nDecorations');
const fs = require('fs');
const path = require('path');
const defaultsConfig = require('./src/config/defaultsConfig');  // 引入默认配置，更改为明确的名称

/**
 * 激活扩展
 * @param {vscode.ExtensionContext} context 扩展上下文
 */
function activate(context) {
  console.log('i18n-swapper 扩展已激活');

  // 确保工作区设置中有默认配置
  ensureDefaultWorkspaceSettings();

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
      (document) => commands.quickBatchReplace(context, document)
    ),
    vscode.commands.registerCommand(
      'i18n-swapper.setLocalesPaths', 
      commands.setLocalesPaths
    ),
    vscode.commands.registerCommand(
      'i18n-swapper.openApiTranslationConfig', 
      () => commands.openApiTranslationConfig(context)
    ),
    // 添加确认和取消替换的命令
    vscode.commands.registerCommand(
      'i18n-swapper.confirmReplacement',
      (args) => {
        // 发送确认替换的消息到全局变量
        if (global.i18nSwapperPanel) {
          global.i18nSwapperPanel.confirmReplacement(args.index);
        }
      }
    ),
    vscode.commands.registerCommand(
      'i18n-swapper.cancelReplacement',
      (args) => {
        // 发送取消替换的消息到全局变量
        if (global.i18nSwapperPanel) {
          global.i18nSwapperPanel.cancelReplacement(args.index);
        }
      }
    ),
    vscode.commands.registerCommand(
      'i18n-swapper.applyAllReplacements',
      () => {
        // 应用所有替换
        if (global.i18nSwapperPanel) {
          global.i18nSwapperPanel.applyAllReplacements();
        }
      }
    ),
    vscode.commands.registerCommand(
      'i18n-swapper.cancelAllReplacements',
      () => {
        // 取消所有替换
        if (global.i18nSwapperPanel) {
          global.i18nSwapperPanel.cancelAllReplacements();
        }
      }
    )
  );

  // 初始化其他命令
  commands.initializeCommands(context);

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

/**
 * 确保工作区配置中有默认设置
 */
async function ensureDefaultWorkspaceSettings() {
  try {
    // 检查是否有工作区
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
      console.log('没有打开的工作区，跳过默认设置初始化');
      return;
    }

    const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const vscodeDir = path.join(rootPath, '.vscode');
    const settingsPath = path.join(vscodeDir, 'settings.json');
    
    // 获取当前工作区配置
    const config = vscode.workspace.getConfiguration('i18n-swapper');
    
    // 检查配置是否已存在
    let needsUpdate = false;
    let settings = {};
    
    // 使用统一的默认值配置
    const defaultSettings = {
        'i18n-swapper.decorationStyle': defaultsConfig.decorationStyle,
        'i18n-swapper.defaultLocale': defaultsConfig.defaultLocale,
        'i18n-swapper.functionName': defaultsConfig.functionName,
        'i18n-swapper.localesPaths': defaultsConfig.localesPaths,
        'i18n-swapper.quoteType': defaultsConfig.quoteType,
        'i18n-swapper.scanPatterns': defaultsConfig.scanPatterns,
        'i18n-swapper.showFullFormInEditMode': defaultsConfig.showFullFormInEditMode,
        'i18n-swapper.suffixStyle': defaultsConfig.suffixStyle,
        'i18n-swapper.inlineStyle': defaultsConfig.inlineStyle,
        'i18n-swapper.tencentTranslation.apiKey': defaultsConfig.tencentTranslation.apiKey,
        'i18n-swapper.tencentTranslation.apiSecret': defaultsConfig.tencentTranslation.apiSecret,
        'i18n-swapper.tencentTranslation.region': defaultsConfig.tencentTranslation.region,
        'i18n-swapper.tencentTranslation.sourceLanguage': defaultsConfig.tencentTranslation.sourceLanguage,
        'i18n-swapper.tencentTranslation.languageMappings': defaultsConfig.tencentTranslation.languageMappings
    };
    
    // 检查 .vscode 目录是否存在，如果不存在则创建
    if (!fs.existsSync(vscodeDir)) {
      fs.mkdirSync(vscodeDir, { recursive: true });
      needsUpdate = true;
    }
    
    // 检查 settings.json 是否存在，如果存在则读取
    if (fs.existsSync(settingsPath)) {
      try {
        const fileContent = fs.readFileSync(settingsPath, 'utf8');
        settings = JSON.parse(fileContent);
      } catch (error) {
        console.error('读取工作区设置文件出错:', error);
        settings = {};
        needsUpdate = true;
      }
    } else {
      needsUpdate = true;
    }
    
    // 检查每项配置是否缺失
    for (const [key, value] of Object.entries(defaultSettings)) {
      if (settings[key] === undefined) {
        settings[key] = value;
        needsUpdate = true;
      }
    }
    
    // 如果需要更新，写入文件
    if (needsUpdate) {
      // 写入文件前格式化JSON
      const formattedJson = JSON.stringify(settings, null, 2);
      fs.writeFileSync(settingsPath, formattedJson, 'utf8');
      console.log('已将默认配置写入工作区设置文件');
      
      // 通知用户
      vscode.window.showInformationMessage('已将I18n-swapper的默认设置写入工作区');
    }
  } catch (error) {
    console.error('初始化工作区设置出错:', error);
  }
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
}; 