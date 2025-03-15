/**
 * 转义HTML特殊字符，防止XSS攻击
 * @param {string} text 需要转义的文本
 * @returns {string} 转义后的文本
 */
function escapeHtml(text) {
  if (text === undefined || text === null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * 生成面板HTML内容
 * @param {string[]} scanPatterns 扫描模式
 * @param {Array} replacements 替换项
 * @param {string[]} localesPaths 国际化文件路径
 * @param {vscode.ExtensionContext} context 扩展上下文
 * @param {boolean} isConfigExpanded 配置面板是否展开
 * @returns {string} HTML内容
 */
function getPanelHtml(scanPatterns, replacements, localesPaths, context, isConfigExpanded = false) {
  // 根据展开状态设置类和样式
  const configSectionClass = isConfigExpanded ? 'collapsible-section active' : 'collapsible-section';
  const configContentStyle = isConfigExpanded ? 'display: block;' : 'display: none;';
  
  return `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>批量替换国际化</title>
      <style>
        body {
          font-family: var(--vscode-font-family);
          font-size: var(--vscode-font-size);
          color: var(--vscode-foreground);
          background-color: var(--vscode-editor-background);
          padding: 10px;
          margin: 0;
        }
        .container {
          display: flex;
          flex-direction: column;
          height: calc(100vh - 20px);
        }
        .toolbar {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
          padding: 5px;
          background-color: var(--vscode-editor-background);
          border-bottom: 1px solid var(--vscode-panel-border);
        }
        .tools-group {
          display: flex;
          gap: 5px;
        }
        button {
          background-color: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          border: none;
          padding: 5px 10px;
          cursor: pointer;
          border-radius: 2px;
        }
        button:hover {
          background-color: var(--vscode-button-hoverBackground);
        }
        .replacements-list {
          flex: 1;
          overflow: auto;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        thead {
          position: sticky;
          top: 0;
          background-color: var(--vscode-editor-background);
          z-index: 1;
        }
        th, td {
          padding: 8px;
          text-align: left;
          border-bottom: 1px solid var(--vscode-panel-border);
        }
        .checkbox-cell {
          width: 30px;
        }
        .text-cell {
          max-width: 300px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .has-key {
          color: var(--vscode-gitDecoration-addedResourceForeground);
        }
        .i18n-key-input {
          background-color: var(--vscode-input-background);
          color: var(--vscode-input-foreground);
          border: 1px solid var(--vscode-input-border);
          padding: 3px 5px;
          width: 200px;
        }
        .translate-btn {
          margin-left: 5px;
          display: inline-flex;
          align-items: center;
          gap: 3px;
        }
        .translate-btn svg {
          width: 12px;
          height: 12px;
        }
        .select-all-container {
          display: flex;
          align-items: center;
          margin-bottom: 5px;
        }
        input[type="checkbox"] {
          margin-right: 5px;
        }
        .footer {
          margin-top: 10px;
          padding: 5px;
          display: flex;
          justify-content: space-between;
          border-top: 1px solid var(--vscode-panel-border);
        }
        .config-section {
          margin-top: 20px;
          padding: 10px;
          border: 1px solid var(--vscode-panel-border);
          border-radius: 3px;
        }
        .config-section h3 {
          margin-top: 0;
          margin-bottom: 10px;
        }
        .config-row {
          margin-bottom: 15px;
        }
        .pattern-list, .locale-paths-list {
          margin: 5px 0;
          padding: 0;
          list-style: none;
        }
        .pattern-item, .locale-path-item {
          display: flex;
          align-items: center;
          margin-bottom: 5px;
          padding: 3px;
          border: 1px solid var(--vscode-input-border);
          border-radius: 3px;
        }
        .pattern-item span, .locale-path-item span {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .new-pattern-input {
          display: flex;
          margin-top: 5px;
        }
        .new-pattern-input input {
          flex: 1;
          margin-right: 5px;
          padding: 3px 5px;
          background-color: var(--vscode-input-background);
          color: var(--vscode-input-foreground);
          border: 1px solid var(--vscode-input-border);
        }
        .collapsible-section {
          cursor: pointer;
          padding: 10px;
          background-color: var(--vscode-editor-background);
          border: 1px solid var(--vscode-panel-border);
          margin-top: 20px;
          border-radius: 3px;
          display: flex;
          align-items: center;
        }
        .collapsible-section h3 {
          margin: 0;
          flex: 1;
        }
        .collapsible-section::after {
          content: '🔽';
          font-size: 12px;
          margin-left: 10px;
        }
        .collapsible-section.active::after {
          content: '🔼';
        }
        .collapsible-section-content {
          padding: 10px;
          display: none;
          border: 1px solid var(--vscode-panel-border);
          border-top: none;
          border-radius: 0 0 3px 3px;
        }
        .config-row {
          margin-bottom: 15px;
        }
        /* 确保内部元素的事件不会受到影响 */
        .pattern-item, .locale-path-item, .new-pattern-input {
          pointer-events: all;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="toolbar">
          <div class="tools-group">
            <button id="replace-selected">替换选中项</button>
            <button id="replace-all">替换所有项</button>
            <button id="refresh-panel">刷新</button>
            <button id="create-language-files">创建语言文件</button>
            <button id="open-api-translation">API翻译配置</button>
          </div>
          <div class="tools-group">
            <div class="select-all-container">
              <input type="checkbox" id="select-all">
              <label for="select-all">全选</label>
            </div>
          </div>
        </div>
        
        <div class="replacements-list">
          <table>
            <thead>
              <tr>
                <th class="checkbox-cell"></th>
                <th>序号</th>
                <th>文本</th>
                <th>国际化键</th>
                <th>来源</th>
                <th>其他</th>
              </tr>
            </thead>
            <tbody>
              ${replacements.map((item, index) => `
                <tr>
                  <td class="checkbox-cell">
                    <input type="checkbox" class="item-checkbox" data-index="${index}" ${item.selected ? 'checked' : ''}>
                  </td>
                  <td>${index + 1}</td>
                  <td class="text-cell ${item.i18nKey ? 'has-key' : ''}" title="${escapeHtml(item.text)}">
                    ${escapeHtml(item.text)}
                  </td>
                  <td>
                    <input type="text" class="i18n-key-input" data-index="${index}" 
                      value="${escapeHtml(item.i18nKey || '')}" placeholder="输入国际化键">
                    <button class="translate-btn" data-index="${index}" title="翻译并保存到所有语言文件">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>
                      翻译
                    </button>
                  </td>
                  <td>${escapeHtml(item.source || '文本')}</td>
                  <td>${item.i18nFile ? `来自: ${escapeHtml(item.i18nFile)}` : ''}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="footer">
          <div>
            扫描模式: ${scanPatterns.length > 0 ? escapeHtml(scanPatterns.join(', ')) : '默认模式'}
          </div>
          <div>
            国际化文件: ${localesPaths.length > 0 ? escapeHtml(localesPaths.join(', ')) : '未设置'}
          </div>
        </div>
        
        <!-- 配置面板（位于底部） -->
        <div class="${configSectionClass}" id="config-section-header">
          <h3>🔧 配置设置（点击展开）</h3>
        </div>
        <div class="collapsible-section-content" id="config-section-content" style="${configContentStyle}">
          <!-- 扫描模式配置 -->
          <div class="config-row">
            <h4>扫描属性配置</h4>
            <ul class="pattern-list">
              ${scanPatterns.map(pattern => `
                <li class="pattern-item">
                  <span>${escapeHtml(pattern)}</span>
                  <button class="remove-pattern" data-pattern="${escapeHtml(pattern)}">删除</button>
                </li>
              `).join('')}
            </ul>
            <div class="new-pattern-input">
              <input type="text" id="new-pattern" placeholder="输入新的扫描属性">
              <button id="add-pattern">添加</button>
            </div>
          </div>
          
          <!-- 国际化文件配置 -->
          <div class="config-row">
            <h4>国际化文件配置</h4>
            <ul class="locale-paths-list">
              ${localesPaths.map(path => `
                <li class="locale-path-item">
                  <span>${escapeHtml(path)}</span>
                  <button class="remove-locale-path" data-path="${escapeHtml(path)}">删除</button>
                </li>
              `).join('')}
            </ul>
            <button id="select-locale-file">选择文件</button>
          </div>
        </div>
      </div>
      
      <script>
        (function() {
          const vscode = acquireVsCodeApi();
          
          // 折叠面板功能
          const configHeader = document.getElementById('config-section-header');
          if (configHeader) {
            configHeader.addEventListener('click', function(event) {
              this.classList.toggle('active');
              const content = document.getElementById('config-section-content');
              const isExpanded = content.style.display === 'block';
              
              if (isExpanded) {
                content.style.display = 'none';
              } else {
                content.style.display = 'block';
              }
              
              // 通知扩展面板状态变化
              vscode.postMessage({
                command: 'toggleConfigSection',
                data: {
                  expanded: !isExpanded
                }
              });
            });
          }
          
          // 全选复选框
          const selectAllCheckbox = document.getElementById('select-all');
          selectAllCheckbox.addEventListener('change', function() {
            const isChecked = this.checked;
            document.querySelectorAll('.item-checkbox').forEach(checkbox => {
              checkbox.checked = isChecked;
              
              // 向VSCode发送消息
              const index = parseInt(checkbox.getAttribute('data-index'));
              vscode.postMessage({
                command: 'toggleSelection',
                data: {
                  index,
                  selected: isChecked
                }
              });
            });
          });
          
          // 单项复选框
          document.querySelectorAll('.item-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', function() {
              const index = parseInt(this.getAttribute('data-index'));
              console.log('选中状态改变:', index, this.checked);
              vscode.postMessage({
                command: 'toggleSelection',
                data: {
                  index,
                  selected: this.checked
                }
              });
            });
          });
          
          // 国际化键输入框
          document.querySelectorAll('.i18n-key-input').forEach(input => {
            input.addEventListener('change', function() {
              const index = parseInt(this.getAttribute('data-index'));
              vscode.postMessage({
                command: 'updateKey',
                data: {
                  index,
                  key: this.value
                }
              });
            });
          });
          
          // 替换选中按钮
          document.getElementById('replace-selected').addEventListener('click', function() {
            vscode.postMessage({
              command: 'replaceSelected'
            });
          });
          
          // 替换所有按钮
          document.getElementById('replace-all').addEventListener('click', function() {
            vscode.postMessage({
              command: 'replaceAll'
            });
          });
          
          // 刷新按钮
          document.getElementById('refresh-panel').addEventListener('click', function() {
            vscode.postMessage({
              command: 'refreshPanel'
            });
          });
          
          // 创建语言文件按钮
          document.getElementById('create-language-files').addEventListener('click', function() {
            vscode.postMessage({
              command: 'createLanguageFiles'
            });
          });
          
          // 添加扫描模式
          const addPatternBtn = document.getElementById('add-pattern');
          if (addPatternBtn) {
            addPatternBtn.addEventListener('click', function(event) {
              // 阻止事件冒泡
              event.stopPropagation();
              
              const input = document.getElementById('new-pattern');
              const pattern = input.value.trim();
              
              if (pattern) {
                vscode.postMessage({
                  command: 'addScanPattern',
                  data: { pattern }
                });
                
                input.value = '';
              }
            });
          }
          
          // 删除扫描模式
          document.querySelectorAll('.remove-pattern').forEach(btn => {
            btn.addEventListener('click', function(event) {
              // 阻止事件冒泡
              event.stopPropagation();
              
              const pattern = this.getAttribute('data-pattern');
              vscode.postMessage({
                command: 'removeScanPattern',
                data: { pattern }
              });
            });
          });
          
          // 选择国际化文件
          const selectFileBtn = document.getElementById('select-locale-file');
          if (selectFileBtn) {
            selectFileBtn.addEventListener('click', function(event) {
              // 阻止事件冒泡
              event.stopPropagation();
              
              vscode.postMessage({
                command: 'selectLocaleFile'
              });
            });
          }
          
          // 移除国际化文件路径
          document.querySelectorAll('.remove-locale-path').forEach(btn => {
            btn.addEventListener('click', function(event) {
              // 阻止事件冒泡
              event.stopPropagation();
              
              const path = this.getAttribute('data-path');
              vscode.postMessage({
                command: 'removeLocalePath',
                data: { path }
              });
            });
          });
          
          // 翻译按钮
          document.querySelectorAll('.translate-btn').forEach(btn => {
            btn.addEventListener('click', function() {
              const index = parseInt(this.getAttribute('data-index'));
              const inputElement = document.querySelector('.i18n-key-input[data-index="' + index + '"]');
              const key = inputElement ? inputElement.value : '';
              
              vscode.postMessage({
                command: 'translateItem',
                data: {
                  index,
                  key
                }
              });
            });
          });
          
          // API翻译配置按钮
          const apiConfigBtn = document.getElementById('open-api-translation');
          if (apiConfigBtn) {
            apiConfigBtn.addEventListener('click', function() {
              vscode.postMessage({
                command: 'openApiTranslation'
              });
            });
          }
          
          // 接收来自扩展的消息
          window.addEventListener('message', event => {
            const message = event.data;
            
            if (message.command === 'updateSelection') {
              const { selectedIndexes } = message.data;
              
              // 更新全选复选框状态
              const allItems = document.querySelectorAll('.item-checkbox');
              const selectAll = selectedIndexes.length === allItems.length;
              
              if (selectAllCheckbox) {
                selectAllCheckbox.checked = selectAll;
              }
              
              // 更新所有项的选中状态
              document.querySelectorAll('.item-checkbox').forEach(checkbox => {
                const index = parseInt(checkbox.getAttribute('data-index'));
                checkbox.checked = selectedIndexes.includes(index);
              });
            }
          });
        })();
      </script>
    </body>
    </html>
  `;
}

module.exports = {
  getPanelHtml,
  escapeHtml
}; 