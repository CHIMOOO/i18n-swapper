const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const {
  translateTextToAllLanguages
} = require('../../services/translationService');
const {
  saveTranslationToFile
} = require('./languageFileManager');
const {
  generateKeyFromText,
  getLanguageName
} = require('./translationService');
const {
  translateText
} = require('../../services/translationService');
const defaultsConfig = require('../../config/defaultsConfig');

/**
 * 翻译面板服务
 * 负责处理面板中的翻译相关操作
 */
class TranslationPanelService {
  constructor() {
    // 构造函数不需要保存状态，使用传入的状态
  }

  /**
   * 翻译单个项目
   * 完全保留原有逻辑
   * @param {number} index 项目索引
   * @param {string} userInputKey 用户输入的键（可选）
   * @param {Object} state 当前状态（包含replacements, existingI18nCalls, scanMode等）
   * @param {Function} updatePanelContent 更新面板内容的回调函数
   */
  async translateItem(index, userInputKey = '', state, updatePanelContent) {
    let replacementsKeys = [];
    try {
      // 获取需要翻译的项目
      let item = state.replacements[index];
      if (!item) {
        throw new Error(`未找到索引 ${index} 处的项目`);
      }

      // 获取配置
      const config = vscode.workspace.getConfiguration('i18n-swapper');
      const apiKey = config.get('tencentTranslation.apiKey', '');
      const apiSecret = config.get('tencentTranslation.apiSecret', '');
      const region = config.get('tencentTranslation.region', 'ap-guangzhou');
      const sourceLanguage = config.get('tencentTranslation.sourceLanguage', 'zh');
      const languageMappings = config.get('tencentTranslation.languageMappings', []);

      // 检查API配置
      if (!apiKey || !apiSecret) {
        throw new Error('API密钥未配置，请先配置腾讯云翻译API密钥');
      }

      // 检查语言映射
      if (!languageMappings || languageMappings.length === 0) {
        throw new Error('未配置语言映射，请先配置语言映射');
      }

      // 使用用户提供的键名或生成一个
      let suggestedKey = userInputKey || '';

      // 如果没有提供键名，则生成一个
      if (!suggestedKey) {
        const autoGenerateKeyFromText = config.get('autoGenerateKeyFromText', defaultsConfig.autoGenerateKeyFromText);

        if (autoGenerateKeyFromText) {
          // 使用API翻译结果生成键名
          suggestedKey = await translateText.generateKeyFromTranslation(item.text);
        } else {
          // 使用简单哈希生成键名
          suggestedKey = generateKeyFromText(item.text);
        }
      }

      // 获取工作区路径
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        throw new Error('未找到工作区文件夹');
      }
      const rootPath = workspaceFolders[0].uri.fsPath;

      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: '翻译中...'
      }, async (progress) => {
        progress.report({
          message: `准备并发翻译到 ${languageMappings.length} 种语言...`
        });

        // 创建所有语言的翻译任务
        const translationTasks = languageMappings.map(async (mapping) => {
          try {
            if (mapping.languageCode === sourceLanguage) {
              // 源语言直接使用原文
              await saveTranslationToFile(path.join(rootPath, mapping.filePath), suggestedKey, item.text);
              return {
                languageCode: mapping.languageCode,
                success: true,
                text: item.text
              };
            } else {
              // 其他语言调用翻译API
              const translatedText = await translateText(
                item.text,
                sourceLanguage,
                mapping.languageCode,
                apiKey,
                apiSecret,
                region
              );
              await saveTranslationToFile(path.join(rootPath, mapping.filePath), suggestedKey, translatedText);
              return {
                languageCode: mapping.languageCode,
                success: true,
                text: translatedText
              };
            }
          } catch (error) {
            console.error(`翻译到 ${mapping.languageCode} 失败:`, error);
            return {
              languageCode: mapping.languageCode,
              success: false,
              error: error.message
            };
          }
        });

        // 并发执行所有翻译任务
        await Promise.all(translationTasks);
      });

      // 更新项的键值
      item.i18nKey = suggestedKey;

      // 更新面板内容
      if (typeof updatePanelContent === 'function') {
        await updatePanelContent();
      }

      return suggestedKey;
    } catch (error) {
      console.error('[翻译严重错误]:', error);
      vscode.window.showErrorMessage(`翻译失败: ${error.message}`);
      return null;
    }
  }

  /**
   * 保存翻译到文件
   * @param {string} filePath 文件路径
   * @param {string} key 国际化键
   * @param {string} value 翻译值
   * @param {Function} refreshPanel 刷新面板的回调函数
   */
  async saveTranslation(filePath, key, value, refreshPanel) {
    try {
      // 获取工作区根目录
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        throw new Error('未找到工作区文件夹');
      }
      const rootPath = workspaceFolders[0].uri.fsPath;

      // 构建绝对路径
      const absolutePath = path.isAbsolute(filePath) ?
        filePath :
        path.join(rootPath, filePath);

      // 调用语言文件管理服务保存翻译
      await saveTranslationToFile(absolutePath, key, value);

      vscode.window.showInformationMessage(`已保存翻译: ${key}`);

      // 刷新面板
      if (typeof refreshPanel === 'function') {
        await refreshPanel();
      }

      return true;
    } catch (error) {
      console.error('保存翻译出错:', error);
      throw error;
    }
  }

  /**
   * 打开API翻译配置
   */
  async openApiTranslationConfig() {
    try {
      // 调用命令打开API翻译配置面板
      await vscode.commands.executeCommand('i18n-swapper.openApiTranslationConfig');
    } catch (error) {
      console.error('打开API翻译配置面板出错:', error);
      vscode.window.showErrorMessage(`打开配置面板失败: ${error.message}`);
    }
  }

  /**
   * 展示语言选择器并创建语言文件
   * @param {Function} createOrSelectFiles 创建或选择语言文件的回调函数
   * @param {Function} analyzeAndLoadPanel 分析并加载面板的回调函数
   */
  async showLanguageSelector(createOrSelectFiles, analyzeAndLoadPanel) {
    await createOrSelectFiles();
    // 刷新分析
    if (typeof analyzeAndLoadPanel === 'function') {
      await analyzeAndLoadPanel();
    }
  }
}

module.exports = TranslationPanelService;