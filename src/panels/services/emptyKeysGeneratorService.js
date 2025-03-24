/**
 * 空键生成服务
 * 处理自动生成国际化键名相关功能
 */

const vscode = require('vscode');
const path = require('path');
const {
  generateKeyFromText,
  generateKeyFromTranslation,
  translateTextToAllLanguages
} = require('../../services/translationService');
const { saveTranslationToFile } = require('./languageFileManager');
const defaultsConfig = require('../../config/defaultsConfig');
const utils = require('../../utils');
/**
 * 为空的国际化键生成键名
 * @param {Array} indexes 需要生成键名的项目索引
 * @param {Array} replacements 替换项数组
 * @param {Object} panelInstance 面板实例，用于更新UI和获取配置
 * @returns {Promise<Object>} 成功和失败的统计
 */
async function generateEmptyKeys(indexes, replacements, panelInstance) {
  try {
    // 获取配置信息
    const config = vscode.workspace.getConfiguration('i18n-swapper');
            // 使用PromptManager来处理是否翻译生成键名的提示
            let autoGenerateKeyFromText = await utils.PromptManager.promptForKeyGeneration();
            // 使用PromptManager来处理是否自动翻译到所有语言文件的提示
            let autoTranslateAllLanguages = await utils.PromptManager.promptForAutoTranslate();
    
    let successCount = 0;
    let failedCount = 0;
    
    // 显示进度条
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: "生成国际化键",
      cancellable: false
    }, async (progress) => {
      const total = indexes.length;
      
      // 处理每个空键
      for (let i = 0; i < indexes.length; i++) {
        const index = indexes[i];
        const item = replacements[index];
        
        if (!item) continue;
        
        try {
          progress.report({ 
            message: `处理 ${i+1}/${total}: ${item.text.substring(0, 20)}${item.text.length > 20 ? '...' : ''}`,
            increment: (100 / total)
          });
          
          // 生成键名
          let generatedKey = '';
          const autoGenerateKeyPrefix = panelInstance.autoGenerateKeyPrefix;
          
          if (autoGenerateKeyFromText) {
            // 使用API生成有意义的键名
            generatedKey = await generateKeyFromTranslation(item.text, autoGenerateKeyPrefix);
          } else {
            // 使用简单算法生成键名
            generatedKey = generateKeyFromText(item.text);
            if (autoGenerateKeyPrefix) {
              generatedKey = `${autoGenerateKeyPrefix}.${generatedKey}`;
            }
          }
          
          // 更新项目的键名
          item.i18nKey = generatedKey;
          
          // 翻译到所有语言
          if (autoTranslateAllLanguages) {
            await translateTextToAllLanguages(item.text, generatedKey);
          } else {
            // 仅翻译到源语言
            const config = vscode.workspace.getConfiguration('i18n-swapper');
            const languageMappings = config.get('tencentTranslation.languageMappings', defaultsConfig.tencentTranslation.languageMappings);
            const sourceLanguage = config.get('tencentTranslation.sourceLanguage', 'zh');
            
            // 找到源语言文件
            const sourceMapping = languageMappings.find(m => m.languageCode === sourceLanguage);
            if (sourceMapping) {
              // 获取工作区目录
              const workspaceFolders = vscode.workspace.workspaceFolders;
              if (workspaceFolders) {
                const rootPath = workspaceFolders[0].uri.fsPath;
                
                // 保存到源语言文件
                await saveTranslationToFile(
                  path.join(rootPath, sourceMapping.filePath),
                  generatedKey,
                  item.text
                );
              }
            }
          }
          
          // 更新成功计数
          successCount++;
        } catch (error) {
          console.error(`生成键名失败: ${error.message}`);
          failedCount++;
        }
      }
    });
    
    return {
      success: successCount,
      failed: failedCount
    };
    
  } catch (error) {
    vscode.window.showErrorMessage(`生成国际化键名失败: ${error.message}`);
    throw error;
  }
}

module.exports = {
  generateEmptyKeys
}; 