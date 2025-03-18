const i18nHelper = require('./i18n-helper');
const textAnalyzer = require('./text-analyzer');
const textReplacer = require('./text-replacer');
const vscode = require('vscode');
/**
 * 根据路径设置对象中的值
 * @param {Object} obj 目标对象
 * @param {string} path 键路径，如 'a.b.c'
 * @param {any} value 要设置的值
 */
function setValueByPath(obj, path, value) {
  if (!obj || typeof obj !== 'object') {
    return;
  }
  
  const keys = path.split('.');
  let current = obj;
  
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!current[key] || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }
  
  current[keys[keys.length - 1]] = value;
}

function findI18nCalls(text, functionName = 't') {
  // 使用词边界以确保精确匹配
  const regex = new RegExp(`(\\$?\\b${functionName}\\b)\\s*\\(\\s*(['"])([^'"]+)\\2\\s*\\)`, 'g');
  // ...其余代码
}

/**
 * 检查是否在Vue模板中的属性值位置
 * @param {vscode.TextDocument} document 文档对象
 * @param {vscode.Position} position 位置信息
 * @returns {{ isVueAttr: boolean, attrInfo: { start: number, end: number, name: string } | null }}
 */
function checkVueTemplateAttr(document, position) {
  try {
    // 检查是否是Vue文件
    const isVueFile = document.fileName.toLowerCase().endsWith('.vue');
    if (!isVueFile) {
      return { isVueAttr: false, attrInfo: null };
    }

    // 检查是否在template标签内
    const documentText = document.getText();
    const templateMatch = /<template[^>]*>([\s\S]*?)<\/template>/g.exec(documentText);
    if (!templateMatch) {
      return { isVueAttr: false, attrInfo: null };
    }

    const templateStartOffset = templateMatch.index;
    const templateEndOffset = templateMatch.index + templateMatch[0].length;
    const positionOffset = document.offsetAt(position);

    if (positionOffset < templateStartOffset || positionOffset > templateEndOffset) {
      return { isVueAttr: false, attrInfo: null };
    }

    // 获取当前行和光标在行内的位置
    const line = document.lineAt(position.line).text;
    const lineStartOffset = document.offsetAt(new vscode.Position(position.line, 0));
    const posInLine = positionOffset - lineStartOffset;

    // 匹配属性
    const attrRegex = /(\s+)([a-zA-Z0-9\-_]+)=("[^"]*"|'[^']*')/g;
    let attrMatch;

    while ((attrMatch = attrRegex.exec(line)) !== null) {
      const matchStart = attrMatch.index + lineStartOffset;
      const matchEnd = matchStart + attrMatch[0].length;

      // 检查光标是否在属性值范围内
      if (positionOffset >= matchStart && positionOffset <= matchEnd) {
        const attrName = attrMatch[2];
        
        // 如果已经是绑定属性，则不处理
        if (attrName.startsWith(':') || attrName.startsWith('v-bind:')) {
          return { isVueAttr: false, attrInfo: null };
        }

        return {
          isVueAttr: true,
          attrInfo: {
            start: matchStart,
            end: matchEnd,
            name: attrName
          }
        };
      }
    }

    return { isVueAttr: false, attrInfo: null };
  } catch (error) {
    console.error('检查Vue模板属性时出错:', error);
    return { isVueAttr: false, attrInfo: null };
  }
}

/**
 * 生成替换文本
 * @param {string} selectedText 选中的文本
 * @param {string} i18nKey 国际化键
 * @param {string} functionName 国际化函数名
 * @param {string} quote 引号类型
 * @param {vscode.TextDocument} document 文档对象
 * @param {vscode.Position} position 位置信息
 * @returns {string} 替换文本
 */
function generateReplacementText(selectedText, i18nKey, functionName, quote, document, position) {
  const baseReplacement = `${functionName}(${quote}${i18nKey}${quote})`;
  
  // 检查是否在Vue模板属性中
  const { isVueAttr, attrInfo } = checkVueTemplateAttr(document, position);
  
  const config = vscode.workspace.getConfiguration('i18n-swapper');
  const autoAddColonInVue = config.get('autoAddColonInVueTemplate', true); // 默认启用

  if (!autoAddColonInVue) {
    return baseReplacement;
  }
  
  if (isVueAttr && attrInfo) {
    // 在Vue模板中使用与配置相反的引号类型
    // 如果配置是单引号，这里用双引号；如果配置是双引号，这里用单引号
    const templateQuote = quote === '"' ? "'" : '"';
    return ` :${attrInfo.name}=${templateQuote}${baseReplacement}${templateQuote}`;
  }
  
  return baseReplacement;
}

module.exports = {
  ...i18nHelper,
  ...textAnalyzer,
  ...textReplacer,
  setValueByPath,
  generateReplacementText,
  checkVueTemplateAttr
}; 