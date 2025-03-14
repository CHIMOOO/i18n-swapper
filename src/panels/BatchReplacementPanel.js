const vscode = require('vscode');
const path = require('path');
const utils = require('../utils');
const fs = require('fs');
const crypto = require('crypto');
const https = require('https');
const { SUPPORTED_LANGUAGE_MAPPINGS, LANGUAGE_NAMES } = require('../utils/language-mappings');

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
// ... 现有代码保持不变 ...

/**
 * 获取WebView内容
 */
getWebviewContent(scanPatterns, replacements, localesPaths) {
  const hasLocaleFiles = localesPaths && localesPaths.length > 0;

  // 替换项渲染
  const replacementsHtml = replacements.map((item, index) => `
      <div class="replacement-item ${item.i18nKey ? 'has-key' : ''}" data-index="${index}">
        <div class="replacement-header">
          <label class="select-item">
            <input type="checkbox" class="item-checkbox" ${item.i18nKey ? 'checked' : ''}>
            <span class="checkmark"></span>
          </label>
          <div class="replacement-text">${this.escapeHtml(item.text)}</div>
        </div>
        <div class="replacement-footer">
          <div class="i18n-key-input">
            <input type="text" class="key-input" placeholder="输入国际化键" 
              value="${item.i18nKey || ''}" data-index="${index}">
            <button class="translate-btn" title="翻译并生成键" data-index="${index}">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>
              翻译
            </button>
          </div>
          ${item.i18nFile ? `<div class="found-key">找到于: <span class="key-file">${item.i18nFile}</span></div>` : ''}
        </div>
      </div>
    `).join('');

  const scriptSection = `
      <script>
 (function () {
     // 获取VS Code API实例
     const vscode = acquireVsCodeApi();

     // 确保在DOM完全加载后绑定事件
     document.addEventListener('DOMContentLoaded', function () {
           console.log('DOM加载完成，开始绑定事件');

           // ---------- 扫描模式相关事件 ----------

           // 添加模式按钮
           const addPatternBtn = document.getElementById('add-pattern-btn');
           if (addPatternBtn) {
             addPatternBtn.addEventListener('click', function () {
               const newPatternInput = document.getElementById('new-pattern');
               const pattern = newPatternInput ? newPatternInput.value.trim() : '';

               if (pattern) {
                 console.log('添加扫描模式:', pattern);
                 vscode.postMessage({
                   command: 'addPattern',
                   pattern: pattern
                 });

                 // 清空输入框
                 if (newPatternInput) {
                   newPatternInput.value = '';
                 }
               }
             });
           }

           // 删除模式按钮
           document.querySelectorAll('.pattern-remove-btn').forEach(btn => {
             btn.addEventListener('click', function () {
               const pattern = this.getAttribute('data-pattern');
               if (pattern) {
                 console.log('删除扫描模式:', pattern);
                 vscode.postMessage({
                   command: 'removePattern',
                   pattern: pattern
                 });
               }
             });
           });

           // ---------- 控制按钮事件 ----------

           // 全选按钮
           const selectAllBtn = document.getElementById('select-all');
           if (selectAllBtn) {
             selectAllBtn.addEventListener('click', function () {
               console.log('点击全选按钮');
               vscode.postMessage({
                 command: 'selectAll'
               });

               // 更新UI显示
               document.querySelectorAll('.item-checkbox').forEach(checkbox => {
                 checkbox.checked = true;
               });
             });
           }

           // 取消全选按钮
           const deselectAllBtn = document.getElementById('deselect-all');
           if (deselectAllBtn) {
             deselectAllBtn.addEventListener('click', function () {
               console.log('点击取消全选按钮');
               vscode.postMessage({
                 command: 'deselectAll'
               });

               // 更新UI显示
               document.querySelectorAll('.item-checkbox').forEach(checkbox => {
                 checkbox.checked = false;
               });
             });
           }

           // 替换选中项按钮
           const replaceSelectedBtn = document.getElementById('replace-selected');
           if (replaceSelectedBtn) {
             replaceSelectedBtn.addEventListener('click', function () {
               console.log('点击替换选中项按钮');

               // 获取选中的索引
               const selectedIndexes = [];
               document.querySelectorAll('.item-checkbox').forEach((checkbox, index) => {
                 if (checkbox.checked) {
                   selectedIndexes.push(index);
                 }
               });

               if (selectedIndexes.length === 0) {
                 alert('请先选择要替换的项');
                 return;
               }

               vscode.postMessage({
                 command: 'batchReplace',
                 selectedIndexes: selectedIndexes
               });
             });
           }

           // 关闭面板按钮
           const closeBtn = document.getElementById('close-panel');
           if (closeBtn) {
             closeBtn.addEventListener('click', function () {
               console.log('点击关闭面板按钮');
               vscode.postMessage({
                 command: 'closePanel'
               });
             });
           }

           // 刷新扫描按钮
           const refreshBtn = document.getElementById('refresh-scan');
           if (refreshBtn) {
             refreshBtn.addEventListener('click', function () {
               console.log('点击刷新扫描按钮');
               vscode.postMessage({
                 command: 'refreshScan'
               });
             });
           }

           // 选择国际化文件按钮
           const selectLocalesBtn = document.getElementById('select-locales-btn');
           if (selectLocalesBtn) {
             selectLocalesBtn.addEventListener('click', function () {
               console.log('点击选择国际化文件按钮');
               vscode.postMessage({
                 command: 'selectLocalesFiles'
               });
             });
           }

           // API翻译配置按钮
           const apiTranslationBtn = document.getElementById('open-api-translation');
           if (apiTranslationBtn) {
             apiTranslationBtn.addEventListener('click', function () {
               console.log('点击API翻译配置按钮');
               vscode.postMessage({
                 command: 'openApiTranslation'
               });
             });
           }

           // ---------- 替换项相关事件 ----------

           // 复选框更新选择状态
           document.querySelectorAll('.item-checkbox').forEach(checkbox => {
             checkbox.addEventListener('change', function () {
               const selectedIndexes = [];
               document.querySelectorAll('.item-checkbox').forEach((cb, index) => {
                 if (cb.checked) {
                   selectedIndexes.push(index);
                 }
               });

               vscode.postMessage({
                 command: 'updateSelection',
                 selectedIndexes: selectedIndexes
               });
             });
           });

           // 键名输入框
           document.querySelectorAll('.key-input').forEach(input => {
             input.addEventListener('change', function () {
               const index = parseInt(this.getAttribute('data-index'));
               vscode.postMessage({
                 command: 'updateI18nKey',
                 index: index,
                 key: this.value.trim()
               });
             });
           });

           // 翻译按钮
           document.querySelectorAll('.translate-btn').forEach(btn => {
                 btn.addEventListener('click', function () {
                       console.log('点击翻译按钮');
                       const index = parseInt(this.getAttribute('data-index'));
                       console.log('获取的索引:', index);

                       const keyInput = document.querySelector(\`.key-input[data-index="\${index}"]\`);
                console.log('找到的输入框:', keyInput);
                
                const key = keyInput ? keyInput.value.trim() : '';
                console.log('准备翻译，使用键:', key);
                
                vscode.postMessage({
                  command: 'translateItem',
                  index: index,
                  key: key
                });
              });
            });
            
            // 搜索过滤
            const filterInput = document.getElementById('filter-input');
            if (filterInput) {
              filterInput.addEventListener('input', function() {
                const searchText = this.value.toLowerCase();
                document.querySelectorAll('.replacement-item').forEach(item => {
                  const text = item.querySelector('.replacement-text').textContent.toLowerCase();
                  if (text.includes(searchText)) {
                    item.style.display = '';
                  } else {
                    item.style.display = 'none';
                  }
                });
              });
            }
            
            console.log('所有事件绑定完成');
          });
          
          // 处理来自扩展的消息
          window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.command) {
              case 'updateSelectionInUI':
                console.log('收到更新UI选择状态消息:', message);
                document.querySelectorAll('.item-checkbox').forEach((checkbox, index) => {
                  checkbox.checked = message.selectedIndexes.includes(index);
                });
                break;
                
              case 'refreshPanel':
                console.log('收到刷新面板消息');
                window.location.reload();
                break;
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
            --primary-color: #4f46e5;
            --primary-hover: #4338ca;
            --success-color: #10b981;
            --success-hover: #059669;
            --danger-color: #ef4444;
            --danger-hover: #dc2626;
            --neutral-color: #6b7280;
            --neutral-hover: #4b5563;
            --bg-color: #f9fafb;
            --card-bg: #ffffff;
            --border-color: #e5e7eb;
            --text-primary: #111827;
            --text-secondary: #4b5563;
            --text-muted: #9ca3af;
            --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
            --shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
            --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            --radius-sm: 0.25rem;
            --radius: 0.375rem;
            --radius-md: 0.5rem;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            padding: 0;
            margin: 0;
            background-color: var(--bg-color);
            color: var(--text-primary);
            line-height: 1.5;
          }
          
          /* 容器样式 */
          .container {
            display: flex;
            flex-direction: column;
            height: 100vh;
            max-width: 100%;
            margin: 0 auto;
            overflow: hidden;
          }
          
          /* 主内容区域 */
          .main-content {
            display: flex;
            gap: 1rem;
            flex: 1;
            overflow: hidden;
            padding: 1rem;
          }
          
          /* 左侧面板 */
          .left-panel {
            width: 280px;
            border-radius: var(--radius);
            background-color: var(--card-bg);
            box-shadow: var(--shadow);
            overflow-y: auto;
            display: flex;
            flex-direction: column;
          }
          
          .panel-section {
            padding: 1.25rem;
            border-bottom: 1px solid var(--border-color);
          }
          
          .panel-section:last-child {
            border-bottom: none;
          }
          
          .panel-section h2 {
            margin-top: 0;
            margin-bottom: 1rem;
            font-size: 0.875rem;
            font-weight: 600;
            color: var(--text-primary);
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
          
          /* 扫描模式列表 */
          .pattern-list {
            margin-bottom: 1rem;
          }
          
          .pattern-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.5rem 0.75rem;
            margin-bottom: 0.5rem;
            background-color: var(--bg-color);
            border-radius: var(--radius-sm);
            border: 1px solid var(--border-color);
            font-size: 0.875rem;
          }
          
          .pattern-remove-btn {
            background-color: transparent;
            border: none;
            color: var(--danger-color);
            cursor: pointer;
            font-size: 0.75rem;
            padding: 0.25rem 0.5rem;
            border-radius: var(--radius-sm);
            transition: all 0.2s;
          }
          
          .pattern-remove-btn:hover {
            background-color: #fee2e2;
          }
          
          /* 添加模式 */
          .pattern-add {
            display: flex;
            margin-bottom: 1rem;
          }
          
          .pattern-add input {
            flex: 1;
            padding: 0.5rem 0.75rem;
            border: 1px solid var(--border-color);
            border-radius: var(--radius-sm) 0 0 var(--radius-sm);
            font-size: 0.875rem;
            outline: none;
            transition: border-color 0.2s;
          }
          
          .pattern-add input:focus {
            border-color: var(--primary-color);
            box-shadow: 0 0 0 1px var(--primary-color);
          }
          
          .pattern-add button {
            background-color: var(--primary-color);
            color: white;
            border: none;
            border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
            padding: 0.5rem 0.75rem;
            cursor: pointer;
            font-size: 0.875rem;
            font-weight: 500;
            transition: background-color 0.2s;
                white-space: nowrap;
          }
          
          .pattern-add button:hover {
            background-color: var(--primary-hover);
          }
          
          /* 国际化文件设置 */
          .locale-settings {
            margin-bottom: 1rem;
          }
          
          .locale-files {
            margin-bottom: 1rem;
          }
          
          .locale-file-item {
            padding: 0.5rem 0.75rem;
            background-color: var(--bg-color);
            border: 1px solid var(--border-color);
            border-radius: var(--radius-sm);
            margin-bottom: 0.5rem;
            font-size: 0.75rem;
            word-break: break-all;
          }
          
          .no-files-warning {
            color: #b45309;
            padding: 0.75rem;
            background-color: #fffbeb;
            border-radius: var(--radius-sm);
            margin-bottom: 1rem;
            font-size: 0.875rem;
            border-left: 3px solid #f59e0b;
          }
          
          /* 按钮样式 */
          .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 0.5rem 1rem;
            border-radius: var(--radius-sm);
            font-size: 0.875rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            border: none;
            width: 100%;
          }
          
          .btn-primary {
            background-color: var(--primary-color);
            color: white;
          }
          
          .btn-primary:hover {
            background-color: var(--primary-hover);
          }
          
          .btn-success {
            background-color: var(--success-color);
            color: white;
          }
          
          .btn-success:hover {
            background-color: var(--success-hover);
          }
          
          .btn-danger {
            background-color: var(--danger-color);
            color: white;
          }
          
          .btn-danger:hover {
            background-color: var(--danger-hover);
          }
          
          .btn-neutral {
            background-color: var(--neutral-color);
            color: white;
          }
          
          .btn-neutral:hover {
            background-color: var(--neutral-hover);
          }
          
          .btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
          
          .btn svg {
            margin-right: 0.5rem;
            width: 1rem;
            height: 1rem;
          }
          
          /* 右侧面板 */
          .right-panel {
            flex: 1;
            border-radius: var(--radius);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            background-color: var(--card-bg);
            box-shadow: var(--shadow);
          }
          
          .disabled-panel {
            opacity: 0.7;
            pointer-events: none;
          }
          
          .panel-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1rem 1.25rem;
            border-bottom: 1px solid var(--border-color);
            background-color: var(--card-bg);
          }
          
          .panel-header h2 {
            margin: 0;
            font-size: 1rem;
            font-weight: 600;
            color: var(--text-primary);
            display: flex;
            align-items: center;
          }
          
          .panel-header h2 .count-badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background-color: var(--primary-color);
            color: white;
            border-radius: 9999px;
            padding: 0.125rem 0.5rem;
            font-size: 0.75rem;
            margin-left: 0.5rem;
          }
          
          .tool-btn {
            display: flex;
            align-items: center;
            background-color: var(--bg-color);
            border: 1px solid var(--border-color);
            border-radius: var(--radius-sm);
            padding: 0.5rem 0.75rem;
            cursor: pointer;
            font-size: 0.875rem;
            transition: all 0.2s;
          }
          
          .tool-btn:hover {
            background-color: #f3f4f6;
            border-color: #d1d5db;
          }
          
          .tool-icon {
            margin-right: 0.5rem;
          }
          
          /* 过滤器 */
          .filter-container {
            padding: 0.75rem 1.25rem;
            border-bottom: 1px solid var(--border-color);
            background-color: var(--card-bg);
          }
          
          .filter-input-wrapper {
            position: relative;
          }
          
          .filter-input-wrapper svg {
            position: absolute;
            left: 0.75rem;
            top: 50%;
            transform: translateY(-50%);
            color: var(--text-muted);
            width: 1rem;
            height: 1rem;
          }
          
          .filter-container input {
            width: 100%;
            padding: 0.625rem 0.75rem 0.625rem 2.25rem;
            border: 1px solid var(--border-color);
            border-radius: var(--radius-sm);
            font-size: 0.875rem;
            background-color: var(--bg-color);
            box-sizing: border-box;
            outline: none;
            transition: all 0.2s;
          }
          
          .filter-container input:focus {
            border-color: var(--primary-color);
            box-shadow: 0 0 0 1px var(--primary-color);
          }
          
          /* 替换项列表 */
          #replacements-list {
            flex: 1;
            overflow-y: auto;
            padding: 1rem;
            background-color: var(--bg-color);
          }
          
          .replacement-item {
            border: 1px solid var(--border-color);
            border-radius: var(--radius);
            margin-bottom: 1rem;
            background-color: var(--card-bg);
            box-shadow: var(--shadow-sm);
            transition: all 0.2s;
            overflow: hidden;
          }
          
          .replacement-item:hover {
            box-shadow: var(--shadow-md);
          }
          
          .replacement-item.has-key {
            border-left: 3px solid var(--success-color);
          }
          
          .replacement-header {
            display: flex;
            align-items: center;
    justify-content: center;
            padding: 0.75rem 1rem;
            background-color: var(--card-bg);
            border-bottom: 1px solid var(--border-color);
          }
          
          .select-item {
            margin-right: 0.75rem;
            align-self: flex-start;
            position: relative;
            display: inline-block;
            cursor: pointer;
            user-select: none;
          }
          
          .select-item input {
            position: absolute;
            opacity: 0;
            cursor: pointer;
            height: 0;
            width: 0;
          }
          
          .checkmark {
            position: relative;
            display: inline-block;
            height: 1.125rem;
            width: 1.125rem;
            background-color: var(--bg-color);
            border: 1px solid var(--border-color);
            border-radius: var(--radius-sm);
            transition: all 0.2s;
          }
          
          .select-item:hover .checkmark {
            background-color: #f3f4f6;
          }
          
          .select-item input:checked ~ .checkmark {
            background-color: var(--primary-color);
            border-color: var(--primary-color);
          }
          
          .checkmark:after {
            content: "";
            position: absolute;
            display: none;
          }
          
          .select-item input:checked ~ .checkmark:after {
            display: block;
          }
          
          .select-item .checkmark:after {
            left: 0.375rem;
            top: 0.125rem;
            width: 0.25rem;
            height: 0.5rem;
            border: solid white;
            border-width: 0 2px 2px 0;
            transform: rotate(45deg);
          }
          
          .replacement-text {
            flex: 1;
            white-space: pre-wrap;
            overflow-wrap: break-word;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
            font-size: 0.875rem;
            line-height: 1.5;
            color: var(--text-primary);
          }
          
          .replacement-footer {
            padding: 0.75rem 1rem;
            background-color: #f9fafb;
          }
          
          .i18n-key-input {
            display: flex;
            gap: 0.5rem;
          }
          
          .i18n-key-input input {
            flex: 1;
            padding: 0.5rem 0.75rem;
            border: 1px solid var(--border-color);
            border-radius: var(--radius-sm);
            font-size: 0.875rem;
            background-color: white;
            outline: none;
            transition: all 0.2s;
          }
          
          .i18n-key-input input:focus {
            border-color: var(--primary-color);
            box-shadow: 0 0 0 1px var(--primary-color);
          }
          
          .translate-btn {
            display: inline-flex;
            align-items: center;
            background-color: var(--primary-color);
            color: white;
            border: none;
            border-radius: var(--radius-sm);
            padding: 0.5rem 0.75rem;
            cursor: pointer;
            font-size: 0.875rem;
            font-weight: 500;
            transition: background-color 0.2s;
          }
          
          .translate-btn:hover {
            background-color: var(--primary-hover);
          }
          
          .translate-btn svg {
            margin-right: 0.375rem;
            width: 1rem;
            height: 1rem;
          }
          
          .found-key {
            font-size: 0.75rem;
            color: var(--text-secondary);
            margin-top: 0.5rem;
            display: flex;
            align-items: center;
          }
          
          .found-key:before {
            content: "";
            display: inline-block;
            width: 0.5rem;
            height: 0.5rem;
            background-color: var(--success-color);
            border-radius: 50%;
            margin-right: 0.375rem;
          }
          
          .key-file {
            color: var(--primary-color);
            font-weight: 500;
          }
          
          /* 按钮面板 */
          .button-panel {
            display: flex;
            justify-content: space-between;
            padding: 1rem;
            background-color: var(--card-bg);
            border-top: 1px solid var(--border-color);
          }
            .button-panel button{
              white-space: nowrap;
            }
          
          .btn-group {
            display: flex;
            gap: 0.5rem;
          }
          
          /* 状态栏 */
          .status-bar {
            display: flex;
            justify-content: space-between;
            font-size: 0.75rem;
            color: var(--text-secondary);
            padding: 0.75rem 1rem;
            background-color: var(--card-bg);
            border-top: 1px solid var(--border-color);
          }
          
          /* 响应式调整 */
          @media (max-width: 768px) {
            .main-content {
              flex-direction: column;
            }
            
            .left-panel {
              width: 100%;
              margin-bottom: 1rem;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="main-content">
            <div class="left-panel">
              <div class="panel-section">
                <h2>扫描配置</h2>
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
              </div>
              
              <div class="panel-section">
                <h2>国际化字库文件</h2>
                ${hasLocaleFiles ? `
                  <div class="locale-files">
                    ${localesPaths.map(file => `
                      <div class="locale-file-item">${file}</div>
                    `).join('')}
                  </div>
                ` : `
                  <div class="no-files-warning">
                    未配置国际化字库，请先选择文件
                  </div>
                `}
                <button id="select-locales-btn" class="btn btn-primary">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  选择国际化文件
                </button>
              </div>
              
              <div class="panel-section">
                <button id="refresh-scan" class="btn btn-success" ${!hasLocaleFiles ? 'disabled' : ''}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
                  刷新扫描
                </button>
              </div>
            </div>
            
            <div class="right-panel ${!hasLocaleFiles ? 'disabled-panel' : ''}">
              <div class="panel-header">
                <h2>
                  扫描找到的文本
                  <span class="count-badge">${replacements.length}</span>
                </h2>
                <button id="open-api-translation" class="tool-btn" title="配置API自动翻译">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m16.2 7.8-2 6.3-6.4 2.1 2-6.3z"/></svg>
                  API翻译配置
                </button>
              </div>
              
              <div class="filter-container">
                <div class="filter-input-wrapper">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                  <input type="text" id="filter-input" placeholder="输入关键词筛选文本">
                </div>
              </div>
              
              <div id="replacements-list">
                ${replacementsHtml}
              </div>
              
              <div class="button-panel">
                <div class="btn-group">
                  <button id="select-all" class="btn btn-primary" ${!hasLocaleFiles ? 'disabled' : ''}>
                     全选
                  </button>
                  <button id="deselect-all" class="btn btn-neutral" ${!hasLocaleFiles ? 'disabled' : ''}>
                    取消全选
                  </button>
                </div>
                <div class="btn-group">
                  <button id="replace-selected" class="btn btn-success" ${(replacements.length === 0 || !hasLocaleFiles) ? 'disabled' : ''}>
                    替换选中项 (${replacements.length})
                  </button>
                  <button id="close-panel" class="btn btn-danger">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    关闭面板
                  </button>
                </div>
              </div>
              
              <div class="status-bar">
                <div>${hasLocaleFiles ? `匹配到国际化键: ${replacements.length}` : '请先选择国际化文件'}</div>
                <div>${hasLocaleFiles ? '未匹配到的需要手动填写键名' : ''}</div>
              </div>
            </div>
          </div>
        </div>
        ${scriptSection}
      </body>
      </html>
    `;
}

// ... 其余代码保持不变 ...
  /**
   * 转义HTML特殊字符
   */
  escapeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
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
   * 选择或取消选择所有项
   * @param {boolean} select 是否选择
   */
  selectAllItems(select) {
    console.log(`${select ? '选择' : '取消选择'}所有项`);
    
    if (!this.panel) return;
    
    try {
      // 更新所有项的选中状态
      this.selectedIndexes = select 
        ? Array.from({ length: this.replacements.length }, (_, i) => i)
        : [];
      
      // 更新UI中的选中状态
      this.panel.webview.postMessage({
        command: 'updateSelectionInUI',
        selectedIndexes: this.selectedIndexes,
        selectAll: select
      });
      
      console.log(`已${select ? '选择' : '取消选择'}所有项，共 ${this.selectedIndexes.length} 项`);
    } catch (error) {
      console.error(`选择所有项失败:`, error);
    }
  }

  /**
   * 添加扫描模式
   * @param {string} pattern 模式字符串
   */
  async addPattern(pattern) {
    if (!pattern) return;
    
    console.log(`添加扫描模式: ${pattern}`);
    
    try {
      // 获取当前配置
      const config = vscode.workspace.getConfiguration('i18n-swapper');
      let scanPatterns = config.get('scanPatterns', []);
      
      // 检查是否已存在
      if (scanPatterns.includes(pattern)) {
        vscode.window.showInformationMessage(`扫描模式 "${pattern}" 已存在`);
        return;
      }
      
      // 添加新模式
      scanPatterns.push(pattern);
      
      // 更新配置
      await config.update('scanPatterns', scanPatterns, vscode.ConfigurationTarget.Workspace);
      
      // 刷新分析
      await this.analyzeAndLoadPanel();
      
      vscode.window.showInformationMessage(`已添加扫描模式: ${pattern}`);
    } catch (error) {
      console.error(`添加扫描模式失败:`, error);
      vscode.window.showErrorMessage(`添加扫描模式失败: ${error.message}`);
    }
  }

  /**
   * 移除扫描模式
   * @param {string} pattern 模式字符串
   */
  async removePattern(pattern) {
    if (!pattern) return;
    
    console.log(`移除扫描模式: ${pattern}`);
    
    try {
      // 获取当前配置
      const config = vscode.workspace.getConfiguration('i18n-swapper');
      let scanPatterns = config.get('scanPatterns', []);
      
      // 移除模式
      scanPatterns = scanPatterns.filter(p => p !== pattern);
      
      // 更新配置
      await config.update('scanPatterns', scanPatterns, vscode.ConfigurationTarget.Workspace);
      
      // 刷新分析
      await this.analyzeAndLoadPanel();
      
      vscode.window.showInformationMessage(`已移除扫描模式: ${pattern}`);
    } catch (error) {
      console.error(`移除扫描模式失败:`, error);
      vscode.window.showErrorMessage(`移除扫描模式失败: ${error.message}`);
    }
  }

  /**
   * 选择国际化文件
   */
  async selectLocalesFiles() {
    try {
      const options = {
        canSelectMany: true,
        filters: {
          '国际化文件': ['js', 'json']
        },
        openLabel: '选择国际化文件'
      };

      const fileUris = await vscode.window.showOpenDialog(options);
      if (!fileUris || fileUris.length === 0) {
        return;
      }

      // 转换为相对路径
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        vscode.window.showErrorMessage('未找到工作区文件夹');
        return;
      }
      const rootPath = workspaceFolders[0].uri.fsPath;

      // 更新配置
      const relativePaths = fileUris.map(uri => {
        const fullPath = uri.fsPath;
        const relativePath = path.relative(rootPath, fullPath);
        // 确保使用 / 分隔符
        return relativePath.replace(/\\/g, '/');
      });

      const config = vscode.workspace.getConfiguration('i18n-swapper');
      await config.update('localesPaths', relativePaths, vscode.ConfigurationTarget.Workspace);

      // 询问是否要添加更多语言文件
      const createMoreLangs = await vscode.window.showInformationMessage(
        '已添加国际化文件。是否要快速创建更多语言文件？',
        '创建',
        '取消'
      );

      if (createMoreLangs === '创建') {
        await this.showLanguageSelector();
      }

      // 刷新分析
      await this.analyzeAndLoadPanel();
    } catch (error) {
      console.error('选择国际化文件出错:', error);
      vscode.window.showErrorMessage(`选择国际化文件失败: ${error.message}`);
    }
  }

  /**
   * 显示语言选择器对话框
   */
  async showLanguageSelector() {
    try {
      // 获取源语言
      const config = vscode.workspace.getConfiguration('i18n-swapper');
      const sourceLanguage = await vscode.window.showQuickPick(
        Object.keys(SUPPORTED_LANGUAGE_MAPPINGS).map(code => ({
          label: LANGUAGE_NAMES[code] || code,
          description: code,
          code: code
        })),
        {
          title: '选择源语言',
          placeHolder: '请选择源语言'
        }
      );

      if (!sourceLanguage) return;

      // 获取可用的目标语言
      const availableTargets = SUPPORTED_LANGUAGE_MAPPINGS[sourceLanguage.code] || [];
      
      // 如果没有可用的目标语言
      if (availableTargets.length === 0) {
        vscode.window.showInformationMessage(`${sourceLanguage.label} 没有可翻译的目标语言`);
        return;
      }

      // 显示多选对话框
      const selectedTargets = await vscode.window.showQuickPick(
        availableTargets.map(code => ({
          label: LANGUAGE_NAMES[code] || code,
          description: code,
          code: code,
          picked: true
        })),
        {
          title: `为 ${sourceLanguage.label} 选择目标语言`,
          placeHolder: '选择要创建的目标语言文件',
          canPickMany: true
        }
      );

      if (!selectedTargets || selectedTargets.length === 0) return;

      // 选择文件夹来保存国际化文件
      const folderUri = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: '选择保存国际化文件的文件夹'
      });

      if (!folderUri || folderUri.length === 0) return;

      const baseFolderPath = folderUri[0].fsPath;
      
      // 选择文件格式
      const fileFormat = await vscode.window.showQuickPick(
        ['JSON (.json)', 'JavaScript (.js)'],
        {
          title: '选择文件格式',
          placeHolder: '请选择国际化文件格式'
        }
      );

      if (!fileFormat) return;
      
      const extension = fileFormat.includes('JSON') ? '.json' : '.js';
      
      // 创建文件
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        vscode.window.showErrorMessage('未找到工作区文件夹');
        return;
      }
      const rootPath = workspaceFolders[0].uri.fsPath;
      
      // 创建文件并添加到配置
      const createdPaths = [];
      const relativePaths = [];
      
      // 创建源语言文件
      const sourceFileName = `${sourceLanguage.code}${extension}`;
      const sourceFilePath = path.join(baseFolderPath, sourceFileName);
      
      if (!fs.existsSync(sourceFilePath)) {
        // 创建空对象
        if (extension === '.json') {
          fs.writeFileSync(sourceFilePath, '{}', 'utf8');
        } else {
          fs.writeFileSync(sourceFilePath, 'module.exports = {};', 'utf8');
        }
        createdPaths.push(sourceFilePath);
        
        const relativeSourcePath = path.relative(rootPath, sourceFilePath).replace(/\\/g, '/');
        relativePaths.push(relativeSourcePath);
      }
      
      // 创建目标语言文件
      for (const target of selectedTargets) {
        const fileName = `${target.code}${extension}`;
        const filePath = path.join(baseFolderPath, fileName);
        
        if (!fs.existsSync(filePath)) {
          // 创建空对象
          if (extension === '.json') {
            fs.writeFileSync(filePath, '{}', 'utf8');
          } else {
            fs.writeFileSync(filePath, 'module.exports = {};', 'utf8');
          }
          createdPaths.push(filePath);
        }
        
        const relativePath = path.relative(rootPath, filePath).replace(/\\/g, '/');
        relativePaths.push(relativePath);
      }
      
      // 更新配置
      const localesPaths = config.get('localesPaths', []);
      // 合并并去重
      const updatedPaths = [...new Set([...localesPaths, ...relativePaths])];
      await config.update('localesPaths', updatedPaths, vscode.ConfigurationTarget.Workspace);
      
      // 创建语言映射
      const languageMap = {};
      languageMap[sourceLanguage.code] = relativePaths.find(p => p.includes(sourceLanguage.code));
      
      for (const target of selectedTargets) {
        const targetPath = relativePaths.find(p => p.includes(target.code));
        if (targetPath) {
          languageMap[target.code] = targetPath;
        }
      }
      
      await config.update('languages', languageMap, vscode.ConfigurationTarget.Workspace);
      
      vscode.window.showInformationMessage(
        `已创建 ${createdPaths.length} 个语言文件并更新配置`
      );
      
      // 刷新分析
      await this.analyzeAndLoadPanel();
    } catch (error) {
      console.error('创建语言文件出错:', error);
      vscode.window.showErrorMessage(`创建语言文件失败: ${error.message}`);
    }
  }

  /**
   * 执行选中项的替换
   */
  async performSelectedReplacements() {
    console.log('执行选中项的替换');
    
    if (!this.selectedIndexes || this.selectedIndexes.length === 0) {
      vscode.window.showInformationMessage('请先选择要替换的项');
      return;
    }
    
    await this.doBatchReplace(this.selectedIndexes);
  }

  /**
   * 更新项的国际化键
   * @param {number} index 项索引
   * @param {string} key 国际化键
   */
  updateI18nKey(index, key) {
    if (index < 0 || index >= this.replacements.length) return;
    
    console.log(`更新项 ${index} 的键为: ${key}`);
    this.replacements[index].i18nKey = key;
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
    return LANGUAGE_NAMES[code] || code;
  }
}

module.exports = BatchReplacementPanel; 