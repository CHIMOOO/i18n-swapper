const vscode = require('vscode');
const utils = require('../../utils');

/**
 * 生成替换内容
 * @param {string} i18nKey 国际化键
 * @param {string} fileName 文件名
 * @returns {string} 替换文本
 */
function generateReplacement(i18nKey, fileName) {
  if (!i18nKey) return '';
  
  // 获取配置
  const config = vscode.workspace.getConfiguration('i18n-swapper');
  const configQuoteType = config.get('quoteType', 'single');
  const functionName = config.get('functionName', 't');
  const codeQuote = configQuoteType === 'single' ? "'" : '"';
  
  // 基本替换模板
  let replacement = `${functionName}(${codeQuote}${i18nKey}${codeQuote})`;
  
  // 根据文件类型进行特定处理
  if (fileName) {
    const ext = fileName.toLowerCase();
    
    // Vue 文件特殊处理
    if (ext.endsWith('.vue')) {
      // 这里可以根据需要处理Vue文件的特殊情况
    } 
    // 其他类型文件的特殊处理可以在这里添加
  }
  
  return replacement;
}

/**
 * 在文档中执行替换
 * @param {vscode.TextDocument} document 文档对象
 * @param {Array} items 要替换的项目数组 
 * @returns {Promise<number>} 替换成功的项目数
 */
async function performReplacements(document, items) {
  if (!document || !items || items.length === 0) {
    return 0;
  }
  
  try {
    const editor = vscode.window.activeTextEditor;
    
    // 放宽检查条件，仅要求有活动编辑器
    if (!editor) {
      throw new Error('找不到活动的编辑器窗口');
    }
    
    // 确保编辑器文档与期望的文档匹配
    if (editor.document.uri.fsPath !== document.uri.fsPath) {
      // 自动打开正确的文档
      const doc = await vscode.workspace.openTextDocument(document.uri);
      await vscode.window.showTextDocument(doc);
      
      // 重新获取编辑器引用
      const newEditor = vscode.window.activeTextEditor;
      if (!newEditor || newEditor.document.uri.fsPath !== document.uri.fsPath) {
        throw new Error('无法切换到正确的文档，请手动打开文档后重试');
      }
    }
    
    // 筛选有效的替换项
    const validItems = items.filter(item => item && item.i18nKey);
    
    if (validItems.length === 0) {
      return 0;
    }
    
    console.log(`准备替换 ${validItems.length} 个项目`);
    
    // 执行替换
    let successCount = 0;
    
    await editor.edit(editBuilder => {
      for (const item of validItems) {
        try {
          // 确保有正确的 start 和 end 属性
          if (typeof item.start !== 'number' || typeof item.end !== 'number') {
            console.warn('项目缺少位置信息:', item);
            continue;
          }
          
          // 创建范围
          const range = new vscode.Range(
            document.positionAt(item.start),
            document.positionAt(item.end)
          );
          
          // 获取配置
          const config = vscode.workspace.getConfiguration('i18n-swapper');
          const configQuoteType = config.get('quoteType', 'single');
          const functionName = config.get('functionName', 't');
          const codeQuote = configQuoteType === 'single' ? "'" : '"';
          
          // 生成替换文本
          const replacementResult = utils.replaceFn(
            item.text,
            item.i18nKey,
            functionName,
            codeQuote,
            document,
            document.positionAt(item.start)
          );
          let replacement = replacementResult.replacementText;
          
          // 执行替换
          editBuilder.replace(replacementResult.isVueAttr ? replacementResult.range : range, replacement);
          successCount++;
          console.log(`成功替换: "${item.text}" -> ${replacement}`);
        } catch (itemError) {
          console.error(`替换项 "${item.text}" 失败:`, itemError);
        }
      }
    });
    
    console.log(`替换完成，成功 ${successCount} 项`);
    return successCount;
  } catch (error) {
    console.error('执行替换操作时出错:', error);
    throw error;
  }
}

module.exports = {
  generateReplacement,
  performReplacements
}; 