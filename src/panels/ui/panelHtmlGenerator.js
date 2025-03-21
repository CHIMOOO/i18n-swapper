/**
 * 面板HTML生成器
 * 将面板所需的HTML生成为一个完整的页面
 */
const vscode = require('vscode');
const { escapeHtml } = require('./utils/htmlUtils');
const { getPanelStyles } = require('./styles/panelStyles');
const { getPanelScripts } = require('./scripts/panelScripts');
const { generatePanelBody } = require('./components/panelTemplate');
const { LANGUAGE_NAMES } = require('../../utils/language-mappings');
const defaultsConfig = require('../../config/defaultsConfig');

/**
 * 生成面板HTML内容
 * @param {Array} scanPatterns 扫描模式列表
 * @param {Array} replacements 替换项列表
 * @param {Array} localesPaths 本地化文件路径列表
 * @param {Object} context 上下文对象，包含decorationStyle等配置
 * @param {boolean} isConfigExpanded 配置部分是否展开
 * @param {Array} languageMappings 语言映射配置
 * @param {Array} existingI18nCalls 已存在的国际化调用
 * @param {boolean} scanAllFiles 是否扫描所有文件
 * @param {string} currentFilePath 当前文件路径
 */
function getPanelHtml(scanPatterns, replacements, localesPaths, context = {}, isConfigExpanded = false, languageMappings = [], existingI18nCalls = [], scanAllFiles = false, currentFilePath = '') {
  // 获取配置
  const config = vscode.workspace.getConfiguration('i18n-swapper');
  const decorationStyle = context.decorationStyle || config.get('decorationStyle', 'suffix');
  const showFullFormInEditMode = context.showFullFormInEditMode !== undefined ?
    context.showFullFormInEditMode : config.get('showFullFormInEditMode', true);
  const suffixStyle = context.suffixStyle || config.get('suffixStyle', {});
  const inlineStyle = context.inlineStyle || config.get('inlineStyle', {});

  // 添加新的翻译功能设置项
  const autoGenerateKeyFromText = context.autoGenerateKeyFromText !== undefined ?
    context.autoGenerateKeyFromText : config.get('autoGenerateKeyFromText', true);
  const autoGenerateKeyPrefix = context.autoGenerateKeyPrefix ||
    config.get('autoGenerateKeyPrefix', '_iw');
  const autoTranslateAllLanguages = context.autoTranslateAllLanguages !== undefined ?
    context.autoTranslateAllLanguages : config.get('autoTranslateAllLanguages', true);

  // 获取输出国际化函数名称
  const outputI18nFunctionName = context.outputI18nFunctionName || config.get('functionName', 't');

  // 从上下文中获取扫描模式
  const scanMode = context.scanMode || 'pending';

  // 更新context对象，确保所有需要的属性都在其中
  const updatedContext = {
    ...context,
    decorationStyle,
    showFullFormInEditMode,
    suffixStyle,
    inlineStyle,
    autoGenerateKeyFromText,
    autoGenerateKeyPrefix,
    autoTranslateAllLanguages,
    outputI18nFunctionName,
    scanMode
  };

  // 完整的HTML页面
  return `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>批量替换国际化</title>
      <style>
        ${getPanelStyles()}
      </style>
    </head>
    <body>
      ${generatePanelBody(
        scanPatterns, 
        replacements, 
        localesPaths, 
        updatedContext, 
        isConfigExpanded, 
        languageMappings, 
        existingI18nCalls, 
        scanAllFiles, 
        currentFilePath, 
        LANGUAGE_NAMES,
        config
      )}
      
      <script>
        ${getPanelScripts(languageMappings, LANGUAGE_NAMES)}
      </script>
    </body>
    </html>
  `;
}

module.exports = {
  getPanelHtml
}; 