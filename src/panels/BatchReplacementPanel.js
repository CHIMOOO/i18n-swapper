const vscode = require('vscode');
const path = require('path');
const utils = require('../utils');
const fs = require('fs');
const crypto = require('crypto');
const https = require('https');

class BatchReplacementPanel {
  constructor(context) {
    this.subscriptions = context.subscriptions;
    this.panel = undefined;
    this.document = null;
    this.replacements = [];
    this.selectedIndexes = [];
    this.context = context;
  }

  /**
   * 创建或显示面板
   */
  createOrShow() {
    // 如果已有面板，重新获取当前编辑器文档
    if (this.panel) {
      this.panel.reveal();
      
      // 检查当前文档是否变化
      const editor = vscode.window.activeTextEditor;
      if (editor && (!this.document || this.document !== editor.document)) {
        this.document = editor.document;
        this.analyzeAndLoadPanel();
      }
      
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
   */
  getWebviewContent(scanPatterns, replacements, localesPaths) {
    const hasLocaleFiles = localesPaths && localesPaths.length > 0;
    
    // 替换项渲染
    const replacementsHtml = replacements.map((item, index) => `
      <div class="replacement-item" data-index="${index}">
        <div class="replacement-header">
          <label class="select-item">
            <input type="checkbox" class="item-checkbox" ${item.i18nKey ? 'checked' : ''}>
          </label>
          <div class="replacement-text">${this.escapeHtml(item.text)}</div>
        </div>
        <div class="replacement-footer">
          <div class="i18n-key-input">
            <input type="text" class="key-input" placeholder="输入国际化键" 
              value="${item.i18nKey || ''}" data-index="${index}">
            <button class="translate-btn" title="翻译并生成键" data-index="${index}">翻译</button>
          </div>
          ${item.i18nFile ? `<div class="found-key">找到于: <span class="key-file">${item.i18nFile}</span></div>` : ''}
        </div>
      </div>
    `).join('');

    const scriptSection = `
      <script>
        (function() {
          const vscode = acquireVsCodeApi();
          
          // 翻译按钮点击事件
          document.addEventListener('DOMContentLoaded', function() {
            document.querySelectorAll('.translate-btn').forEach(btn => {
              btn.addEventListener('click', function(e) {
                e.preventDefault();
                const index = parseInt(this.dataset.index);
                const keyInput = document.querySelector('.key-input[data-index="' + index + '"]');
                const key = keyInput ? keyInput.value.trim() : '';
                
                vscode.postMessage({
                  command: 'translateItem',
                  index: index,
                  key: key
                });
              });
            });
            
            // 初始化选中状态跟踪
            const selectedItems = new Set();
            
            // 绑定复选框事件
            document.querySelectorAll('.item-checkbox').forEach(checkbox => {
              const index = parseInt(checkbox.closest('.replacement-item').dataset.index);
              if (checkbox.checked) {
                selectedItems.add(index);
              }
              
              checkbox.addEventListener('change', (e) => {
                const index = parseInt(e.target.closest('.replacement-item').dataset.index);
                if (e.target.checked) {
                  selectedItems.add(index);
                } else {
                  selectedItems.delete(index);
                }
                
                vscode.postMessage({
                  command: 'updateSelection',
                  selectedIndexes: Array.from(selectedItems)
                });
              });
            });
            
            // 绑定批量替换按钮事件
            const batchReplaceBtn = document.getElementById('batch-replace');
            if (batchReplaceBtn) {
              batchReplaceBtn.addEventListener('click', () => {
                vscode.postMessage({
                  command: 'batchReplace',
                  selectedIndexes: Array.from(selectedItems)
                });
              });
            }
            
            // 绑定刷新扫描按钮事件
            const refreshBtn = document.getElementById('refresh-scan');
            if (refreshBtn) {
              refreshBtn.addEventListener('click', () => {
                console.log('点击刷新按钮');
                vscode.postMessage({
                  command: 'refreshScan'
                });
              });
            }
            
            // 绑定选择国际化文件按钮事件
            const selectLocalesBtn = document.getElementById('select-locales');
            if (selectLocalesBtn) {
              selectLocalesBtn.addEventListener('click', () => {
                vscode.postMessage({
                  command: 'selectLocalesFiles'
                });
              });
            }
            
            // 绑定API翻译配置按钮事件
            const apiTranslationBtn = document.getElementById('open-api-translation');
            if (apiTranslationBtn) {
              apiTranslationBtn.addEventListener('click', () => {
                vscode.postMessage({
                  command: 'openApiTranslation'
                });
              });
            }
            
            // 绑定关闭按钮事件
            const closeBtn = document.getElementById('close-panel');
            if (closeBtn) {
              closeBtn.addEventListener('click', () => {
                vscode.postMessage({
                  command: 'closePanel'
                });
              });
            }
          });
        })();
      </script>
    `;

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
          /* 翻译按钮样式 */
          .translate-btn {
            background-color: #4dabf7;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 4px 8px;
            font-size: 12px;
            cursor: pointer;
            margin-left: 8px;
            transition: background-color 0.2s;
          }
          
          .translate-btn:hover {
            background-color: #339af0;
          }
          
          .i18n-key-input {
            display: flex;
            align-items: center;
            flex-grow: 1;
          }
          
          .key-input {
            flex-grow: 1;
            padding: 4px 8px;
            border: 1px solid var(--gray-300);
            border-radius: 4px;
            font-size: 13px;
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
              <div class="panel-header">
                <h2>扫描找到的文本 (${replacements.length})</h2>
                <button id="open-api-translation" class="tool-btn" title="配置API自动翻译">
                  <span class="tool-icon">🌐</span>
                  <span>API翻译配置</span>
                </button>
              </div>
              <div class="filter-container">
                <input type="text" id="filter-input" placeholder="输入关键词筛选文本">
              </div>
              <div id="replacements-list">
                ${replacementsHtml}
              </div>
            </div>
          </div>
          <div class="button-panel">
            <div class="btn-group">
              <button id="select-all" class="confirm-btn" ${!hasLocaleFiles ? 'disabled' : ''}>全选</button>
              <button id="deselect-all" class="cancel-btn" ${!hasLocaleFiles ? 'disabled' : ''}>取消全选</button>
            </div>
            <div class="btn-group">
              <button id="replace-selected" class="confirm-btn" ${(replacements.length === 0 || !hasLocaleFiles) ? 'disabled' : ''}>替换选中项 (${replacements.length})</button>
              <button id="close-panel" class="cancel-btn">关闭面板</button>
            </div>
          </div>
          <div class="status-bar">
            <div>${hasLocaleFiles ? `匹配到国际化键: ${replacements.length}` : '请先选择国际化文件'}</div>
            <div>${hasLocaleFiles ? '未匹配到的需要手动填写键名' : ''}</div>
          </div>
        </div>
        ${scriptSection}
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
        console.log('关闭面板');
        // 确保面板存在
        if (this.panel) {
          this.panel.dispose();
          this.panel = undefined;
        }
        break;
      case 'addPattern':
        await this.addPattern(message.pattern);
        break;
      case 'removePattern':
        await this.removePattern(message.pattern);
        break;
      case 'refreshScan':
        console.log('收到刷新扫描请求');
        // 重新分析当前文档
        await this.analyzeAndLoadPanel();
        break;
      case 'selectLocalesFiles':
        await this.selectLocalesFiles();
        break;
      case 'openApiTranslation':
        try {
          // 使用 await 确保命令执行完成
          await vscode.commands.executeCommand('i18n-swapper.openApiTranslationConfig', this.context);
        } catch (error) {
          console.error('打开 API 翻译配置失败:', error);
          vscode.window.showErrorMessage(`无法打开 API 翻译配置: ${error.message}`);
        }
        break;
      case 'translateItem':
        try {
          console.log(`[消息] 收到翻译请求，索引: ${message.index}, 键: ${message.key || '无'}`);
          await this.translateItem(message.index, message.key);
        } catch (error) {
          console.error('翻译处理失败:', error);
          vscode.window.showErrorMessage(`翻译处理失败: ${error.message}`);
        }
        break;
      case 'updateSelection':
        console.log('更新选中项:', message.selectedIndexes);
        // 更新选中状态
        if (message.selectedIndexes && Array.isArray(message.selectedIndexes)) {
          this.selectedIndexes = message.selectedIndexes;
        }
        break;
      case 'batchReplace':
        console.log('执行批量替换:', message.selectedIndexes);
        // 确保有选中项
        if (!message.selectedIndexes || message.selectedIndexes.length === 0) {
          vscode.window.showInformationMessage('请先选择要替换的项');
          return;
        }
        await this.doBatchReplace(message.selectedIndexes);
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

  /**
   * 翻译指定项并生成键
   * @param {number} index 替换项索引
   */
  async translateItem(index, userInputKey = '') {
    if (index < 0 || index >= this.replacements.length) return;
    
    const item = this.replacements[index];
    if (!item || !item.text) return;
    
    try {
      console.log(`[翻译开始] 索引: ${index}, 文本: "${item.text}"`);
      
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
        suggestedKey = this.generateKeyFromText(item.text);
      }
      
      // 更新键名
      item.i18nKey = suggestedKey;
      
      console.log(`[翻译] 使用键名: ${suggestedKey}, 源语言: ${sourceLanguage}`);
      
      // 获取语言映射
      const languageMappings = config.get('tencentTranslation.languageMappings', []);
      console.log(`[翻译] 语言映射配置: ${JSON.stringify(languageMappings)}`);
      
      // 无法继续翻译
      if (!languageMappings || languageMappings.length === 0) {
        vscode.window.showWarningMessage('未配置语言映射，请先在API翻译配置中添加语言映射');
        return;
      }
      
      // 使用进度提示
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "正在翻译...",
        cancellable: false
      }, async (progress) => {
        // 获取工作区路径
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
          throw new Error('未找到工作区文件夹');
        }
        const rootPath = workspaceFolders[0].uri.fsPath;
        
        // 遍历所有目标语言进行翻译
        for (const mapping of languageMappings) {
          try {
            progress.report({ message: `翻译为 ${this.getLanguageName(mapping.languageCode)}...` });
            
            // 如果是源语言，直接使用原文
            if (mapping.languageCode === sourceLanguage) {
              await this.saveTranslationToFile(
                path.join(rootPath, mapping.filePath),
                suggestedKey,
                item.text
              );
              continue;
            }
            
            // 调用翻译API
            const translatedText = await this.translateText(
              item.text,
              sourceLanguage,
              mapping.languageCode,
              apiKey,
              apiSecret,
              region
            );
            
            console.log(`[翻译结果] ${mapping.languageCode}: "${translatedText}"`);
            
            // 保存翻译结果
            await this.saveTranslationToFile(
              path.join(rootPath, mapping.filePath),
              suggestedKey,
              translatedText
            );
          } catch (error) {
            console.error(`翻译到 ${mapping.languageCode} 失败:`, error);
            vscode.window.showErrorMessage(`翻译到 ${this.getLanguageName(mapping.languageCode)} 失败: ${error.message}`);
          }
        }
        
        vscode.window.showInformationMessage(`已生成键名 "${suggestedKey}" 并保存翻译`);
      });
    } catch (error) {
      console.error('[翻译严重错误]:', error);
      vscode.window.showErrorMessage(`翻译失败: ${error.message}`);
    }
  }

  /**
   * 调用腾讯云翻译API
   */
  async translateText(text, sourceLanguage, targetLanguage, secretId, secretKey, region) {
    return new Promise((resolve, reject) => {
      try {
        const endpoint = 'tmt.tencentcloudapi.com';
        const service = 'tmt';
        const action = 'TextTranslate';
        const version = '2018-03-21';
        const timestamp = Math.round(new Date().getTime() / 1000);
        
        // 请求参数
        const requestParams = {
          SourceText: text,
          Source: sourceLanguage,
          Target: targetLanguage,
          ProjectId: 0
        };
        
        console.log(`[API请求] 参数:`, requestParams);
        
        // 参数签名
        const requestParamString = JSON.stringify(requestParams);
        
        // 生成签名所需参数
        const hashedRequestPayload = crypto
          .createHash('sha256')
          .update(requestParamString)
          .digest('hex');
        
        const canonicalRequest = [
          'POST',
          '/',
          '',
          'content-type:application/json; charset=utf-8',
          'host:' + endpoint,
          '',
          'content-type;host',
          hashedRequestPayload
        ].join('\n');
        
        const date = new Date(timestamp * 1000).toISOString().split('T')[0];
        const stringToSign = [
          'TC3-HMAC-SHA256',
          timestamp,
          `${date}/${service}/tc3_request`,
          crypto
            .createHash('sha256')
            .update(canonicalRequest)
            .digest('hex')
        ].join('\n');
        
        // 计算签名
        const secretDate = crypto
          .createHmac('sha256', 'TC3' + secretKey)
          .update(date)
          .digest();
        
        const secretService = crypto
          .createHmac('sha256', secretDate)
          .update(service)
          .digest();
        
        const secretSigning = crypto
          .createHmac('sha256', secretService)
          .update('tc3_request')
          .digest();
        
        const signature = crypto
          .createHmac('sha256', secretSigning)
          .update(stringToSign)
          .digest('hex');
        
        // 构造授权信息 - 修复授权头格式
        const authorization = 
          'TC3-HMAC-SHA256 ' +
          `Credential=${secretId}/${date}/${service}/tc3_request, ` +
          'SignedHeaders=content-type;host, ' +
          `Signature=${signature}`;
        
        // 配置请求头
        const headers = {
          'Authorization': authorization,
          'Content-Type': 'application/json; charset=utf-8',
          'Host': endpoint,
          'X-TC-Action': action,
          'X-TC-Timestamp': timestamp.toString(),
          'X-TC-Version': version,
          'X-TC-Region': region
        };
        
        console.log(`[API请求] Authorization: ${authorization}`);
        console.log(`[API请求] 发送请求到: ${endpoint}`);
        
        // 发送请求
        const req = https.request({
          hostname: endpoint,
          method: 'POST',
          headers: headers,
          protocol: 'https:'
        }, (res) => {
          const chunks = [];
          
          res.on('data', (chunk) => chunks.push(chunk));
          
          res.on('end', () => {
            try {
              const responseBody = Buffer.concat(chunks).toString();
              console.log(`[API响应] ${responseBody}`);
              
              const response = JSON.parse(responseBody);
              if (response.Response && response.Response.Error) {
                reject(new Error(`${response.Response.Error.Code}: ${response.Response.Error.Message}`));
              } else if (response.Response && response.Response.TargetText) {
                resolve(response.Response.TargetText);
              } else {
                reject(new Error('无效的API响应'));
              }
            } catch (error) {
              reject(error);
            }
          });
        });
        
        req.on('error', (error) => {
          console.error('[API错误]', error);
          reject(error);
        });
        
        req.write(requestParamString);
        req.end();
        
      } catch (error) {
        console.error('[API调用错误]', error);
        reject(error);
      }
    });
  }

  /**
   * 根据文本生成键名
   * @param {string} text 原文
   * @returns {string} 生成的键名
   */
  generateKeyFromText(text) {
    // 清理文本
    let cleanText = text
      .replace(/['"]/g, '') // 移除引号
      .trim()
      .toLowerCase();
    
    // 截取前20个字符
    if (cleanText.length > 20) {
      cleanText = cleanText.substring(0, 20);
    }
    
    // 将中文转为拼音或使用其他替代方案
    // 这里使用简单替换，实际项目中可能需要更复杂的转换
    const timestamp = Date.now().toString().substring(8); // 使用时间戳后5位作为唯一标识
    
    return `common.text.${timestamp}`;
  }

  /**
   * 将翻译保存到文件
   * @param {string} filePath 文件路径
   * @param {string} key 国际化键
   * @param {string} value 翻译值
   */
  async saveTranslationToFile(filePath, key, value) {
    try {
      console.log(`[文件] 开始保存翻译到: ${filePath}`);
      
      // 确保路径存在
      const dirPath = path.dirname(filePath);
      if (!fs.existsSync(dirPath)) {
        console.log(`[文件] 创建目录: ${dirPath}`);
        fs.mkdirSync(dirPath, { recursive: true });
      }
      
      // 加载现有文件或创建新对象
      let localeData = {};
      if (fs.existsSync(filePath)) {
        console.log(`[文件] 加载现有文件: ${filePath}`);
        
        try {
          // 使用 utils.loadLocaleFile，它已经增强了错误处理
          localeData = utils.loadLocaleFile(filePath);
          
          // 确保返回的是一个有效对象
          if (!localeData || typeof localeData !== 'object') {
            console.log(`[文件] 加载结果无效，使用空对象`);
            localeData = {};
          }
        } catch (loadError) {
          console.error(`[文件] 加载失败，使用空对象: ${loadError.message}`);
          localeData = {};
        }
      } else {
        console.log(`[文件] 文件不存在，将创建新文件: ${filePath}`);
      }
      
      // 设置键值
      console.log(`[文件] 设置键值: ${key} = "${value}"`);
      utils.setValueByPath(localeData, key, value);
      
      // 在写入前验证对象是否可以正确序列化
      try {
        JSON.stringify(localeData);
      } catch (jsonError) {
        console.error(`[文件] 无法序列化对象: ${jsonError.message}`);
        throw new Error(`无法序列化国际化数据: ${jsonError.message}`);
      }
      
      // 保存文件
      if (filePath.endsWith('.json')) {
        // 保存前先创建一个备份
        if (fs.existsSync(filePath)) {
          const backupPath = `${filePath}.bak`;
          fs.copyFileSync(filePath, backupPath);
        }
        
        console.log(`[文件] 保存JSON文件: ${filePath}`);
        fs.writeFileSync(filePath, JSON.stringify(localeData, null, 2), 'utf8');
      } else if (filePath.endsWith('.js')) {
        // 保存前先创建一个备份
        if (fs.existsSync(filePath)) {
          const backupPath = `${filePath}.bak`;
          fs.copyFileSync(filePath, backupPath);
        }
        
        console.log(`[文件] 保存JS文件: ${filePath}`);
        const jsContent = `module.exports = ${JSON.stringify(localeData, null, 2)};`;
        fs.writeFileSync(filePath, jsContent, 'utf8');
      }
      
      console.log(`[文件] 保存成功: ${filePath}`);
      return true;
    } catch (error) {
      console.error(`[文件] 保存翻译到文件出错: ${error.message}`);
      vscode.window.showErrorMessage(`保存翻译失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取语言名称
   */
  getLanguageName(code) {
    const languages = {
      'zh': '中文',
      'en': '英文',
      'ja': '日文',
      'ko': '韩文',
      'fr': '法文',
      'de': '德文',
      'es': '西班牙文',
      'ru': '俄文'
    };
    
    return languages[code] || code;
  }

  /**
   * 执行批量替换
   * @param {number[]} indexes 选中的索引数组
   */
  async doBatchReplace(indexes) {
    if (!indexes || !Array.isArray(indexes) || indexes.length === 0) {
      vscode.window.showInformationMessage('没有选中任何项');
      return;
    }
    
    console.log('执行批量替换，选中的索引:', indexes);
    
    // 筛选有效的替换项
    const validItems = indexes
      .map(index => this.replacements[index])
      .filter(item => item && item.i18nKey);
    
    if (validItems.length === 0) {
      vscode.window.showInformationMessage('选中的项目没有可用的国际化键');
      return;
    }
    
    try {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document !== this.document) {
        vscode.window.showWarningMessage('编辑器已更改，请重新打开批量替换面板');
        return;
      }
      
      // 执行替换
      await editor.edit(editBuilder => {
        for (const item of validItems) {
          if (item.range && item.i18nKey) {
            // 确保范围有效
            const range = new vscode.Range(
              this.document.positionAt(item.range.start),
              this.document.positionAt(item.range.end)
            );
            
            // 根据文件类型生成替换代码
            const replacement = utils.generateReplacement(
              item.i18nKey,
              this.document.fileName
            );
            
            // 执行替换
            editBuilder.replace(range, replacement);
          }
        }
      });
      
      vscode.window.showInformationMessage(`成功替换了 ${validItems.length} 处文本`);
    } catch (error) {
      console.error('批量替换出错:', error);
      vscode.window.showErrorMessage(`批量替换失败: ${error.message}`);
    }
  }
}

module.exports = BatchReplacementPanel; 