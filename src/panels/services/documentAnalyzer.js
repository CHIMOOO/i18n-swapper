const vscode = require('vscode');
const path = require('path');
const utils = require('../../utils');

/**
 * 分析文档，找出可能需要国际化的文本
 * @param {string} text 文档文本
 * @param {string} fileExtension 文件扩展名
 * @param {string[]} scanPatterns 要扫描的属性模式
 * @param {string[]} localesPaths 国际化文件路径
 * @param {vscode.TextDocument} document 文档对象 
 * @returns {Promise<Array>} 找到的替换项
 */
async function analyzeDocument(text, fileExtension, scanPatterns, localesPaths, document) {
  // 收集替换项
  const replacements = [];
  
  // 当 scanPatterns 为空且文件不是 JSON 时，提供默认推荐模式
  let patternsToUse = scanPatterns;
  if (patternsToUse.length === 0 && fileExtension !== '.json') {
    patternsToUse = ['label', 'value', 'placeholder', 'title', 'message', 'text'];
  }
  
  try {
    // 分析文档内容查找可能的国际化文本
    const textReplacements = utils.analyzeContent(
      text, 0, patternsToUse, utils.shouldBeInternationalized
    );
    replacements.push(...textReplacements);

    // 获取工作区根目录
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      vscode.window.showErrorMessage('未找到工作区文件夹');
      return replacements;
    }
    const rootPath = workspaceFolders[0].uri.fsPath;

    // 查找国际化键对应
    for (const item of replacements) {
      for (const relativePath of localesPaths) {
        // 加载国际化文件
        const filePath = path.join(rootPath, relativePath);
        const localeData = utils.loadLocaleFile(filePath);
        
        if (!localeData) continue;

        // 查找匹配的键
        const result = utils.findPathByValue(localeData, item.text);
        if (result) {
          // 记录找到的国际化键
          item.i18nKey = result;
          item.i18nFile = relativePath;
          break;
        }
      }
      
      // 为每个替换项添加范围信息
      if (document) {
        // 查找文本周围的引号
        const { hasQuotes, range } = utils.findQuotesAround(document, item);
        
        // 确保有正确的位置信息
        if (hasQuotes) {
          item.start = document.offsetAt(range.start); 
          item.end = document.offsetAt(range.end);
        }
        
        item.hasQuotes = hasQuotes;
        
        // 设置选中状态默认值
        item.selected = false;
      }
    }

    return replacements;
  } catch (error) {
    console.error('分析文档时出错:', error);
    throw error;
  }
}

module.exports = {
  analyzeDocument
}; 