const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

/**
 * 递归查找对象中指定值的路径
 * @param {Object} obj 要搜索的对象
 * @param {string} value 要查找的值
 * @param {string} currentPath 当前路径
 * @returns {string|null} 返回找到的路径或null
 */
function findPathByValue(obj, value, currentPath = '') {
  for (const key in obj) {
    const newPath = currentPath ? `${currentPath}.${key}` : key;
    
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      // 递归搜索对象
      const result = findPathByValue(obj[key], value, newPath);
      if (result) return result;
    } else if (obj[key] === value) {
      // 找到匹配的值
      return newPath;
    }
  }
  return null;
}

/**
 * 加载国际化文件内容
 * @param {string} filePath 文件路径
 * @returns {Object|null} 返回文件内容对象或null
 */
function loadLocaleFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    
    if (filePath.endsWith('.json')) {
      // 加载JSON文件
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    } else if (filePath.endsWith('.js')) {
      // 加载JS文件
      try {
        // 清除require缓存，确保获取最新内容
        delete require.cache[require.resolve(filePath)];
        return require(filePath);
      } catch (e) {
        console.error(`加载JS文件失败: ${e.message}`);
        return null;
      }
    }
    
    return null;
  } catch (error) {
    console.error(`加载文件失败: ${error.message}`);
    return null;
  }
}

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
 * 批量替换面板类
 */
class BatchReplacementPanel {
  constructor(context) {
    this.context = context;
    this.panel = null;
    this.replacements = [];
    this.document = null;
    this.editor = null;
  }

  /**
   * 创建并显示面板
   */
  createOrShow() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showInformationMessage('没有打开的编辑器');
      return;
    }
    
    this.editor = editor;
    this.document = editor.document;

    // 如果已有面板，显示现有面板
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Beside);
      return;
    }

    // 创建新的 WebView 面板 - 在编辑器旁边打开
    this.panel = vscode.window.createWebviewPanel(
      'i18nBatchReplacement',
      '批量替换国际化',
      vscode.ViewColumn.Beside, // 关键修改：使用Beside而不是One
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(this.context.extensionPath, 'media'))
        ]
      }
    );

    // 处理关闭事件
    this.panel.onDidDispose(() => {
      this.panel = null;
    }, null, this.context.subscriptions);

    // 处理 WebView 中的消息
    this.panel.webview.onDidReceiveMessage(
      async message => {
        switch (message.command) {
          case 'replace':
            await this.performReplacements(message.replacements);
            return;
          case 'cancel':
            this.panel.dispose();
            return;
          case 'addPattern':
            await this.addScanPattern(message.pattern);
            return;
          case 'removePattern':
            await this.removeScanPattern(message.pattern);
            return;
          case 'refreshScan':
            await this.refreshScan();
            return;
        }
      },
      null,
      this.context.subscriptions
    );

    // 分析当前文档并加载面板内容
    this.loadPanelContent();
  }

  /**
   * 加载面板内容
   */
  async loadPanelContent() {
    if (!this.panel) return;

    const text = this.document.getText();
    const fileExtension = path.extname(this.document.fileName).toLowerCase();
    
    // 获取配置
    const config = vscode.workspace.getConfiguration('i18n-swapper');
    const scanPatterns = config.get('scanPatterns', []);
    const localesPaths = config.get('localesPaths', []);
    
    // 分析当前文档
    this.replacements = await this.analyzeDocument(
      text, fileExtension, scanPatterns, localesPaths
    );

    // 设置 WebView HTML 内容
    this.panel.webview.html = this.getWebviewContent(scanPatterns, this.replacements);
  }

  /**
   * 刷新扫描
   */
  async refreshScan() {
    await this.loadPanelContent();
  }

  /**
   * 添加扫描模式
   */
  async addScanPattern(pattern) {
    if (!pattern) return;
    
    const config = vscode.workspace.getConfiguration('i18n-swapper');
    const scanPatterns = config.get('scanPatterns', []);
    
    if (!scanPatterns.includes(pattern)) {
      scanPatterns.push(pattern);
      await config.update('scanPatterns', scanPatterns, vscode.ConfigurationTarget.Workspace);
      await this.loadPanelContent();
    }
  }

  /**
   * 移除扫描模式
   */
  async removeScanPattern(pattern) {
    const config = vscode.workspace.getConfiguration('i18n-swapper');
    let scanPatterns = config.get('scanPatterns', []);
    
    scanPatterns = scanPatterns.filter(p => p !== pattern);
    await config.update('scanPatterns', scanPatterns, vscode.ConfigurationTarget.Workspace);
    await this.loadPanelContent();
  }

  /**
   * 执行替换
   */
  async performReplacements(replacements) {
    if (!replacements || !replacements.length) {
      vscode.window.showInformationMessage('没有要替换的内容');
      return;
    }

    try {
      const config = vscode.workspace.getConfiguration('i18n-swapper');
      const configQuoteType = config.get('quoteType', 'single');
      const functionName = config.get('functionName', 't');
      const codeQuote = configQuoteType === 'single' ? "'" : '"';
      
      // 创建一个工作区编辑对象
      const workspaceEdit = new vscode.WorkspaceEdit();
      let replacedCount = 0;
      
      // 筛选出选中且有替换的项
      const selectedReplacements = replacements
        .filter(item => item.selected && item.i18nKey)
        .sort((a, b) => b.start - a.start); // 倒序排列，避免位置偏移
      
      for (const item of selectedReplacements) {
        // 查找文本周围的引号
        const { hasQuotes, range, quoteType } = this.findQuotesAround(this.document, item);
        
        // 根据是否有引号生成不同的替换文本
        let replacement;
        if (hasQuotes) {
          // 如果有引号，则替换文本不需要再带引号
          replacement = `${functionName}(${codeQuote}${item.i18nKey}${codeQuote})`;
        } else {
          // 没有引号，使用普通替换文本
          replacement = generateReplacementText(
            item.text, 
            item.i18nKey, 
            functionName, 
            codeQuote, 
            this.document, 
            this.document.positionAt(item.start)
          );
        }
        
        workspaceEdit.replace(this.document.uri, range, replacement);
        replacedCount++;
      }
      
      if (replacedCount > 0) {
        await vscode.workspace.applyEdit(workspaceEdit);
        
        // 替换完成后关闭面板
        if (this.panel) {
          this.panel.dispose();
        }
        
        vscode.window.showInformationMessage(`已成功替换 ${replacedCount} 处文本`);
      } else {
        vscode.window.showInformationMessage('没有选中要替换的内容');
      }
    } catch (error) {
      console.error('执行替换时出错:', error);
      vscode.window.showErrorMessage(`替换出错: ${error.message}`);
    }
  }

  /**
   * 分析文档，找出可能需要国际化的文本
   * @param {string} text 文档文本
   * @param {string} fileExtension 文件扩展名
   * @param {string[]} scanPatterns 要扫描的属性模式
   * @param {string[]} localesPaths 国际化文件路径
   * @returns {Promise<Array>} 找到的替换项
   */
  async analyzeDocument(text, fileExtension, scanPatterns, localesPaths) {
    // 检查国际化文件是否存在
    if (!localesPaths || localesPaths.length === 0 || (localesPaths.length === 1 && !localesPaths[0])) {
      // 使用辅助函数选择文件
      localesPaths = await checkAndSelectLocaleFile();
      if (localesPaths.length === 0) {
        vscode.window.showInformationMessage('操作已取消，未配置国际化文件');
        return [];
      }
    }

    // 收集替换项
    const replacements = [];
    
    // 当 scanPatterns 为空且文件不是 JSON 时，提供默认推荐模式
    let patternsToUse = scanPatterns;
    if (patternsToUse.length === 0 && fileExtension !== '.json') {
      patternsToUse = ['label', 'value', 'placeholder', 'title', 'message', 'text'];
    }
    
    try {
      // 基于文件类型选择不同的分析策略
      if (fileExtension === '.vue') {
        // 分析 Vue 文件
        this.analyzeVueFile(text, patternsToUse, replacements);
      } else if (fileExtension === '.js' || fileExtension === '.ts' || fileExtension === '.jsx' || fileExtension === '.tsx') {
        // 分析 JS/TS 文件
        this.analyzeJsFile(text, patternsToUse, replacements);
      } else if (fileExtension === '.json') {
        // 分析 JSON 文件
        this.analyzeJsonFile(text, replacements);
      }
      
      // 尝试在国际化文件中查找匹配项
      await this.findI18nMatches(replacements, localesPaths);
    } catch (error) {
      console.error('分析文档时出错:', error);
    }
    
    return replacements;
  }

  /**
   * 分析 Vue 文件
   * @param {string} text 文件内容
   * @param {string[]} scanPatterns 要扫描的属性模式
   * @param {Array} replacements 收集替换项的数组
   */
  analyzeVueFile(text, scanPatterns, replacements) {
    try {
      // 处理模板部分的属性
      const templateRegex = /<template>[\s\S]*?<\/template>/i;
      const templateMatch = text.match(templateRegex);
      
      if (templateMatch) {
        const templateText = templateMatch[0];
        
        // 查找属性模式，如 value="文本", placeholder="文本" 等
        for (const pattern of scanPatterns) {
          const attrRegex = new RegExp(`${pattern}=["']([^"']+)["']`, 'g');
          let match;
          
          while ((match = attrRegex.exec(templateText)) !== null) {
            const value = match[1];
            
            // 检查是否包含中文字符或值得国际化的内容
            if (this.shouldBeInternationalized(value)) {
              replacements.push({
                text: value,
                start: match.index + match[0].indexOf(value),
                end: match.index + match[0].indexOf(value) + value.length,
                source: `${pattern} 属性`,
                selected: true
              });
            }
          }
        }
        
        // 查找标签之间的文本内容
        const tagContentRegex = />([^<>]+)</g;
        let contentMatch;
        
        while ((contentMatch = tagContentRegex.exec(templateText)) !== null) {
          const value = contentMatch[1].trim();
          
          if (value && this.shouldBeInternationalized(value)) {
            replacements.push({
              text: value,
              start: templateMatch.index + contentMatch.index + contentMatch[0].indexOf(value),
              end: templateMatch.index + contentMatch.index + contentMatch[0].indexOf(value) + value.length,
              source: '标签内容',
              selected: true
            });
          }
        }
      }
      
      // 处理脚本部分
      const scriptRegex = /<script[\s\S]*?<\/script>/i;
      const scriptMatch = text.match(scriptRegex);
      
      if (scriptMatch) {
        const scriptText = scriptMatch[0];
        this.analyzeJsContent(scriptText, scriptMatch.index, scanPatterns, replacements);
      }
    } catch (error) {
      console.error('分析 Vue 文件时出错:', error);
    }
  }

  /**
   * 分析 JS/TS 文件
   * @param {string} text 文件内容
   * @param {string[]} scanPatterns 要扫描的属性模式
   * @param {Array} replacements 收集替换项的数组
   */
  analyzeJsFile(text, scanPatterns, replacements) {
    this.analyzeJsContent(text, 0, scanPatterns, replacements);
  }

  /**
   * 分析 JS 内容
   * @param {string} text 内容
   * @param {number} baseIndex 基础索引
   * @param {string[]} scanPatterns 要扫描的属性模式
   * @param {Array} replacements 收集替换项的数组
   */
  analyzeJsContent(text, baseIndex, scanPatterns, replacements) {
    try {
      // 查找对象属性
      for (const pattern of scanPatterns) {
        // 查找 pattern: "value" 或 pattern: 'value' 格式
        // 使用两个捕获组：一个是引号类型，一个是值
        const propRegex = new RegExp(`${pattern}\\s*:\\s*(["'])([^"']+)\\1`, 'g');
        let match;
        
        while ((match = propRegex.exec(text)) !== null) {
          const quoteType = match[1];    // 引号类型: ' 或 "
          const value = match[2];        // 引号内文本: 远程开门
          
          if (this.shouldBeInternationalized(value)) {
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
      
      // 查找字符串字面量
      const stringLiteralRegex = /["']([^"']+)["']/g;
      let strMatch;
      
      while ((strMatch = stringLiteralRegex.exec(text)) !== null) {
        const value = strMatch[1];
        
        // 检查是否在已找到的替换项中
        const alreadyFound = replacements.some(item => 
          baseIndex + strMatch.index + strMatch[0].indexOf(value) === item.start
        );
        
        if (!alreadyFound && this.shouldBeInternationalized(value)) {
          replacements.push({
            text: value,
            start: baseIndex + strMatch.index + strMatch[0].indexOf(value),
            end: baseIndex + strMatch.index + strMatch[0].indexOf(value) + value.length,
            source: '字符串字面量',
            selected: false // 默认不选中普通字符串
          });
        }
      }
    } catch (error) {
      console.error('分析 JS 内容时出错:', error);
    }
  }

  /**
   * 分析 JSON 文件
   * @param {string} text 文件内容
   * @param {Array} replacements 收集替换项的数组
   */
  analyzeJsonFile(text, replacements) {
    try {
      // 查找键值对
      const valueRegex = /["']:\s*["']([^"']+)["']/g;
      let match;
      
      while ((match = valueRegex.exec(text)) !== null) {
        const value = match[1];
        
        if (this.shouldBeInternationalized(value)) {
          replacements.push({
            text: value,
            start: match.index + match[0].indexOf(value),
            end: match.index + match[0].indexOf(value) + value.length,
            source: 'JSON 值',
            selected: true
          });
        }
      }
    } catch (error) {
      console.error('分析 JSON 文件时出错:', error);
    }
  }

  /**
   * 判断文本是否需要国际化
   * @param {string} text 文本
   * @returns {boolean} 是否需要国际化
   */
  shouldBeInternationalized(text) {
    // 检查是否包含中文字符
    const hasChinese = /[\u4e00-\u9fa5]/.test(text);
    
    // 检查文本长度和组成
    const isTextContent = text.length > 1 && /\S/.test(text);
    
    // 排除纯数字、日期、变量等
    const isExcluded = /^[0-9.]+$/.test(text) || // 纯数字
                      /^\d{4}-\d{2}-\d{2}/.test(text) || // 日期格式
                      /^{{\s*.*\s*}}$/.test(text); // 变量插值
    
    return (hasChinese || isTextContent) && !isExcluded;
  }

  /**
   * 在国际化文件中查找匹配项
   * @param {Array} replacements 替换项数组
   * @param {string[]} localesPaths 国际化文件路径
   */
  async findI18nMatches(replacements, localesPaths) {
    try {
      // 获取工作区根目录
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        console.log('未找到工作区文件夹');
        return;
      }
      
      const rootPath = workspaceFolders[0].uri.fsPath;
      const config = vscode.workspace.getConfiguration('i18n-swapper');
      const functionName = config.get('functionName', 't');
      const configQuoteType = config.get('quoteType', 'single');
      const codeQuote = configQuoteType === 'single' ? "'" : '"';
      
      // 加载所有国际化文件
      for (const relativePath of localesPaths) {
        const filePath = path.join(rootPath, relativePath);
        const localeData = loadLocaleFile(filePath);
        
        if (!localeData) {
          console.log(`跳过不存在或无法加载的文件: ${filePath}`);
          continue;
        }
        
        // 查找每个替换项的匹配键
        for (const item of replacements) {
          if (item.i18nKey) continue; // 已找到匹配，跳过
          
          const result = findPathByValue(localeData, item.text);
          if (result) {
            item.i18nKey = result;
            // 设置替换预览文本
            item.replacement = `${functionName}(${codeQuote}${result}${codeQuote})`;
            item.i18nFile = relativePath;
          }
        }
      }
    } catch (error) {
      console.error('查找国际化匹配项时出错:', error);
    }
  }

  /**
   * 获取 WebView 内容
   */
  getWebviewContent(scanPatterns, replacements) {
    const matchedCount = replacements.filter(item => item.i18nKey).length;
    
    return `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>批量替换国际化</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            padding: 0;
            margin: 0;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            display: flex;
            flex-direction: column;
            height: 100vh;
            overflow: hidden;
          }
          .main-container {
            display: flex;
            flex: 1;
            overflow: hidden;
            padding: 20px 20px 0 20px;
          }
          .container {
            display: flex;
            flex: 1;
            overflow: hidden;
            min-height: 0; /* 重要: 允许flex子项收缩 */
          }
          .left-panel {
            width: 250px;
            border-right: 1px solid var(--vscode-panel-border);
            padding-right: 15px;
            margin-right: 15px;
            overflow-y: auto;
            flex-shrink: 0;
          }
          .right-panel {
            flex: 1;
            overflow-y: auto;
            min-width: 0; /* 重要: 允许内容收缩 */
          }
          h2 { 
            margin-top: 0;
            color: var(--vscode-editor-foreground);
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
          }
          th, td { 
            padding: 8px; 
            text-align: left; 
            border-bottom: 1px solid var(--vscode-panel-border);
          }
          th { 
            font-weight: 600; 
            background-color: var(--vscode-editor-lineHighlightBackground);
            position: sticky;
            top: 0;
            z-index: 1;
          }
          td {
            word-break: break-all; /* 确保长文本换行 */
            max-width: 300px; /* 限制单元格最大宽度 */
          }
          .pattern-list {
            margin-bottom: 20px;
          }
          .pattern-list div {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 5px;
            padding: 5px;
            background-color: var(--vscode-input-background);
            border-radius: 3px;
          }
          input[type="text"] {
            width: 100%;
            padding: 5px;
            margin-bottom: 10px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
          }
          button {
            padding: 5px 10px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            cursor: pointer;
            border-radius: 3px;
          }
          button:hover {
            background-color: var(--vscode-button-hoverBackground);
          }
          button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
          .remove-pattern {
            background-color: transparent;
            color: var(--vscode-editor-foreground);
            opacity: 0.7;
          }
          .remove-pattern:hover {
            opacity: 1;
            background-color: transparent;
          }
          .no-results {
            text-align: center;
            padding: 20px;
            color: var(--vscode-disabledForeground);
          }
          .stats {
            margin-bottom: 10px;
            font-style: italic;
            color: var(--vscode-descriptionForeground);
          }
          .key-display {
            color: var(--vscode-textLink-foreground);
            font-family: monospace;
          }
          .action-bar {
            padding: 10px 20px;
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            background-color: var(--vscode-editor-background);
            border-top: 1px solid var(--vscode-panel-border);
            flex-shrink: 0; /* 防止按钮栏被压缩 */
          }
        </style>
      </head>
      <body>
        <div class="main-container">
          <div class="container">
            <div class="left-panel">
              <h2>扫描模式</h2>
              <div class="pattern-list">
                ${scanPatterns.map(pattern => `
                  <div>
                    <span>${this.escapeHtml(pattern)}</span>
                    <button class="remove-pattern" data-pattern="${this.escapeHtml(pattern)}">✕</button>
                  </div>
                `).join('') || '<p>未配置扫描模式</p>'}
              </div>
              
              <div>
                <h3>添加模式</h3>
                <input type="text" id="new-pattern" placeholder="输入属性名称..." />
                <button id="add-pattern">添加</button>
              </div>
              
              <button id="refresh-scan" style="margin-top: 20px; width: 100%;">刷新扫描</button>
            </div>
            
            <div class="right-panel">
              <h2>替换结果</h2>
              
              <div class="stats">
                找到 ${replacements.length} 处可能需要国际化的文本，其中 ${matchedCount} 处找到了匹配的国际化键。
              </div>
              
              ${replacements.length > 0 ? `
                <button id="select-all" style="margin-bottom: 10px;">全选/取消全选</button>
                
                <table>
                  <thead>
                    <tr>
                      <th style="width: 40px;"></th>
                      <th>文本</th>
                      <th>国际化键</th>
                      <th>替换为</th>
                      <th>来源</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${replacements.map((item, index) => `
                      <tr>
                        <td>
                          <input type="checkbox" id="check-${index}" 
                            ${item.selected ? 'checked' : ''} 
                            ${!item.i18nKey ? 'disabled' : ''} />
                        </td>
                        <td>${this.escapeHtml(item.text)}</td>
                        <td class="key-display">${item.i18nKey ? this.escapeHtml(item.i18nKey) : '<span style="color:var(--vscode-disabledForeground)">未找到匹配</span>'}</td>
                        <td>${item.replacement ? this.escapeHtml(item.replacement) : '<span style="color:var(--vscode-disabledForeground)">-</span>'}</td>
                        <td>${this.escapeHtml(item.source || '')}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              ` : `
                <div class="no-results">
                  <p>未找到需要国际化的文本</p>
                  <p>尝试添加更多扫描模式，或检查您的国际化文件是否正确配置</p>
                </div>
              `}
            </div>
          </div>
        </div>
        
        <div class="action-bar">
          <button id="cancel">取消</button>
          <button id="replace" ${replacements.some(item => item.i18nKey) ? '' : 'disabled'}>应用替换</button>
        </div>
        
        <script>
          (function() {
            const vscode = acquireVsCodeApi();
            
            // 初始化替换项数据
            const replacements = ${JSON.stringify(replacements)};
            
            // 全选/取消全选
            const selectAllBtn = document.getElementById('select-all');
            if (selectAllBtn) {
              selectAllBtn.addEventListener('click', () => {
                const checkboxes = document.querySelectorAll('input[type="checkbox"]:not(:disabled)');
                const allChecked = Array.from(checkboxes).every(cb => cb.checked);
                
                checkboxes.forEach(cb => {
                  cb.checked = !allChecked;
                });
              });
            }
            
            // 取消按钮
            document.getElementById('cancel').addEventListener('click', () => {
              vscode.postMessage({ command: 'cancel' });
            });
            
            // 替换按钮
            const replaceBtn = document.getElementById('replace');
            if (replaceBtn) {
              replaceBtn.addEventListener('click', () => {
                // 更新选中状态
                for (let i = 0; i < replacements.length; i++) {
                  const checkbox = document.getElementById('check-' + i);
                  if (checkbox) {
                    replacements[i].selected = checkbox.checked;
                  }
                }
                
                vscode.postMessage({
                  command: 'replace',
                  replacements: replacements
                });
              });
            }
            
            // 添加扫描模式
            document.getElementById('add-pattern').addEventListener('click', () => {
              const inputEl = document.getElementById('new-pattern');
              const pattern = inputEl.value.trim();
              
              if (pattern) {
                vscode.postMessage({
                  command: 'addPattern',
                  pattern: pattern
                });
                inputEl.value = '';
              }
            });
            
            // 回车添加模式
            document.getElementById('new-pattern').addEventListener('keyup', (e) => {
              if (e.key === 'Enter') {
                const pattern = e.target.value.trim();
                
                if (pattern) {
                  vscode.postMessage({
                    command: 'addPattern',
                    pattern: pattern
                  });
                  e.target.value = '';
                }
              }
            });
            
            // 移除模式
            document.querySelectorAll('.remove-pattern').forEach(btn => {
              btn.addEventListener('click', () => {
                const pattern = btn.getAttribute('data-pattern');
                vscode.postMessage({
                  command: 'removePattern',
                  pattern: pattern
                });
              });
            });
            
            // 刷新扫描
            document.getElementById('refresh-scan').addEventListener('click', () => {
              vscode.postMessage({
                command: 'refreshScan'
              });
            });
          })();
        </script>
      </body>
      </html>
    `;
  }

  /**
   * HTML转义
   */
  escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * 查找文本周围的引号，扩展替换范围
   * @param {Object} document VSCode文档对象
   * @param {Object} item 替换项
   * @returns {Object} 包含扩展范围的对象
   */
  findQuotesAround(document, item) {
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
}

/**
 * 激活插件
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  // 注册命令
  let disposable = vscode.commands.registerCommand('i18n-swapper.replaceWithI18n', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showInformationMessage('没有打开的编辑器');
      return;
    }

    const selection = editor.selection;
    if (selection.isEmpty) {
      vscode.window.showInformationMessage('未选中文本');
      return;
    }

    // 获取选中的文本
    const selectedText = editor.document.getText(selection);
    const textToFind = selectedText.trim();

    if (!textToFind) {
      vscode.window.showInformationMessage('选中的文本为空');
      return;
    }

    // 获取配置
    const config = vscode.workspace.getConfiguration('i18n-swapper');
    
    // 检查并选择国际化文件
    const localesPaths = await checkAndSelectLocaleFile();
    if (localesPaths.length === 0) {
      return; // 用户取消了操作或没有选择文件
    }
    
    const configQuoteType = config.get('quoteType', 'single');
    const functionName = config.get('functionName', 't');
    const codeQuote = configQuoteType === 'single' ? "'" : '"';

    try {
      // 获取工作区根目录
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        vscode.window.showErrorMessage('未找到工作区文件夹');
        return;
      }
      
      const rootPath = workspaceFolders[0].uri.fsPath;
      
      // 在所有配置的文件中查找
      let foundPath = null;
      let foundInFile = null;
      
      for (const relativePath of localesPaths) {
        const filePath = path.join(rootPath, relativePath);
        const localeData = loadLocaleFile(filePath);
        
        if (!localeData) {
          console.log(`跳过不存在或无法加载的文件: ${filePath}`);
          continue;
        }
        
        // 查找匹配的键
        const result = findPathByValue(localeData, textToFind);
        if (result) {
          foundPath = result;
          foundInFile = relativePath;
          break;
        }
      }
      
      if (foundPath) {
        // 替换选中的文本为配置的国际化函数调用
        await editor.edit(editBuilder => {
          editBuilder.replace(selection, generateReplacementText(textToFind, foundPath, functionName, codeQuote, editor.document, selection.start));
        });
        vscode.window.showInformationMessage(`已替换为: ${functionName}(${codeQuote}${foundPath}${codeQuote}) (从 ${foundInFile} 找到)`);
      } else {
        vscode.window.showInformationMessage(`未找到文本 "${textToFind}" 的国际化键`);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`发生错误: ${error.message}`);
    }
  });

  // 添加批量替换命令
  let batchPanel = new BatchReplacementPanel(context);
  let batchCommand = vscode.commands.registerCommand('i18n-swapper.batchReplaceWithI18n', () => {
    batchPanel.createOrShow();
  });
  
  // 添加快速批量替换命令
  let quickBatchCommand = vscode.commands.registerCommand(
    'i18n-swapper.quickBatchReplace', 
    quickBatchReplace
  );
  
  context.subscriptions.push(
    disposable, 
    batchCommand,
    quickBatchCommand
  );
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};

/**
 * 快速批量替换
 */
async function quickBatchReplace() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showInformationMessage('没有打开的编辑器');
    return;
  }

  // 获取配置
  const config = vscode.workspace.getConfiguration('i18n-swapper');
  const scanPatterns = config.get('scanPatterns', [
    "value",
    "label",
    "placeholder",
    "message",
    "title",
    "text"
  ]);
  
  // 检查并选择国际化文件
  const localesPaths = await checkAndSelectLocaleFile();
  if (localesPaths.length === 0) {
    return; // 用户取消了操作或没有选择文件
  }
  
  const configQuoteType = config.get('quoteType', 'single');
  const functionName = config.get('functionName', 't');
  const codeQuote = configQuoteType === 'single' ? "'" : '"';
  
  if (scanPatterns.length === 0) {
    const result = await vscode.window.showInformationMessage(
      '未配置扫描模式，是否添加常用模式？',
      '添加', '取消'
    );
    
    if (result === '添加') {
      // 添加常用模式
      await config.update(
        'scanPatterns', 
        [],
        vscode.ConfigurationTarget.Workspace
      );
      vscode.window.showInformationMessage('已添加常用扫描模式，请重新运行命令');
      return;
    } else {
      return;
    }
  }
  
  try {
    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: "分析文档中...",
      cancellable: false
    }, async (progress) => {
      // 创建临时分析器并初始化必要属性
      const analyzer = new BatchReplacementPanel({ subscriptions: [] });
      analyzer.document = editor.document; // 设置文档对象
      
      // 分析文档
      const document = editor.document;
      const text = document.getText();
      const fileExtension = path.extname(document.fileName).toLowerCase();
      
      progress.report({ message: "查找匹配项..." });
      
      // 使用批量替换面板类的分析方法
      const replacements = await analyzer.analyzeDocument(
        text, fileExtension, scanPatterns, localesPaths
      );
      
      
      // 筛选有匹配的项
      const matchedReplacements = replacements.filter(r => r.i18nKey);
      
      if (matchedReplacements.length === 0) {
        vscode.window.showInformationMessage('未找到可替换的文本');
        return;
      }
      
      progress.report({ message: "执行替换..." });
      
      // 执行替换
      const workspaceEdit = new vscode.WorkspaceEdit();
      let replacedCount = 0;
      
      // 按位置倒序排列
      matchedReplacements.sort((a, b) => b.start - a.start);
      
      const panel = new BatchReplacementPanel({ subscriptions: [] });
      panel.document = document;
      
      for (const item of matchedReplacements) {
        // 查找文本周围的引号
        const { hasQuotes, range, quoteType } = panel.findQuotesAround(document, item);
        
        // 根据是否有引号生成不同的替换文本
        let replacement;
        if (hasQuotes) {
          // 如果有引号，则替换文本不需要再带引号
          replacement = `${functionName}(${codeQuote}${item.i18nKey}${codeQuote})`;
        } else {
          // 没有引号，使用普通替换文本
          replacement = generateReplacementText(
            item.text, 
            item.i18nKey, 
            functionName, 
            codeQuote, 
            document, 
            document.positionAt(item.start)
          );
        }
        
        workspaceEdit.replace(document.uri, range, replacement);
        replacedCount++;
      }
      
      if (replacedCount > 0) {
        await vscode.workspace.applyEdit(workspaceEdit);
        vscode.window.showInformationMessage(`已自动替换 ${replacedCount} 处文本`);
      }
    });
  } catch (error) {
    console.error('执行快速批量替换时出错:', error);
    vscode.window.showErrorMessage(`批量替换出错: ${error.message}`);
  }
}

/**
 * 检查并引导用户选择国际化文件
 * @returns {Promise<string[]>} 国际化文件路径数组
 */
async function checkAndSelectLocaleFile() {
  // 获取配置的国际化文件路径
  const config = vscode.workspace.getConfiguration('i18n-swapper');
  let localesPaths = config.get('localesPaths', []);
  
  // 检查是否有配置的路径
  if (!localesPaths || localesPaths.length === 0 || (localesPaths.length === 1 && !localesPaths[0])) {
    // 提示用户选择国际化文件
    const result = await vscode.window.showInformationMessage(
      '未配置国际化文件路径，是否立即选择文件？',
      { modal: true },
      '选择文件'
    );
    
    if (result === '选择文件') {
      // 打开文件选择器
      const fileUris = await vscode.window.showOpenDialog({
        canSelectMany: true,
        filters: {
          '国际化文件': ['json', 'js']
        },
        title: '选择国际化文件'
      });
      
      if (fileUris && fileUris.length > 0) {
        // 转换为相对于工作区的路径
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
          vscode.window.showErrorMessage('未找到工作区文件夹');
          return [];
        }
        
        const rootPath = workspaceFolders[0].uri.fsPath;
        const relativePaths = fileUris.map(uri => {
          const filePath = uri.fsPath;
          return path.relative(rootPath, filePath).replace(/\\/g, '/');
        });
        
        // 更新配置
        await config.update('localesPaths', relativePaths, vscode.ConfigurationTarget.Workspace);
        
        vscode.window.showInformationMessage(`已添加 ${relativePaths.length} 个国际化文件`);
        return relativePaths;
      } else {
        vscode.window.showWarningMessage('未选择任何文件，操作取消');
        return [];
      }
    } else {
      vscode.window.showWarningMessage('未配置国际化文件，操作取消');
      return [];
    }
  }
  
  return localesPaths;
} 