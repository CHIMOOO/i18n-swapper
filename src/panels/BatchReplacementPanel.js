const vscode = require('vscode');
const path = require('path');
const utils = require('../utils');

class BatchReplacementPanel {
  constructor(context) {
    this.subscriptions = context.subscriptions;
    this.panel = undefined;
    this.document = null;
    this.replacements = [];
  }

  /**
   * 创建或显示面板
   */
  createOrShow() {
    // 如果已有面板，显示它
    if (this.panel) {
      this.panel.reveal();
      return;
    }

    // 创建一个新的WebView面板
    this.panel = vscode.window.createWebviewPanel(
      'i18nSwapperBatch',
      '批量替换国际化',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: []
      }
    );

    // 当面板被销毁时，清理资源
    this.panel.onDidDispose(() => {
      this.panel = undefined;
    }, null, this.subscriptions);

    // 处理来自WebView的消息
    this.panel.webview.onDidReceiveMessage(this.handleWebviewMessage.bind(this));

    // 获取当前打开的文档和配置
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      this.document = editor.document;
      this.analyzeAndLoadPanel();
    } else {
      vscode.window.showInformationMessage('没有打开的编辑器');
      this.panel.dispose();
    }
  }

  /**
   * 分析文档并加载面板
   */
  async analyzeAndLoadPanel() {
    if (!this.document) return;

    try {
      // 获取配置
      const config = vscode.workspace.getConfiguration('i18n-swapper');
      const scanPatterns = config.get('scanPatterns', []);
      const localesPaths = config.get('localesPaths', []);

      // 更新面板内容 - 即使没有国际化文件也先显示面板
      this.updatePanelContent(scanPatterns, [], localesPaths);

      // 检查国际化文件是否存在
      if (!localesPaths || localesPaths.length === 0 || (localesPaths.length === 1 && !localesPaths[0])) {
        // 告知用户需要先选择国际化文件
        vscode.window.showInformationMessage('请先选择国际化文件以启用批量替换功能', '选择国际化文件').then(selection => {
          if (selection === '选择国际化文件') {
            this.selectLocalesFiles();
          }
        });
        return; // 不继续分析，等待用户选择文件
      }

      // 用进度提示分析文档
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "分析文档中...",
        cancellable: false
      }, async (progress) => {
        // 获取文档内容和文件类型
        const text = this.document.getText();
        const fileExtension = path.extname(this.document.fileName).toLowerCase();

        progress.report({ message: "查找可替换文本..." });

        // 分析文档查找可替换文本
        this.replacements = await this.analyzeDocument(
          text, fileExtension, scanPatterns, localesPaths
        );

        // 更新面板内容，包含国际化文件信息
        this.updatePanelContent(scanPatterns, this.replacements, localesPaths);
      });
    } catch (error) {
      console.error('分析文档时出错:', error);
      vscode.window.showErrorMessage(`分析出错: ${error.message}`);
    }
  }

  /**
   * 分析文档内容
   * @param {string} text 文档文本
   * @param {string} fileExtension 文件扩展名
   * @param {string[]} scanPatterns 扫描模式
   * @param {string[]} localesPaths 国际化文件路径
   * @returns {Promise<Array>} 替换项数组
   */
  async analyzeDocument(text, fileExtension, scanPatterns, localesPaths) {
    // 收集替换项
    const replacements = [];
    
    // 分析文档内容
    const textReplacements = utils.analyzeContent(
      text, 0, scanPatterns, utils.shouldBeInternationalized
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
    }

    return replacements;
  }

  /**
   * 更新面板内容
   * @param {string[]} scanPatterns 扫描模式
   * @param {Array} replacements 替换项
   * @param {string[]} localesPaths 国际化文件路径
   */
  updatePanelContent(scanPatterns, replacements, localesPaths) {
    if (this.panel) {
      // 使用实用函数生成面板HTML内容
      this.panel.webview.html = this.getWebviewContent(scanPatterns, replacements, localesPaths);
    }
  }

  /**
   * 获取WebView内容
   * @param {Array} scanPatterns 扫描模式
   * @param {Array} replacements 替换项
   * @param {string[]} localesPaths 国际化文件路径
   * @returns {string} HTML内容
   */
  getWebviewContent(scanPatterns, replacements, localesPaths) {
    const matchedCount = replacements.filter(item => item.i18nKey).length;
    const hasLocaleFiles = localesPaths && localesPaths.length > 0;
    
    return `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>批量替换国际化</title>
        <style>
          :root {
            --primary-color: #4285f4;
            --secondary-color: #34a853;
            --danger-color: #ea4335;
            --gray-100: #f8f9fa;
            --gray-200: #e9ecef;
            --gray-300: #dee2e6;
            --gray-600: #6c757d;
            --gray-800: #343a40;
            --shadow: 0 2px 5px rgba(0,0,0,0.1);
          }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif; 
            margin: 0; 
            padding: 0; 
            color: var(--gray-800);
            background-color: var(--gray-100);
          }
          .main-container { 
            display: flex; 
            flex-direction: column; 
            height: 100vh;
            background-color: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: var(--shadow);
          }
          .container { 
            display: flex; 
            flex: 1; 
            overflow: hidden; 
          }
          .left-panel { 
            width: 300px; 
            padding: 16px; 
            border-right: 1px solid var(--gray-300); 
            overflow-y: auto;
            background-color: white;
          }
          .right-panel { 
            flex: 1; 
            padding: 16px; 
            overflow-y: auto;
            background-color: white;
          }
          h2 {
            margin-top: 0;
            color: var(--gray-800);
            border-bottom: 2px solid var(--primary-color);
            padding-bottom: 8px;
          }
          .pattern-list { 
            margin-top: 16px; 
          }
          .pattern-item { 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            margin-bottom: 8px; 
            padding: 8px 12px; 
            border: 1px solid var(--gray-300); 
            border-radius: 4px;
            background-color: var(--gray-100);
          }
          .pattern-remove-btn { 
            background: var(--danger-color); 
            color: white; 
            border: none; 
            border-radius: 4px; 
            padding: 4px 10px; 
            cursor: pointer;
            transition: background-color 0.2s;
          }
          .pattern-remove-btn:hover {
            background-color: #d32f2f;
          }
          .pattern-add { 
            display: flex; 
            margin-top: 16px; 
          }
          #new-pattern { 
            flex: 1; 
            padding: 8px 12px; 
            margin-right: 8px;
            border: 1px solid var(--gray-300);
            border-radius: 4px;
          }
          #add-pattern-btn { 
            background: var(--secondary-color); 
            color: white; 
            border: none; 
            border-radius: 4px; 
            padding: 8px 16px; 
            cursor: pointer;
            transition: background-color 0.2s;
          }
          #add-pattern-btn:hover {
            background-color: #2e7d32;
          }
          .refresh-btn { 
            background: var(--primary-color); 
            color: white; 
            border: none; 
            border-radius: 4px; 
            padding: 10px 16px; 
            cursor: pointer; 
            margin-top: 16px; 
            width: 100%;
            transition: background-color 0.2s;
            font-weight: 500;
          }
          .refresh-btn:hover {
            background-color: #1a73e8;
          }
          .locale-settings { 
            margin-top: 24px; 
          }
          .replacement-item { 
            border: 1px solid var(--gray-300); 
            padding: 12px 16px; 
            margin-bottom: 12px;
            border-radius: 6px;
            background-color: var(--gray-100);
            transition: box-shadow 0.2s;
          }
          .replacement-item:hover {
            box-shadow: var(--shadow);
          }
          .replacement-header { 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            margin-bottom: 10px; 
          }
          .replacement-text { 
            font-weight: 500; 
            color: var(--gray-800);
          }
          .replacement-source { 
            color: var(--gray-600); 
            font-size: 12px; 
            padding: 2px 6px;
            background-color: var(--gray-200);
            border-radius: 12px;
          }
          .replacement-i18n { 
            margin-top: 10px; 
            padding-top: 10px;
            border-top: 1px dashed var(--gray-300);
          }
          .replacement-i18n input { 
            width: 100%; 
            padding: 8px 12px; 
            box-sizing: border-box; 
            margin-top: 5px;
            border: 1px solid var(--gray-300);
            border-radius: 4px;
          }
          .checkbox-wrapper { 
            display: flex; 
            align-items: center; 
          }
          .checkbox-wrapper input { 
            margin-right: 8px;
            cursor: pointer;
            width: 18px;
            height: 18px;
          }
          .button-panel { 
            padding: 12px 16px; 
            display: flex; 
            justify-content: space-between; 
            border-top: 1px solid var(--gray-300);
            background-color: var(--gray-100);
          }
          .confirm-btn { 
            background: var(--secondary-color); 
            color: white; 
            border: none; 
            border-radius: 4px; 
            padding: 10px 18px; 
            cursor: pointer;
            font-weight: 500;
            transition: background-color 0.2s;
          }
          .confirm-btn:hover {
            background-color: #2e7d32;
          }
          .cancel-btn { 
            background: var(--danger-color); 
            color: white; 
            border: none; 
            border-radius: 4px; 
            padding: 10px 18px; 
            cursor: pointer;
            font-weight: 500;
            transition: background-color 0.2s;
          }
          .cancel-btn:hover {
            background-color: #d32f2f;
          }
          .status-bar { 
            padding: 12px 16px; 
            background-color: var(--gray-800);
            color: white;
            display: flex; 
            justify-content: space-between;
            font-size: 13px;
          }
          .disabled { 
            opacity: 0.5; 
            cursor: not-allowed !important; 
            pointer-events: none;
          }
          .filter-container { 
            margin-bottom: 16px;
            position: relative;
          }
          .filter-container:before {
            content: "🔍";
            position: absolute;
            left: 10px;
            top: 9px;
            color: var(--gray-600);
          }
          #filter-input { 
            width: 100%; 
            padding: 8px 12px 8px 32px; 
            box-sizing: border-box;
            border: 1px solid var(--gray-300);
            border-radius: 4px;
          }
          .btn-group {
            display: flex;
            gap: 8px;
          }
          .found-key {
            color: var(--secondary-color);
            font-weight: 500;
          }
          .key-file {
            font-size: 12px;
            color: var(--gray-600);
            margin-left: 4px;
          }
          /* 添加国际化文件列表样式 */
          .locale-files {
            margin-top: 12px;
            max-height: 200px;
            overflow-y: auto;
          }
          .locale-file-item {
            padding: 8px 12px;
            background-color: var(--gray-100);
            border: 1px solid var(--gray-300);
            border-radius: 4px;
            margin-bottom: 6px;
            font-size: 13px;
            word-break: break-all;
          }
          .no-files-warning {
            color: var(--danger-color);
            padding: 10px;
            text-align: center;
            border: 1px dashed var(--danger-color);
            border-radius: 4px;
            margin-top: 10px;
          }
          .disabled-panel {
            opacity: 0.6;
            pointer-events: none;
          }
        </style>
      </head>
      <body>
        <div class="main-container">
          <div class="container">
            <div class="left-panel">
              <h2>扫描字段配置</h2>
              <div class="pattern-list">
                ${scanPatterns.map(pattern => `
                  <div class="pattern-item">
                    <span>${pattern}</span>
                    <button class="pattern-remove-btn" data-pattern="${pattern}">删除</button>
                  </div>
                `).join('')}
              </div>
              <div class="pattern-add">
                <input type="text" id="new-pattern" placeholder="新增扫描字段">
                <button id="add-pattern-btn">添加</button>
              </div>
              <div class="locale-settings">
                <h2>国际化文件</h2>
                <button id="select-locales-btn" class="refresh-btn">选择国际化文件</button>
                
                ${hasLocaleFiles ? `
                  <div class="locale-files">
                    ${localesPaths.map(file => `
                      <div class="locale-file-item">${file}</div>
                    `).join('')}
                  </div>
                ` : `
                  <div class="no-files-warning">
                    未配置国际化文件，请先选择文件
                  </div>
                `}
              </div>
              <button id="refresh-scan" class="refresh-btn" ${!hasLocaleFiles ? 'disabled' : ''}>刷新扫描</button>
            </div>
            <div class="right-panel ${!hasLocaleFiles ? 'disabled-panel' : ''}">
              <h2>扫描找到的文本 (${replacements.length})</h2>
              <div class="filter-container">
                <input type="text" id="filter-input" placeholder="输入关键词筛选文本">
              </div>
              <div id="replacements-list">
                ${replacements.map((item, index) => `
                  <div class="replacement-item" data-index="${index}">
                    <div class="replacement-header">
                      <div class="checkbox-wrapper">
                        <input type="checkbox" id="check-${index}" ${item.selected ? 'checked' : ''}>
                        <span class="replacement-text">${this.escapeHtml(item.text)}</span>
                      </div>
                      <span class="replacement-source">${item.source}</span>
                    </div>
                    <div class="replacement-i18n">
                      ${item.i18nKey ? 
                        `<div>国际化键: <span class="found-key">${item.i18nKey}</span> <span class="key-file">(从 ${item.i18nFile || '文件'} 找到)</span></div>` : 
                        `<div>国际化键: <input type="text" class="i18n-key-input" id="key-${index}" placeholder="输入新的国际化键"></div>`
                      }
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
          <div class="button-panel">
            <div class="btn-group">
              <button id="select-all" class="confirm-btn" ${!hasLocaleFiles ? 'disabled' : ''}>全选</button>
              <button id="deselect-all" class="cancel-btn" ${!hasLocaleFiles ? 'disabled' : ''}>取消全选</button>
            </div>
            <div class="btn-group">
              <button id="replace-selected" class="confirm-btn" ${(matchedCount === 0 || !hasLocaleFiles) ? 'disabled' : ''}>替换选中项 (${matchedCount})</button>
              <button id="close-panel" class="cancel-btn">关闭面板</button>
            </div>
          </div>
          <div class="status-bar">
            <div>${hasLocaleFiles ? `匹配到国际化键: ${matchedCount} / ${replacements.length}` : '请先选择国际化文件'}</div>
            <div>${hasLocaleFiles ? '未匹配到的需要手动填写键名' : ''}</div>
          </div>
        </div>
        <script>
          const vscode = acquireVsCodeApi();
          
          (function() {
            // 选择国际化文件
            document.getElementById('select-locales-btn').addEventListener('click', () => {
              vscode.postMessage({
                command: 'selectLocalesFiles'
              });
            });
            
            // 如果没有国际化文件，其他脚本事件可能不需要绑定
            ${!hasLocaleFiles ? '' : `
              // 添加扫描模式
              document.getElementById('add-pattern-btn').addEventListener('click', () => {
                const pattern = document.getElementById('new-pattern').value.trim();
                if (pattern) {
                  vscode.postMessage({
                    command: 'addPattern',
                    pattern: pattern
                  });
                  document.getElementById('new-pattern').value = '';
                }
              });
              
              // 删除扫描模式
              document.querySelectorAll('.pattern-remove-btn').forEach(btn => {
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
              
              // 控制复选框
              document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
                checkbox.addEventListener('change', () => {
                  const index = checkbox.id.split('-')[1];
                  vscode.postMessage({
                    command: 'toggleSelection',
                    index: parseInt(index),
                    selected: checkbox.checked
                  });
                });
              });
              
              // 更新国际化键
              document.querySelectorAll('.i18n-key-input').forEach(input => {
                input.addEventListener('input', () => {
                  const index = input.id.split('-')[1];
                  vscode.postMessage({
                    command: 'updateI18nKey',
                    index: parseInt(index),
                    key: input.value.trim()
                  });
                });
              });
              
              // 全选/取消全选
              document.getElementById('select-all').addEventListener('click', () => {
                vscode.postMessage({
                  command: 'selectAll'
                });
              });
              
              document.getElementById('deselect-all').addEventListener('click', () => {
                vscode.postMessage({
                  command: 'deselectAll'
                });
              });
              
              // 替换选中项
              document.getElementById('replace-selected').addEventListener('click', () => {
                vscode.postMessage({
                  command: 'replaceSelected'
                });
              });
              
              // 文本过滤
              document.getElementById('filter-input').addEventListener('input', (e) => {
                const filterText = e.target.value.toLowerCase();
                const items = document.querySelectorAll('.replacement-item');
                
                items.forEach(item => {
                  const text = item.querySelector('.replacement-text').textContent.toLowerCase();
                  if (text.includes(filterText)) {
                    item.style.display = 'block';
                  } else {
                    item.style.display = 'none';
                  }
                });
              });
            `}
            
            // 关闭面板
            document.getElementById('close-panel').addEventListener('click', () => {
              vscode.postMessage({
                command: 'closePanel'
              });
            });
          })();
        </script>
      </body>
      </html>
    `;
  }

  /**
   * 处理面板消息
   */
  async handleWebviewMessage(message) {
    switch (message.command) {
      case 'replaceSelected':
        await this.performSelectedReplacements();
        break;
      case 'selectAll':
        this.selectAllItems(true);
        break;
      case 'deselectAll':
        this.selectAllItems(false);
        break;
      case 'toggleSelection':
        this.toggleItemSelection(message.index, message.selected);
        break;
      case 'updateI18nKey':
        this.updateI18nKey(message.index, message.key);
        break;
      case 'closePanel':
        if (this.panel) {
          this.panel.dispose();
        }
        break;
      case 'addPattern':
        await this.addPattern(message.pattern);
        break;
      case 'removePattern':
        await this.removePattern(message.pattern);
        break;
      case 'refreshScan':
        await this.refreshScan();
        break;
      case 'selectLocalesFiles':
        await this.selectLocalesFiles();
        break;
    }
  }

  /**
   * 刷新面板内容
   */
  refreshPanel() {
    if (this.panel) {
      // 重新获取扫描配置
      const config = vscode.workspace.getConfiguration('i18n-swapper');
      const scanPatterns = config.get('scanPatterns', []);
      
      // 重新分析文档
      this.analyzeAndLoadPanel();
    }
  }

  /**
   * 添加扫描模式
   * @param {string} pattern 模式
   */
  async addPattern(pattern) {
    // ... 实现添加模式的代码 ...
  }

  /**
   * 移除扫描模式
   * @param {string} pattern 模式
   */
  async removePattern(pattern) {
    // ... 实现移除模式的代码 ...
  }

  /**
   * 刷新扫描
   */
  async refreshScan() {
    await this.analyzeAndLoadPanel();
  }

  /**
   * 选择国际化文件
   */
  async selectLocalesFiles() {
    // 调用设置国际化文件路径命令
    await vscode.commands.executeCommand('i18n-swapper.setLocalesPaths');
    
    // 设置完成后，刷新分析和面板
    await this.analyzeAndLoadPanel();
  }

  /**
   * 执行替换
   */
  async performReplacements(replacements) {
    // ... 实现执行替换的代码 ...
  }

  /**
   * 转义HTML特殊字符
   * @param {string} text 原始文本
   * @returns {string} 转义后的文本
   */
  escapeHtml(text) {
    if (typeof text !== 'string') return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * 更新项的国际化键
   */
  updateI18nKey(index, key) {
    if (index >= 0 && index < this.replacements.length) {
      this.replacements[index].i18nKey = key;
      this.updatePanelContent(
        vscode.workspace.getConfiguration('i18n-swapper').get('scanPatterns', []),
        this.replacements,
        vscode.workspace.getConfiguration('i18n-swapper').get('localesPaths', [])
      );
    }
  }

  /**
   * 切换项的选中状态
   */
  toggleItemSelection(index, selected) {
    if (index >= 0 && index < this.replacements.length) {
      this.replacements[index].selected = selected;
    }
  }

  /**
   * 选择或取消选择所有项
   */
  selectAllItems(selected) {
    for (const item of this.replacements) {
      item.selected = selected;
    }
    this.updatePanelContent(
      vscode.workspace.getConfiguration('i18n-swapper').get('scanPatterns', []),
      this.replacements,
      vscode.workspace.getConfiguration('i18n-swapper').get('localesPaths', [])
    );
  }

  /**
   * 执行选中项的替换
   */
  async performSelectedReplacements() {
    const selectedItems = this.replacements.filter(item => item.selected && item.i18nKey);
    
    if (selectedItems.length === 0) {
      vscode.window.showInformationMessage('没有选中任何有效的替换项');
      return;
    }
    
    try {
      // 获取配置
      const config = vscode.workspace.getConfiguration('i18n-swapper');
      const configQuoteType = config.get('quoteType', 'single');
      const functionName = config.get('functionName', 't');
      const codeQuote = configQuoteType === 'single' ? "'" : '"';
      
      // 创建工作区编辑
      const workspaceEdit = new vscode.WorkspaceEdit();
      
      // 处理所有选中项
      for (const item of selectedItems) {
        // 查找文本周围的引号
        const { hasQuotes, range } = utils.findQuotesAround(this.document, item);
        
        // 生成替换文本
        let replacement;
        if (hasQuotes) {
          // 如果有引号，则替换文本不需要再带引号
          replacement = `${functionName}(${codeQuote}${item.i18nKey}${codeQuote})`;
        } else {
          // 根据上下文生成替换文本
          replacement = utils.generateReplacementText(
            item.text, 
            item.i18nKey, 
            functionName, 
            codeQuote, 
            this.document, 
            this.document.positionAt(item.start)
          );
        }
        
        workspaceEdit.replace(this.document.uri, range, replacement);
      }
      
      // 应用所有编辑
      await vscode.workspace.applyEdit(workspaceEdit);
      
      vscode.window.showInformationMessage(`已替换 ${selectedItems.length} 处文本`);
      
      // 刷新面板
      await this.analyzeAndLoadPanel();
    } catch (error) {
      console.error('执行替换时出错:', error);
      vscode.window.showErrorMessage(`替换出错: ${error.message}`);
    }
  }
}

module.exports = BatchReplacementPanel; 