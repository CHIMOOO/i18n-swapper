const vscode = require('vscode');

// /**
//  * 分析当前上下文，生成正确的替换文本
//  * @param {string} text 原始文本
//  * @param {string} i18nKey 国际化键
//  * @param {string} functionName 国际化函数名称
//  * @param {string} codeQuote 使用的引号类型
//  * @param {object} document 文档对象
//  * @param {vscode.Position} position 位置
//  * @returns {string} 替换文本
//  */
// function generateReplacementText(text, i18nKey, functionName, codeQuote, document, position) {
//   if (!document || position === undefined) {
//     return `${functionName}(${codeQuote}${i18nKey}${codeQuote})`;
//   }

//   try {
//     const line = document.lineAt(position.line).text;
//     const textBefore = line.substring(0, position.character);
//     const textAfter = line.substring(position.character + text.length);

//     // 判断是否在对象属性值中 (如 label: "文本")
//     const isInObjectValue = /:\s*['"]?$/.test(textBefore) || 
//                            /:/.test(textBefore.split('{').pop().trim());

//     // 检查该行是否包含对象属性赋值
//     if (isInObjectValue) {
//       // 属性值引号处理 - 完全删除外部引号
//       if ((textBefore.trim().endsWith(':') || textBefore.trim().endsWith(': ')) &&
//           ((text.startsWith("'") && text.endsWith("'")) || 
//            (text.startsWith('"') && text.endsWith('"')))) {
//         // 特殊情况: 属性值紧跟冒号，且带有引号
//         return `${functionName}(${codeQuote}${i18nKey}${codeQuote})`;
//       } else if (textBefore.endsWith("'") && textAfter.startsWith("'")) {
//         // 已有单引号包围，用t()替换内容
//         return `${functionName}(${codeQuote}${i18nKey}${codeQuote})`;
//       } else if (textBefore.endsWith('"') && textAfter.startsWith('"')) {
//         // 已有双引号包围，用t()替换内容
//         return `${functionName}(${codeQuote}${i18nKey}${codeQuote})`;
//       }
//     }

//     // Vue 模板中双花括号表达式
//     if ((textBefore.trim().endsWith('{{') || textBefore.trim().endsWith('{{ ')) && 
//         (textAfter.trim().startsWith('}}') || textAfter.trim().startsWith(' }}'))) {
//       return ` ${functionName}(${codeQuote}${i18nKey}${codeQuote}) `;
//     }

//     // 如果文本本身带引号，保留外部引号
//     if ((text.startsWith("'") && text.endsWith("'")) || 
//         (text.startsWith('"') && text.endsWith('"'))) {
//       // 引号类型
//       const quoteChar = text.charAt(0);
//       // 引号内的文本
//       const innerText = text.substring(1, text.length - 1);
//       return `${quoteChar}${functionName}(${codeQuote}${i18nKey}${codeQuote})${quoteChar}`;
//     }

//     // 其他情况，使用标准替换格式
//     return `${functionName}(${codeQuote}${i18nKey}${codeQuote})`;
//   } catch (error) {
//     console.error("生成替换文本时出错:", error);
//     // 出错时使用最安全的格式
//     return `${functionName}(${codeQuote}${i18nKey}${codeQuote})`;
//   }
// }

// /**
//  * 查找文本周围的引号，扩展替换范围
//  * @param {Object} document VSCode文档对象
//  * @param {Object} item 替换项
//  * @returns {Object} 包含扩展范围的对象
//  */
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

function generateReplacementText(selectedText, i18nKey, functionName, quote, document, position) {
  const baseReplacement = `${functionName}(${quote}${i18nKey}${quote})`;

  // 检查是否在Vue模板属性中
  const {
    isVueAttr,
    attrInfo
  } = checkVueTemplateAttr(document, position);

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

function checkVueTemplateAttr(document, position) {
  try {
    // 检查是否是Vue文件
    const isVueFile = document.fileName.toLowerCase().endsWith('.vue');
    if (!isVueFile) {
      return {
        isVueAttr: false,
        attrInfo: null
      };
    }

    // 检查是否在template标签内
    const documentText = document.getText();
    const templateMatch = /<template[^>]*>([\s\S]*?)<\/template>/g.exec(documentText);
    if (!templateMatch) {
      return {
        isVueAttr: false,
        attrInfo: null
      };
    }

    const templateStartOffset = templateMatch.index;
    const templateEndOffset = templateMatch.index + templateMatch[0].length;
    const positionOffset = document.offsetAt(position);

    if (positionOffset < templateStartOffset || positionOffset > templateEndOffset) {
      return {
        isVueAttr: false,
        attrInfo: null
      };
    }

    // 获取当前行和光标在行内的位置
    const line = document.lineAt(position.line).text;
    const lineStartOffset = document.offsetAt(new vscode.Position(position.line, 0));
    const posInLine = positionOffset - lineStartOffset;

    // 修改：匹配普通属性和绑定属性
    // 同时匹配 name="value", :name="value" 和 v-bind:name="value" 三种模式
    const attrRegex = /(\s+)((?:v-bind:)?[a-zA-Z0-9\-_:]+)=("[^"]*"|'[^']*')/g;
    let attrMatch;

    while ((attrMatch = attrRegex.exec(line)) !== null) {
      const matchStart = attrMatch.index + lineStartOffset;
      const matchEnd = matchStart + attrMatch[0].length;

      // 检查光标是否在属性值范围内
      if (positionOffset >= matchStart && positionOffset <= matchEnd) {
        let attrName = attrMatch[2];
        const isBindingAttr = attrName.startsWith(':') || attrName.startsWith('v-bind:');
        
        // 如果是绑定属性，提取实际属性名
        if (isBindingAttr) {
          attrName = attrName.startsWith(':') ? attrName.substring(1) : attrName.substring(7);
        }

        return {
          isVueAttr: true,
          attrInfo: {
            start: matchStart,
            end: matchEnd,
            name: attrName,
            isBindingAttr: isBindingAttr
          }
        };
      }
    }

    return {
      isVueAttr: false,
      attrInfo: null
    };
  } catch (error) {
    console.error('检查Vue模板属性时出错:', error);
    return {
      isVueAttr: false,
      attrInfo: null
    };
  }
}

/**
 * 检查是否在Vue模板标签内容中
 * @param {vscode.TextDocument} document 文档对象
 * @param {vscode.Position} position 位置
 * @returns {Object} 包含检查结果的对象
 */
function checkVueTemplateContent(document, position) {
  try {
    // 检查是否是Vue文件
    const isVueFile = document.fileName.toLowerCase().endsWith('.vue');
    if (!isVueFile) {
      return {
        isVueContent: false,
        contentInfo: null
      };
    }

    // 检查是否在template标签内
    const documentText = document.getText();
    const templateMatch = /<template[^>]*>([\s\S]*?)<\/template>/g.exec(documentText);
    if (!templateMatch) {
      return {
        isVueContent: false,
        contentInfo: null
      };
    }

    const templateStartOffset = templateMatch.index;
    const templateEndOffset = templateMatch.index + templateMatch[0].length;
    const positionOffset = document.offsetAt(position);

    if (positionOffset < templateStartOffset || positionOffset > templateEndOffset) {
      return {
        isVueContent: false,
        contentInfo: null
      };
    }

    // 获取当前位置的前后文本
    const textBefore = documentText.substring(0, positionOffset);
    const textAfter = documentText.substring(positionOffset);

    // 向前查找最近的 > 和 <
    const lastOpenBracket = textBefore.lastIndexOf('<');
    const lastCloseBracket = textBefore.lastIndexOf('>');

    // 向后查找最近的 < 和 >
    const nextOpenBracket = textAfter.indexOf('<');
    const nextCloseBracket = textAfter.indexOf('>');

    // 如果当前位置在标签内容中
    if (lastCloseBracket > lastOpenBracket && 
        nextOpenBracket !== -1 && 
        (nextCloseBracket === -1 || nextOpenBracket < nextCloseBracket)) {
      
      // 获取标签前缀和后缀
      const tagPrefix = textBefore.substring(lastCloseBracket + 1);
      const tagSuffix = textAfter.substring(0, nextOpenBracket);
      
      // 检查是否已经是插值表达式 {{}}
      const isAlreadyInterpolation = 
        (tagPrefix.trim().endsWith('{{') || tagPrefix.includes('{{ ')) && 
        (tagSuffix.trim().startsWith('}}') || tagSuffix.includes(' }}'));
      
      if (isAlreadyInterpolation) {
        return {
          isVueContent: false, // 不需要处理已经是插值表达式的内容
          contentInfo: null
        };
      }
      
      return {
        isVueContent: true,
        contentInfo: {
          start: document.offsetAt(position),
          end: document.offsetAt(position) + tagSuffix.indexOf('<')
        }
      };
    }

    return {
      isVueContent: false,
      contentInfo: null
    };
  } catch (error) {
    console.error('检查Vue模板内容时出错:', error);
    return {
      isVueContent: false,
      contentInfo: null
    };
  }
}

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

/**
 * 统一处理替换逻辑，特别是针对Vue模板属性
 * @param {string} selectedText 选中的文本
 * @param {string} i18nKey 国际化键
 * @param {string} functionName 国际化函数名称
 * @param {string} codeQuote 使用的引号类型
 * @param {vscode.TextDocument} document 文档对象
 * @param {vscode.Position} position 位置
 * @returns {Object} 包含范围和替换文本的结果对象
 */
function replaceFn(selectedText, i18nKey, functionName, codeQuote, document, position) {
  // 基础替换文本
  const baseReplacement = `${functionName}(${codeQuote}${i18nKey}${codeQuote})`;
  
  // 获取原始范围
  const originalRange = new vscode.Range(
    position,
    new vscode.Position(position.line, position.character + selectedText.length)
  );
  
  // 检查是否在Vue模板标签内容中
  const { isVueContent, contentInfo } = checkVueTemplateContent(document, position);
  
  // 如果是Vue标签内容，使用双花括号包裹
  if (isVueContent && contentInfo) {
    return {
      range: originalRange,
      replacementText: `{{${baseReplacement}}}`,
      isVueContent: true,
      contentInfo: contentInfo
    };
  }
  
  // 检查是否在Vue模板属性中
  const { isVueAttr, attrInfo } = checkVueTemplateAttr(document, position);
  
  // 如果不是Vue属性，直接返回基本替换
  if (!isVueAttr || !attrInfo) {
    return {
      range: originalRange,
      replacementText: baseReplacement,
      isVueAttr: false,
      attrInfo: null
    };
  }
  
  // 是Vue属性，处理属性绑定
  const config = vscode.workspace.getConfiguration('i18n-swapper');
  const autoAddColonInVue = config.get('autoAddColonInVueTemplate', true); // 默认启用
  
  // 使用完整的属性范围
  const fullAttrRange = new vscode.Range(
    document.positionAt(attrInfo.start),
    document.positionAt(attrInfo.end)
  );
  
  let replacementText = baseReplacement;
  
  // 如果自动添加冒号且不是已经绑定的属性
  if (autoAddColonInVue && !attrInfo.isBindingAttr) {
    // 在Vue模板中使用与配置相反的引号类型
    const templateQuote = codeQuote === '"' ? "'" : '"';
    replacementText = ` :${attrInfo.name}=${templateQuote}${baseReplacement}${templateQuote}`;
  } else if (attrInfo.isBindingAttr) {
    // 已经是绑定属性，保留绑定格式，只替换值部分
    const templateQuote = codeQuote === '"' ? "'" : '"';
    replacementText = ` :${attrInfo.name}=${templateQuote}${baseReplacement}${templateQuote}`;
  }
  
  return {
    range: fullAttrRange,
    replacementText: replacementText,
    isVueAttr: true,
    attrInfo: attrInfo
  };
}

module.exports = {
  generateReplacementText,
  checkVueTemplateAttr,
  checkVueTemplateContent,
  setValueByPath,
  findQuotesAround,
  replaceFn
};