const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const utils = require('../utils');
const { saveTranslationToFile } = require('../panels/services/languageFileManager');
const { translateText, getLanguageName } = require('../panels/services/translationService');
const defaultsConfig = require('../config/defaultsConfig');

/**
 * 从翻译结果自动生成键名
 * @param {string} text 原始文本
 * @param {string} prefix 键名前缀
 * @param {Object} options 可选参数（apiKey, apiSecret等）
 * @returns {Promise<string>} 生成的键名
 */
async function generateKeyFromTranslation(text, prefix = null, options = {}) {
  // 获取配置
  const config = vscode.workspace.getConfiguration('i18n-swapper');
  
  // 使用参数中的值或从配置中获取值
  const apiKey = options.apiKey || config.get('tencentTranslation.apiKey', '');
  const apiSecret = options.apiSecret || config.get('tencentTranslation.apiSecret', '');
  const region = options.region || config.get('tencentTranslation.region', 'ap-guangzhou');
  const autoGenerateKeyPrefix = prefix || config.get('autoGenerateKeyPrefix', defaultsConfig.autoGenerateKeyPrefix);
  
  try {
    // 检查API配置是否完整
    if (!apiKey || !apiSecret) {
      throw new Error('腾讯云翻译API密钥未配置，请在设置中配置API密钥');
    }
    
    console.log(`[自动生成键名] 正在翻译文本: "${text}"`);
    
    // 调用腾讯云翻译API，将中文翻译为英文
    const translation = await translateText(
      text,
      'auto', // 源语言设为自动检测
      'en',   // 目标语言为英文
      apiKey,
      apiSecret,
      region
    );
    
    if (translation) {
      // 将翻译结果格式化为键名
      const translatedText = translation;
      console.log(`[自动生成键名] 翻译结果: "${translatedText}"`);
      
      // 处理翻译结果，生成合适的键名格式
      const formattedKey = translatedText
        .toLowerCase() // 转小写
        .trim() // 去除两端空格
        .replace(/[^\w\s]/gi, '') // 移除特殊字符
        .replace(/\s+/g, '_') // 空格替换为下划线
        .replace(/_+/g, '_'); // 多个下划线合并为一个
      
      // 生成完整键名（添加前缀）
      const suggestedKey = `${autoGenerateKeyPrefix}.${formattedKey}`;
      console.log(`[自动生成键名] 生成的键名: "${suggestedKey}"`);
      return suggestedKey;
    } else {
      throw new Error('翻译结果无效');
    }
  } catch (error) {
    console.error('[自动生成键名] 失败:', error);
    if (options.showWarning !== false) {
      vscode.window.showWarningMessage(`自动生成键名失败: ${error.message}，将使用默认生成方法`);
    }
    // 失败时继续使用默认的键名生成方法
    return generateKeyFromText(text);
  }
}

/**
 * 翻译文本并保存到所有语言文件
 * @param {string} text 待翻译文本
 * @param {string} userInputKey 用户输入的键名，如果为空则自动生成
 * @param {Object} documentInfo 文档相关信息，可选
 * @returns {Promise<Object>} 包含键名和翻译结果的信息
 */
async function translateTextToAllLanguages(text, userInputKey = '', documentInfo = null) {
  if (!text) {
    throw new Error('待翻译文本不能为空');
  }

  try {
    console.log(`[翻译开始] 文本: "${text}"`);

    // 获取腾讯翻译API配置
    const config = vscode.workspace.getConfiguration('i18n-swapper');
    const apiKey = config.get('tencentTranslation.apiKey', '');
    const apiSecret = config.get('tencentTranslation.apiSecret', '');
    const region = config.get('tencentTranslation.region', 'ap-guangzhou');
    const sourceLanguage = config.get('tencentTranslation.sourceLanguage', 'zh');

    // 使用参数传入的键名或生成一个新的
    let suggestedKey = userInputKey || '';

    // 如果没有输入键名，则生成一个
    if (!suggestedKey) {
      const autoGenerateKeyFromText = config.get('autoGenerateKeyFromText', defaultsConfig.autoGenerateKeyFromText);
      if (autoGenerateKeyFromText) {
        // 使用新的函数生成键名
        suggestedKey = await generateKeyFromTranslation(text);
      } else {
        // 使用默认方法生成键名
        suggestedKey = generateKeyFromText(text);
      }
    }

    console.log(`[翻译] 使用键名: ${suggestedKey}, 源语言: ${sourceLanguage}`);

    // 获取语言映射
    const languageMappings = config.get('tencentTranslation.languageMappings', defaultsConfig.tencentTranslation.languageMappings);
    console.log(`[翻译] 语言映射配置: ${JSON.stringify(languageMappings)}`);

    // 无法继续翻译
    if (!languageMappings || languageMappings.length === 0) {
      throw new Error('未配置语言映射，请先在API翻译配置中添加语言映射');
    }

    const results = {};

    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: '翻译中...',
      cancellable: false
    }, async (progress) => {
      // 检查API配置
      if (!apiKey || !apiSecret) {
        throw new Error('未配置腾讯翻译API密钥，请先在API翻译配置中设置');
      }

      // 获取工作区目录
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        throw new Error('未找到工作区文件夹');
      }
      const rootPath = workspaceFolders[0].uri.fsPath;

      // 遍历所有目标语言进行翻译
      for (const mapping of languageMappings) {
        try {
          progress.report({
            message: `翻译为 ${getLanguageName(mapping.languageCode)}...`
          });

          // 如果是源语言，直接使用原文
          if (mapping.languageCode === sourceLanguage) {
            await saveTranslationToFile(
              path.join(rootPath, mapping.filePath),
              suggestedKey,
              text
            );
            results[mapping.languageCode] = text;
            continue;
          }

          // 调用翻译API
          const translatedText = await translateText(
            text,
            sourceLanguage,
            mapping.languageCode,
            apiKey,
            apiSecret,
            region
          );

          console.log(`[翻译结果] ${mapping.languageCode}: "${translatedText}"`);

          // 保存翻译结果
          await saveTranslationToFile(
            path.join(rootPath, mapping.filePath),
            suggestedKey,
            translatedText
          );
          
          // 记录翻译结果
          results[mapping.languageCode] = translatedText;
        } catch (error) {
          console.error(`翻译到 ${mapping.languageCode} 失败:`, error);
          vscode.window.showErrorMessage(`翻译到 ${getLanguageName(mapping.languageCode)} 失败: ${error.message}`);
          results[mapping.languageCode] = null;
        }
      }
    });

    vscode.window.showInformationMessage(`已生成键名 "${suggestedKey}" 并保存翻译`);
    
    return {
      key: suggestedKey,
      results: results
    };
  } catch (error) {
    console.error('[翻译严重错误]:', error);
    vscode.window.showErrorMessage(`翻译失败: ${error.message}`);
    throw error;
  }
}

/**
 * 从文本生成国际化键名
 * @param {string} text 源文本
 * @returns {string} 生成的键名
 */
function generateKeyFromText(text) {
  if (!text) return '';
  
  // 获取配置的前缀
  const config = vscode.workspace.getConfiguration('i18n-swapper');
  const prefix = config.get('autoGenerateKeyPrefix', '_iw');
  
  // 从文本生成简短的哈希
  const hash = simpleHash(text).toString(16).substring(0, 6);
  
  return `${prefix}.${hash}`;
}

/**
 * 简单的哈希函数
 * @param {string} str 输入字符串
 * @returns {number} 哈希值
 */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

module.exports = {
  translateTextToAllLanguages,
  generateKeyFromText,
  generateKeyFromTranslation,
  translateText,
  getLanguageName
}; 