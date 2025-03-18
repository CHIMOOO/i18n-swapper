/**
 * 检查文本是否应该被国际化
 * @param {string} text 文本内容
 * @returns {boolean} 是否应该国际化
 */
function shouldBeInternationalized(text) {
  if (!text || text.trim() === '') return false;
  
  // 如果文本只包含空格、标点符号或数字，则不需要国际化
  if (/^[\s\d\p{P}]+$/u.test(text)) return false;
  
  // 其他情况，如果包含中文字符，则应该国际化
  return /[\u4e00-\u9fa5]/.test(text);
}

/**
 * 分析 JavaScript/HTML/Vue 内容
 * @param {string} text 内容
 * @param {number} baseIndex 基础索引
 * @param {string[]} scanPatterns 要扫描的属性模式
 * @param {Function} shouldBeInternationalized 判断是否应该国际化的函数
 * @returns {Array} 可能需要国际化的文本项
 */
function analyzeContent(text, baseIndex, scanPatterns, shouldBeInternationalizedFn) {
  const replacements = [];
  
  try {
    // 分析JS内容
    analyzeJsContent(text, baseIndex, scanPatterns, replacements, shouldBeInternationalizedFn);
    
    // 分析字符串模板
    analyzeTemplateStrings(text, baseIndex, replacements, shouldBeInternationalizedFn);
    
    // 分析HTML/Vue模板
    analyzeHtmlContent(text, baseIndex, replacements, shouldBeInternationalizedFn);
    
    // 确保所有替换项都保持其原始位置信息
    replacements.forEach(item => {
      // 确保起始位置包含baseIndex偏移
      if (typeof item.start === 'number') {
        item.start += baseIndex;
      }
      
      // 确保结束位置包含baseIndex偏移
      if (typeof item.end === 'number') {
        item.end += baseIndex;
      }
      
      // 记录原始文本和长度，便于调试
      item.originalText = text.substring(
        Math.max(0, item.start - baseIndex), 
        Math.min(text.length, item.end - baseIndex)
      );
      item.textLength = item.text ? item.text.length : 0;
    });
  } catch (error) {
    console.error('分析内容时出错:', error);
  }
  
  return replacements;
}

/**
 * 分析 JS 内容
 * @param {string} text 内容
 * @param {number} baseIndex 基础索引
 * @param {string[]} scanPatterns 要扫描的属性模式
 * @param {Array} replacements 收集替换项的数组
 * @param {Function} shouldBeInternationalizedFn 判断是否需要国际化的函数
 */
function analyzeJsContent(text, baseIndex, scanPatterns, replacements, shouldBeInternationalizedFn) {
  try {
    // 查找对象属性
    for (const pattern of scanPatterns) {
      // 使用两个捕获组：一个是引号类型，一个是值
      const propRegex = new RegExp(`${pattern}\\s*:\\s*(["'])([^"']+)\\1`, 'g');
      let match;
      
      while ((match = propRegex.exec(text)) !== null) {
        const quoteType = match[1];    // 引号类型: ' 或 "
        const value = match[2];        // 引号内文本: 远程开门
        
        if (shouldBeInternationalizedFn(value)) {
          // 获取值在原始文本中的位置
          const propStart = match.index;
          const valueStart = match[0].indexOf(value, pattern.length);
          const absoluteStart = baseIndex + propStart + valueStart;
          
          // 添加替换项时记录额外信息
          replacements.push({
            text: value,                             // 文本内容（不含引号）
            start: absoluteStart,                    // 文本开始位置
            end: absoluteStart + value.length,       // 文本结束位置
            propText: match[0],                      // 整个属性文本，如 label: '远程开门'
            propStart: baseIndex + propStart,        // 属性开始位置
            propEnd: baseIndex + propStart + match[0].length, // 属性结束位置
            quoteType: quoteType,                    // 引号类型
            hasQuotes: true,                         // 标记有引号
            source: `${pattern} 属性`,
            selected: true
          });
        }
      }
    }
    
    // 查找字符串变量
    const stringVarRegex = /const\s+(\w+)\s*=\s*(['"])([^'"]+)\2/g;
    let stringVarMatch;
    while ((stringVarMatch = stringVarRegex.exec(text)) !== null) {
      const varName = stringVarMatch[1];
      const quoteType = stringVarMatch[2];
      const value = stringVarMatch[3];
      
      if (shouldBeInternationalizedFn(value)) {
        const valueStart = stringVarMatch.index + stringVarMatch[0].indexOf(value);
        replacements.push({
          text: value,
          start: baseIndex + valueStart,
          end: baseIndex + valueStart + value.length,
          source: `字符串变量 ${varName}`,
          selected: true
        });
      }
    }
  } catch (error) {
    console.error('分析 JS 内容时出错:', error);
  }
}

/**
 * 分析模板字符串
 * @param {string} text 内容
 * @param {number} baseIndex 基础索引
 * @param {Array} replacements 收集替换项的数组
 * @param {Function} shouldBeInternationalizedFn 判断是否需要国际化的函数
 */
function analyzeTemplateStrings(text, baseIndex, replacements, shouldBeInternationalizedFn) {
  try {
    // 查找模板字符串
    const templateRegex = /`([^`]+)`/g;
    let templateMatch;
    
    while ((templateMatch = templateRegex.exec(text)) !== null) {
      const templateContent = templateMatch[1];
      
      // 跳过包含插值表达式的模板
      if (templateContent.includes('${')) continue;
      
      if (shouldBeInternationalizedFn(templateContent)) {
        const contentStart = templateMatch.index + 1; // +1 跳过开始的 `
        replacements.push({
          text: templateContent,
          start: baseIndex + contentStart,
          end: baseIndex + contentStart + templateContent.length,
          source: '模板字符串',
          selected: true
        });
      }
    }
  } catch (error) {
    console.error('分析模板字符串时出错:', error);
  }
}

/**
 * 分析HTML/Vue内容
 * @param {string} text 内容
 * @param {number} baseIndex 基础索引
 * @param {Array} replacements 收集替换项的数组
 * @param {Function} shouldBeInternationalizedFn 判断是否需要国际化的函数
 */
function analyzeHtmlContent(text, baseIndex, replacements, shouldBeInternationalizedFn) {
  try {
    // 检查Vue模板的插值表达式 {{ text }}
    const interpolationRegex = /{{(.+?)}}/g;
    let interpolationMatch;
    
    while ((interpolationMatch = interpolationRegex.exec(text)) !== null) {
      const expression = interpolationMatch[1].trim();
      
      // 跳过复杂表达式或函数调用
      if (expression.includes('(') || 
          expression.includes('+') || 
          expression.includes('?') ||
          /^\s*[a-zA-Z_$][\w$]*(\.[a-zA-Z_$][\w$]*)*\s*$/.test(expression)) {
        continue;
      }
      
      // 检查是否为字符串字面量
      const stringMatch = expression.match(/^\s*(['"])(.+?)\1\s*$/);
      if (stringMatch && shouldBeInternationalizedFn(stringMatch[2])) {
        const strContent = stringMatch[2];
        const strStart = interpolationMatch.index + interpolationMatch[0].indexOf(strContent);
        
        replacements.push({
          text: strContent,
          start: baseIndex + strStart,
          end: baseIndex + strStart + strContent.length,
          source: 'Vue 插值表达式',
          selected: true
        });
      }
    }
    
    // 检查HTML标签中的属性值
    const attrRegex = /(\w+)=(['"])([^'"]+)\2/g;
    let attrMatch;
    
    while ((attrMatch = attrRegex.exec(text)) !== null) {
      const attrName = attrMatch[1];
      const value = attrMatch[3];
      
      // 跳过特定属性
      if (['style', 'class', 'id', 'href', 'src', 'type', 'name', 'value', 'disabled'].includes(attrName)) {
        continue;
      }
      
      if (shouldBeInternationalizedFn(value)) {
        const valueStart = attrMatch.index + attrMatch[0].indexOf(value);
        replacements.push({
          text: value,
          start: baseIndex + valueStart,
          end: baseIndex + valueStart + value.length,
          source: `${attrName} 属性`,
          selected: true
        });
      }
    }
  } catch (error) {
    console.error('分析HTML内容时出错:', error);
  }
}

module.exports = {
  shouldBeInternationalized,
  analyzeContent,
  analyzeJsContent,
  analyzeTemplateStrings,
  analyzeHtmlContent
}; 