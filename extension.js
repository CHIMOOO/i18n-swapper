const vscode = require('vscode');
const commands = require('./src/commands');
const I18nDecorator = require('./src/decorators/i18nDecorator');
const registerRefreshI18nDecorations = require('./src/commands/refreshI18nDecorations');
const fs = require('fs');
const path = require('path');
const defaultsConfig = require('./src/config/defaultsConfig');  // 引入默认配置，更改为明确的名称
const { LANGUAGE_NAMES } = require('./src/utils/language-mappings');
const { handleHoverTranslate } = require('./src/commands/translateHover');
const { editLanguageEntry } = require('./src/commands/edit-language-entry');
const BatchReplacementPanel = require('./src/panels/BatchReplacementPanel');

/**
 * 激活扩展
 * @param {vscode.ExtensionContext} context 扩展上下文
 */
function activate(context) {
  console.log('i18n-swapper 插件已激活');

  // 确保为新打开的工作区初始化默认设置
  ensureDefaultWorkspaceSettings().then(() => {
    // 确保设置已经被正确应用
    const config = vscode.workspace.getConfiguration('i18n-swapper');
    
    // 强制预加载装饰样式配置以确保第一次打开时正确
    const decorationStyle = config.get('decorationStyle', defaultsConfig.decorationStyle);
    if (decorationStyle) {
      console.log(`预加载装饰样式: ${decorationStyle}`);
      // 将装饰样式强制应用到配置中
      config.update('decorationStyle', decorationStyle, vscode.ConfigurationTarget.Workspace)
        .then(() => {
          console.log('装饰样式配置已更新');
        })
        .catch(err => {
          console.error('更新装饰样式配置时出错:', err);
        });
    }
    
    // 继续注册命令和创建其他服务
    
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
        (context, document) => commands.quickBatchReplace(context, document)
      ),
      vscode.commands.registerCommand(
        'i18n-swapper.setLocalesPaths', 
        commands.setLocalesPaths
      ),
      vscode.commands.registerCommand(
        'i18n-swapper.openApiTranslationConfig', 
        () => commands.openApiTranslationConfig(context)
      ),
      vscode.commands.registerCommand('i18n-swapper.translateText', async (params) => {
          try {
              const { text, targetLang, i18nKey, filePath } = params;
              
              // 显示正在翻译的消息
              vscode.window.showInformationMessage(`正在翻译文本到 ${LANGUAGE_NAMES[targetLang] || targetLang}...`);
              
              // 调用翻译服务
              const translatedText = await translateText(text, targetLang);
              
              if (translatedText) {
                  // 更新语言文件
                  const success = await updateLanguageFile(filePath, i18nKey, translatedText);
                  
                  if (success) {
                      vscode.window.showInformationMessage(`已翻译并更新: ${translatedText}`);
                      
                      // 先关闭悬浮窗口
                      // await vscode.commands.executeCommand('editor.action.hideHover');
                      
                      // 然后刷新国际化装饰器
                      vscode.commands.executeCommand('i18n-swapper.refreshI18nDecorations');
                  } else {
                      vscode.window.showErrorMessage('无法更新语言文件');
                  }
              } else {
                  vscode.window.showErrorMessage('翻译失败');
              }
          } catch (error) {
              console.error('翻译出错:', error);
              vscode.window.showErrorMessage(`翻译出错: ${error.message}`);
          }
      }),
      vscode.commands.registerCommand('i18n-swapper.translateHover', handleHoverTranslate),
      vscode.commands.registerCommand('i18n-swapper.editLanguageEntry', async (params) => {
        try {
          const { langCode, i18nKey, filePath, currentValue = '' } = params;
          
          if (!i18nKey || !filePath) {
              vscode.window.showErrorMessage('缺少必要的参数');
              return;
          }
          
          // 显示输入框让用户编辑值
          const inputOptions = {
              prompt: `编辑 ${i18nKey} (${langCode})`,
              value: currentValue,
              placeHolder: '输入翻译文本'
          };
          
          const newValue = await vscode.window.showInputBox(inputOptions);
          
          // 如果用户取消了输入或没有改变值，就不执行更新
          if (newValue === undefined || newValue === currentValue) {
              return;
          }
          
          // 获取完整的绝对路径
          let fullPath = filePath;
          if (!path.isAbsolute(filePath) && vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
              fullPath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, filePath);
          }
          
          console.log(`尝试访问文件: ${fullPath}`);
          
          // 检查文件是否存在
          if (!fs.existsSync(fullPath)) {
              vscode.window.showErrorMessage(`找不到语言文件: ${fullPath}`);
              
              // 检查目录是否存在，不存在则创建
              const dirPath = path.dirname(fullPath);
              if (!fs.existsSync(dirPath)) {
                  try {
                      fs.mkdirSync(dirPath, { recursive: true });
                      console.log(`创建目录: ${dirPath}`);
                      // 创建空的JSON文件
                      fs.writeFileSync(fullPath, JSON.stringify({}, null, 2), 'utf8');
                      console.log(`创建新语言文件: ${fullPath}`);
                  } catch (err) {
                      vscode.window.showErrorMessage(`无法创建文件或目录: ${err.message}`);
                      return;
                  }
              } else {
                  return;
              }
          }
          
          // 使用已有的更新语言文件函数，传递绝对路径
          const success = await updateLanguageFile(fullPath, i18nKey, newValue);
          
          if (success) {
              vscode.window.showInformationMessage(`已更新 ${langCode} 中的 "${i18nKey}"`);
              // 刷新装饰器以更新显示
              vscode.commands.executeCommand('i18n-swapper.refreshI18nDecorations');
          } else {
              vscode.window.showErrorMessage(`无法更新 ${langCode} 中的 "${i18nKey}"`);
          }
        } catch (error) {
          vscode.window.showErrorMessage(`编辑失败: ${error.message}`);
          console.error('编辑语言条目时出错:', error);
        }
      }),
      vscode.commands.registerCommand('i18n-swapper.openPanel', function() {
        try {
          // 获取当前编辑器
          const editor = vscode.window.activeTextEditor;
          let filePath = '';
          if (editor) {
            filePath = editor.document.uri.fsPath;
          }
          
          // 创建批量替换面板
          const panel = new BatchReplacementPanel(context, filePath);
          
          // 显示面板
          panel.show();
        } catch (error) {
          console.error('打开面板时出错:', error);
          vscode.window.showErrorMessage('打开国际化面板时出错: ' + error.message);
        }
      })
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
  }).catch(error => {
    console.error('初始化工作区设置时出错:', error);
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
        'i18n-swapper.tencentTranslation.languageMappings': defaultsConfig.tencentTranslation.languageMappings,
        'i18n-swapper.autoGenerateKeyFromText': defaultsConfig.autoGenerateKeyFromText,
        'i18n-swapper.autoGenerateKeyPrefix': defaultsConfig.autoGenerateKeyPrefix,
        'i18n-swapper.autoTranslateAllLanguages': defaultsConfig.autoTranslateAllLanguages,
        'i18n-swapper.missingKeyBorderWidth': defaultsConfig.missingKeyBorderWidth,
        'i18n-swapper.missingKeyBorderStyle': defaultsConfig.missingKeyBorderStyle,
        'i18n-swapper.missingKeyBorderColor': defaultsConfig.missingKeyBorderColor,
        'i18n-swapper.missingKeyBorderSpacing': defaultsConfig.missingKeyBorderSpacing,
          'i18n-swapper.excludeFiles': defaultsConfig.excludeFiles,
          'i18n-swapper.includeFiles': defaultsConfig.includeFiles,
          'i18n-swapper.SkipPrompt': defaultsConfig.SkipPrompt,
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

/**
 * 使用腾讯云翻译API翻译文本
 * @param {string} text 要翻译的文本
 * @param {string} targetLang 目标语言代码
 * @returns {Promise<string>} 翻译后的文本
 */
async function translateText(text, targetLang) {
    // 获取翻译配置
    const config = vscode.workspace.getConfiguration('i18n-swapper');
    const apiKey = config.get('tencentTranslation.apiKey');
    const apiSecret = config.get('tencentTranslation.apiSecret');
    const sourceLanguage = config.get('tencentTranslation.sourceLanguage');
    const region = config.get('tencentTranslation.region');
    if (!apiKey || !apiSecret) {
        vscode.window.showWarningMessage('腾讯云翻译 API 密钥未配置，请先配置');
        vscode.commands.executeCommand('i18n-swapper.openApiTranslationConfig');
        return null;
    }
    
    // 调用现有的翻译服务
    return require('./src/services/translationService').translateText(
        text, 
        sourceLanguage, // 源语言代码
        targetLang, 
        apiKey, 
        apiSecret, region
    );
}

/**
 * 更新语言文件中的翻译值
 * @param {string} filePath 语言文件路径
 * @param {string} i18nKey 国际化键
 * @param {string} translatedText 翻译后的文本
 * @returns {Promise<boolean>} 是否成功更新
 */
async function updateLanguageFile(filePath, i18nKey, translatedText) {
    try {
        const fs = require('fs');
        const path = require('path');
        
        // 确保文件路径存在
        if (!filePath) {
            console.error('文件路径为空');
            return false;
        }
        
        // 获取完整的绝对路径
        const fullPath = path.isAbsolute(filePath) 
            ? filePath 
            : path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, filePath);
        
        console.log(`处理语言文件: ${fullPath}`);
        
        let langObj = {};
        
        // 检查文件是否存在
        if (!fs.existsSync(fullPath)) {
            // 文件不存在，创建目录和新文件
            console.log(`语言文件不存在，将创建: ${fullPath}`);
            
            // 确保目录存在
            const dirPath = path.dirname(fullPath);
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
                console.log(`创建目录: ${dirPath}`);
            }
            
            // 创建空的JSON文件
            fs.writeFileSync(fullPath, JSON.stringify({}, null, 2), 'utf8');
            console.log(`创建空语言文件: ${fullPath}`);
            
            // 使用空对象作为初始内容
            langObj = {};
        } else {
            // 文件存在，读取内容
            try {
                const fileContent = await fs.promises.readFile(fullPath, 'utf8');
                langObj = JSON.parse(fileContent);
            } catch (readError) {
                console.error(`读取或解析语言文件失败: ${fullPath}`, readError);
                // 文件内容无效，使用空对象覆盖
                langObj = {};
            }
        }
        
        // 按路径分割键
        const keyPath = i18nKey.split('.');
        let current = langObj;
        
        // 导航到倒数第二层
        for (let i = 0; i < keyPath.length - 1; i++) {
            const key = keyPath[i];
            if (!current[key]) {
                current[key] = {};
            }
            current = current[key];
        }
        
        // 设置翻译值
        const lastKey = keyPath[keyPath.length - 1];
        current[lastKey] = translatedText;
        
        // 写回文件
        await fs.promises.writeFile(
            fullPath, 
            JSON.stringify(langObj, null, 2), 
            'utf8'
        );
        
        console.log(`成功更新语言文件: ${fullPath}`);
        return true;
    } catch (error) {
        console.error('更新语言文件出错:', error);
        vscode.window.showErrorMessage(`更新语言文件失败: ${error.message}`);
        return false;
    }
}

module.exports = {
  activate,
  deactivate
}; 