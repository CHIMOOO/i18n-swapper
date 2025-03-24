const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { translateTextToAllLanguages } = require('../../services/translationService');
const { saveTranslationToFile } = require('./languageFileManager');
const { generateKeyFromText, getLanguageName } = require('./translationService');
const { translateText } = require('../../services/translationService');
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
    if (state.scanMode === 'translated') {
      replacementsKeys = state.existingI18nCalls;
    } else if (state.scanMode === 'pending') {
      replacementsKeys = state.replacements;
    } else if (state.scanMode === 'all') {
      replacementsKeys = state.replacements.concat(state.existingI18nCalls);
    }

    if (index < 0 || index >= replacementsKeys.length) return;

    const item = replacementsKeys[index];
    if (!item.text) {
      item.text = await vscode.window.showInputBox({
        prompt: '请输入要翻译的文本',
        placeHolder: '无法识别此处文本，请手动输入',
        validateInput: input => {
          return input && input.trim() !== '' ? null : '文本不能为空';
        }
      });

      // 如果用户取消输入，则终止流程
      if (!item.text) {
        return null; // 返回 null 表示操作被取消
      }
    }
    if (!item || !item.text) return;

    try {
      console.log(`面板翻译项：索引=${index}, 文本="${item.text}", 用户键="${userInputKey}"`);

      // 获取配置
      const config = vscode.workspace.getConfiguration('i18n-swapper');
      const apiKey = config.get('tencentTranslation.apiKey', '');
      const apiSecret = config.get('tencentTranslation.apiSecret', '');
      const region = config.get('tencentTranslation.region', 'ap-guangzhou');
      const sourceLanguage = config.get('tencentTranslation.sourceLanguage', 'zh');
      const languageMappings = config.get('tencentTranslation.languageMappings', []);

      // 生成或使用提供的键名
      let suggestedKey = userInputKey || '';

      // 如果没有输入键名，则自动生成
      if (!suggestedKey) {
        const {
          generateKeyFromTranslation
        } = require('../../services/translationService');

        // 检查是否配置了自动翻译生成
        const autoGenerateKeyFromText = config.get('autoGenerateKeyFromText', defaultsConfig.autoGenerateKeyFromText);
        if (autoGenerateKeyFromText) {
          // 使用翻译服务生成键名
          suggestedKey = await generateKeyFromTranslation(item.text);
        } else {
          // 使用简单哈希生成
          suggestedKey = generateKeyFromText(item.text);
        }
      }

      // 保存到所有语言文件
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) throw new Error('未找到工作区');
      const rootPath = workspaceFolders[0].uri.fsPath;

      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: '翻译中...'
      }, async (progress) => {
        for (const mapping of languageMappings) {
          progress.report({
            message: `翻译为 ${getLanguageName(mapping.languageCode)}...`
          });

          if (mapping.languageCode === sourceLanguage) {
            // 源语言直接使用原文
            await saveTranslationToFile(path.join(rootPath, mapping.filePath), suggestedKey, item.text);
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
          }
        }
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