const vscode = require('vscode');

/**
 * 分析当前上下文，生成正确的替换文本
 * @param {string} text 原始文本
 * @param {string} i18nKey 国际化键
 * @param {string} functionName 国际化函数名称
 * @param {string} codeQuote 使用的引号类型
 * @param {object} document 文档对象
 * @param {vscode.Position} position 位置
 * @returns {string} 替换文本
 */
function generateReplacementText(text, i18nKey, functionName, codeQuote, document, position) {
  if (!document || position === undefined) {
    return `${functionName}(${codeQuote}${i18nKey}${codeQuote})`;
  }

  try {
    const line = document.lineAt(position.line).text;
    const textBefore = line.substring(0, position.character);
    const textAfter = line.substring(position.character + text.length);
    
    // 判断是否在对象属性值中 (如 label: "文本")
    const isInObjectValue = /:\s*['"]?$/.test(textBefore) || 
                           /:/.test(textBefore.split('{').pop().trim());
    
    // 检查该行是否包含对象属性赋值
    if (isInObjectValue) {
      // 属性值引号处理 - 完全删除外部引号
      if ((textBefore.trim().endsWith(':') || textBefore.trim().endsWith(': ')) &&
          ((text.startsWith("'") && text.endsWith("'")) || 
           (text.startsWith('"') && text.endsWith('"')))) {
        // 特殊情况: 属性值紧跟冒号，且带有引号
        return `${functionName}(${codeQuote}${i18nKey}${codeQuote})`;
      } else if (textBefore.endsWith("'") && textAfter.startsWith("'")) {
        // 已有单引号包围，用t()替换内容
        return `${functionName}(${codeQuote}${i18nKey}${codeQuote})`;
      } else if (textBefore.endsWith('"') && textAfter.startsWith('"')) {
        // 已有双引号包围，用t()替换内容
        return `${functionName}(${codeQuote}${i18nKey}${codeQuote})`;
      }
    }
    
    // Vue 模板中双花括号表达式
    if ((textBefore.trim().endsWith('{{') || textBefore.trim().endsWith('{{ ')) && 
        (textAfter.trim().startsWith('}}') || textAfter.trim().startsWith(' }}'))) {
      return ` ${functionName}(${codeQuote}${i18nKey}${codeQuote}) `;
    }
    
    // 如果文本本身带引号，保留外部引号
    if ((text.startsWith("'") && text.endsWith("'")) || 
        (text.startsWith('"') && text.endsWith('"'))) {
      // 引号类型
      const quoteChar = text.charAt(0);
      // 引号内的文本
      const innerText = text.substring(1, text.length - 1);
      return `${quoteChar}${functionName}(${codeQuote}${i18nKey}${codeQuote})${quoteChar}`;
    }
    
    // 其他情况，使用标准替换格式
    return `${functionName}(${codeQuote}${i18nKey}${codeQuote})`;
  } catch (error) {
    console.error("生成替换文本时出错:", error);
    // 出错时使用最安全的格式
    return `${functionName}(${codeQuote}${i18nKey}${codeQuote})`;
  }
}

/**
 * 查找文本周围的引号，扩展替换范围
 * @param {Object} document VSCode文档对象
 * @param {Object} item 替换项
 * @returns {Object} 包含扩展范围的对象
 */
function findQuotesAround(document, item) {
  try {
    // 原始范围
    const originalRange = new vscode.Range(
      document.positionAt(item.start),
      document.positionAt(item.end)
    );

    // 获取当前行文本
    const line = document.lineAt(document.positionAt(item.start).line).text;
    
    // 获取替换文本前后的字符
    const charBefore = line.charAt(document.positionAt(item.start).character - 1);
    const charAfter = line.charAt(document.positionAt(item.end).character);
    
    // 检查是否被引号包围
    if ((charBefore === "'" && charAfter === "'") || 
        (charBefore === '"' && charAfter === '"')) {
      // 扩展范围，包括引号
      const expandedRange = new vscode.Range(
        new vscode.Position(originalRange.start.line, originalRange.start.character - 1),
        new vscode.Position(originalRange.end.line, originalRange.end.character + 1)
      );
      
      return {
        hasQuotes: true,
        range: expandedRange,
        originalRange: originalRange,
        quoteType: charBefore
      };
    }
    
    return {
      hasQuotes: false,
      range: originalRange
    };
  } catch (error) {
    console.error('查找引号时出错:', error);
    return {
      hasQuotes: false,
      range: new vscode.Range(
        document.positionAt(item.start),
        document.positionAt(item.end)
      )
    };
  }
}

module.exports = {
  generateReplacementText,
  findQuotesAround
}; 