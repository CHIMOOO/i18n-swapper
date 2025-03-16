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

// 导入LANGUAGE_NAMES
const { LANGUAGE_NAMES } = require('../../utils/language-mappings');
const defaultsConfig = require('../../config/defaultsConfig');  // 引入默认配置，更改为明确的名称

/**
 * 生成面板HTML内容
 * @param {Array} scanPatterns 扫描模式列表
 * @param {Array} replacements 替换项列表
 * @param {Array} localesPaths 本地化文件路径列表
 * @param {Object} context 上下文对象，包含decorationStyle等配置
 * @param {boolean} isConfigExpanded 配置部分是否展开
 * @param {Array} languageMappings 语言映射配置
 */
function getPanelHtml(scanPatterns, replacements, localesPaths, context = {}, isConfigExpanded = false, languageMappings = []) {
  // 使用默认值
  const decorationStyle = context.decorationStyle || defaultsConfig.decorationStyle;
  const suffixStyle = context.suffixStyle || defaultsConfig.suffixStyle;
  const inlineStyle = context.inlineStyle || defaultsConfig.inlineStyle;
  
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
        
        /* 语言映射状态样式 */
        .i18n-status-row {
          background-color: var(--vscode-editor-inactiveSelectionBackground);
          font-size: 0.85em;
        }
        .i18n-status-row td {
          padding: 3px 8px;
          border-bottom: 1px solid var(--vscode-panel-border);
        }
        .i18n-status-container {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .i18n-status-tag {
          display: inline-flex;
          align-items: center;
          padding: 2px 6px;
          border-radius: 3px;
          cursor: pointer;
          position: relative;
          transition: opacity 0.2s;
        }
        
        .i18n-status-exists {
          background-color: var(--vscode-gitDecoration-addedResourceForeground);
          color: white;
          font-size: 12px;
          padding: 2px 10px;
        }
        .i18n-status-missing {
          background-color: #f66e70;
          color: white;
          font-size: 12px;
          padding: 2px 10px;
        }
        .i18n-status-error {
          background-color: var(--vscode-gitDecoration-deletedResourceForeground);
          color: var(--vscode-editor-background);
        }
        .i18n-status-tooltip {
          position: relative;
        }
        .i18n-status-tooltip .tooltip-text {
          visibility: hidden;
          position: absolute;
          z-index: 100;
          bottom: 125%;
          left: 50%;
          transform: translateX(-50%);
          min-width: 200px;
          max-width: 300px;
          background-color: var(--vscode-editorHoverWidget-background);
          color: var(--vscode-editorHoverWidget-foreground);
          text-align: left;
          padding: 6px 10px;
          border-radius: 4px;
          border: 1px solid var(--vscode-editorHoverWidget-border);
          box-shadow: 0px -8px 10px 6px rgb(0 0 0 / 50%);
          white-space: pre-wrap;
          word-break: break-all;
          overflow: hidden;
          opacity: 1;
          pointer-events: none; /* 修改为允许鼠标事件 */
          transition: visibility 0.2s, opacity 0.2s;
        }
        /* 修复提示框定位问题 */
        .i18n-status-tag:first-child .tooltip-text {
          left: 0;
          transform: translateX(0);
        }
        .i18n-status-tag:last-child .tooltip-text {
          left: auto;
          right: 0;
          transform: translateX(0);
        }
        .i18n-status-tooltip:hover .tooltip-text {
          visibility: visible;
          opacity: 1;
          pointer-events: auto; /* 允许鼠标事件 */
        }
        
        /* 原有样式继续保留 */
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
        .style-config-container {
          background: var(--vscode-editor-background);
          border: 1px solid var(--vscode-panel-border);
          border-radius: 4px;
          padding: 10px;
          margin-top: 10px;
        }
        .style-config-group {
          margin-bottom: 15px;
        }
        .color-picker {
          width: 40px;
          height: 24px;
          vertical-align: middle;
          margin-right: 5px;
        }
        .color-text {
          width: 80px;
          vertical-align: middle;
        }
        .number-input {
          width: 40px;
        }
        .unit {
          margin-left: 5px;
        }
          #suffix-style-config,#inline-style-config{
            display: flex;
            align-items: center;
            flex-wrap: wrap;
          }
             #suffix-style-config .config-item,#inline-style-config .config-item{
             margin-right:35px;
              margin-bottom:8px;
             }
           #suffix-style-config   .help-text,#inline-style-config .help-text    {
           width:80px;
           }
        #inline-edit-options {
          margin-top: 10px;
          margin-bottom: 15px;
          padding: 10px 0;
          border-radius: 4px;
        }
        #inline-edit-options .config-item {
          display: flex;
          align-items: center;
        }
        #inline-edit-options label {
          margin-left: 8px;
          margin-right: 10px;
        }
        #inline-edit-options .help-text {
          font-size: 12px;
          color: #666;
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
              ${replacements.map((item, index) => {
                // 生成每一项的表格行，包括数据行和状态行
                const dataRow = `
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
                        value="${escapeHtml(item.i18nKey || '')}" placeholder="输入国际化键，用于翻译后自动插入">
                      <button class="translate-btn" data-index="${index}" title="翻译并保存到所有语言文件">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>
                        翻译
                      </button>
                    </td>
                    <td>${escapeHtml(item.source || '文本')}</td>
                    <td>${item.i18nFile ? `来自: ${escapeHtml(item.i18nFile)}` : ''}</td>
                  </tr>`;
                
                // 只有当项有i18nKey且languageMappings存在时才添加状态行
                let statusRow = '';
                if (item.i18nKey && languageMappings && languageMappings.length > 0) {
                  statusRow = `
                    <tr class="i18n-status-row" data-index="${index}">
                      <td colspan="6">
                        <div class="i18n-status-container">
                          ${languageMappings.map(mapping => {
                            // 获取此语言的状态
                            const status = item.i18nStatus && item.i18nStatus[mapping.languageCode];
                            const exists = status && status.exists;
                            const error = status && status.error;
                            const value = status && status.value;
                            
                            // 根据状态设置不同的样式和提示
                            let statusClass = exists ? 'i18n-status-exists' : 'i18n-status-missing';
                            let tooltip = '';
                            
                            // 获取语言名称，格式为"语言名称[语言代码]"
                            const langName = LANGUAGE_NAMES[mapping.languageCode] || '';
                            let displayText = langName ? `${langName}[${mapping.languageCode}]` : mapping.languageCode;
                            
                            if (error) {
                              statusClass = 'i18n-status-error';
                              tooltip = '错误: ' + error;
                            } else if (exists && value) {
                              tooltip = value;
                            } else {
                              tooltip = '未找到翻译';
                            }
                            
                            return `
                              <div class="i18n-status-tag ${statusClass} i18n-status-tooltip" 
                                   data-language="${mapping.languageCode}" 
                                   data-filepath="${escapeHtml(mapping.filePath)}"
                                   data-key="${escapeHtml(item.i18nKey)}">
                                ${displayText}
                                <span class="tooltip-text">${escapeHtml(tooltip)}</span>
                              </div>
                            `;
                          }).join('')}
                        </div>
                      </td>
                    </tr>
                  `;
                }
                
                return dataRow + statusRow;
              }).join('')}
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
          <h3>🔧 扫描配置设置（点击展开/关闭）</h3>
        </div>
        <div class="collapsible-section-content" id="config-section-content" style="${configContentStyle}">
          <!-- 扫描模式配置 -->
          <div class="config-row">
            <h4>1、扫描属性配置</h4>
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
            <h4>2、配置源文件的国际化字库列表（将根据文件内已有的值进行扫描）</h4>
            <ul class="locale-paths-list">
              ${localesPaths.map(path => `
                <li class="locale-path-item">
                  <span>${escapeHtml(path)}</span>
                  <button class="remove-locale-path" data-path="${escapeHtml(path)}">删除</button>
                </li>
              `).join('')}
            </ul>
            <button id="select-locale-file">添加文件</button>
          </div>
          
          <!-- 添加装饰风格选择区域 -->
          <div class="config-row">
            <h4>装饰显示风格</h4>
            <div class="config-item">
              <select id="decoration-style" class="form-control">
                <option value="suffix" ${decorationStyle === 'suffix' ? 'selected' : ''}>t('key')(译文)</option>
                <option value="inline" ${decorationStyle === 'inline' ? 'selected' : ''}>t(译文)</option>
              </select>
              <span class="help-text">选择i18n函数调用的显示风格</span>
            </div>
          </div>
          
          <div id="inline-edit-options" class="config-row" style="${decorationStyle === 'inline' ? '' : 'display: none;'}">

            <div class="config-item">
              <input type="checkbox" id="show-preview-in-edit" ${context.showFullFormInEditMode ? 'checked' : ''}>
              <label for="show-preview-in-edit">编辑时显示译文预览</label>
            </div>
          </div>
          
          <!-- 添加样式配置部分 -->
          <div class="config-row">
            <h4>装饰样式配置</h4>
            <div class="style-config-container">
              <!-- 后缀模式样式配置 -->
              <div id="suffix-style-config" class="style-config-group" ${decorationStyle === 'suffix' ? '' : 'style="display: none;"'}>
                <div class="config-item">
                  <label>文本颜色：</label>
                  <input type="color" id="suffix-color" value="${suffixStyle.color || '#6A9955'}" class="color-picker">
                  <input type="text" id="suffix-color-text" value="${suffixStyle.color || '#6A9955'}" class="color-text">
                </div>
                <div class="config-item">
                  <label>字体大小(px)：</label>
                  <input type="number" id="suffix-font-size" value="${parseInt(suffixStyle.fontSize) || 14}" min="8" max="32" class="number-input">
                  <span class="unit">px</span>
                </div>
                <div class="config-item">
                  <label>字体粗细：</label>
                  <input type="number" id="suffix-font-weight" value="${suffixStyle.fontWeight || 400}" min="100" max="900" step="100" class="number-input">
                </div>
                <div class="config-item">
                  <label>字体样式：</label>
                  <select id="suffix-font-style" class="form-control">
                    <option value="normal" ${suffixStyle.fontStyle === 'normal' ? 'selected' : ''}>正常</option>
                    <option value="italic" ${suffixStyle.fontStyle === 'italic' ? 'selected' : ''}>斜体</option>
                    <option value="oblique" ${suffixStyle.fontStyle === 'oblique' ? 'selected' : ''}>倾斜</option>
                  </select>
                </div>
                <div class="config-item">
                  <label>文字间距：</label>
                  <input type="text" id="suffix-margin" value="${suffixStyle.margin || '0 0 0 3px'}" class="margin-input" placeholder="上 右 下 左 (例如: 0 0 0 3px)">
                  <span class="help-text small">格式: 上 右 下 左 (例如: 0 0 0 3px)</span>
                </div>
              </div>
              
              <!-- 内联模式样式配置 -->
              <div id="inline-style-config" class="style-config-group" ${decorationStyle === 'inline' ? '' : 'style="display: none;"'}>
                <div class="config-item">
                  <label>文本颜色：</label>
                  <input type="color" id="inline-color" value="${inlineStyle.color || '#CE9178'}" class="color-picker">
                  <input type="text" id="inline-color-text" value="${inlineStyle.color || '#CE9178'}" class="color-text">
                </div>
                <div class="config-item">
                  <label>字体大小(px)：</label>
                  <input type="number" id="inline-font-size" value="${parseInt(inlineStyle.fontSize) || 14}" min="8" max="32" class="number-input">
                  <span class="unit">px</span>
                </div>
                <div class="config-item">
                  <label>字体粗细：</label>
                  <input type="number" id="inline-font-weight" value="${inlineStyle.fontWeight || 400}" min="100" max="900" step="100" class="number-input">
                </div>
                <div class="config-item">
                  <label>字体样式：</label>
                  <select id="inline-font-style" class="form-control">
                    <option value="normal" ${inlineStyle.fontStyle === 'normal' ? 'selected' : ''}>正常</option>
                    <option value="italic" ${inlineStyle.fontStyle === 'italic' ? 'selected' : ''}>斜体</option>
                    <option value="oblique" ${inlineStyle.fontStyle === 'oblique' ? 'selected' : ''}>倾斜</option>
                  </select>
                </div>
                <div class="config-item">
                  <label>文字间距：</label>
                  <input type="text" id="inline-margin" value="${inlineStyle.margin || '0'}" class="margin-input" placeholder="上 右 下 左">
                </div>
              </div>
              <button id="apply-style-changes" class="primary-button">应用样式更改</button>
            </div>
          </div>
        </div>
      </div>
      
      <script>
        // 使用acquireVsCodeApi获取vscode实例
        const vscode = acquireVsCodeApi();
        
        // 存储语言映射数据
        window.languageMappings = ${JSON.stringify(languageMappings)};
        
        // 语言名称映射
        window.LANGUAGE_NAMES = ${JSON.stringify(LANGUAGE_NAMES)};
        
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
            
            // 发送配置面板展开状态给扩展
            vscode.postMessage({
              command: 'toggleConfigSection',
              data: { expanded: !isExpanded }
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
        
        // 国际化键输入框 - 修改为实时检查
        document.querySelectorAll('.i18n-key-input').forEach(input => {
          // 之前的change事件保留，用于更新键值
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
          
          // 添加input事件，用于实时检查键状态
          input.addEventListener('input', debounce(function() {
            const index = parseInt(this.getAttribute('data-index'));
            const key = this.value.trim();
            
            if (key) {
              vscode.postMessage({
                command: 'checkI18nKeyStatus',
                data: {
                  index,
                  key
                }
              });
            }
          }, 500)); // 500ms防抖，避免频繁请求
        });
        
        // 简单的防抖函数
        function debounce(func, wait) {
          let timeout;
          return function() {
            const context = this;
            const args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), wait);
          };
        }
        
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
        
        // 装饰风格切换时显示/隐藏内联模式编辑选项
        document.getElementById('decoration-style').addEventListener('change', function() {
          const style = this.value;
          if (style === 'suffix') {
            document.getElementById('suffix-style-config').style.display = 'flex';
            document.getElementById('inline-style-config').style.display = 'none';
            document.getElementById('inline-edit-options').style.display = 'none'; // 隐藏内联编辑选项
          } else {
            document.getElementById('suffix-style-config').style.display = 'none';
            document.getElementById('inline-style-config').style.display = 'flex';
            document.getElementById('inline-edit-options').style.display = 'block'; // 显示内联编辑选项
          }
          
          // 发送风格切换消息
          vscode.postMessage({
            command: 'updateDecorationStyle',
            data: { style: style }
          });
        });
        
        // 同步颜色选择器和文本输入
        document.getElementById('suffix-color').addEventListener('input', function() {
          document.getElementById('suffix-color-text').value = this.value;
        });
        
        document.getElementById('suffix-color-text').addEventListener('input', function() {
          document.getElementById('suffix-color').value = this.value;
        });
        
        document.getElementById('inline-color').addEventListener('input', function() {
          document.getElementById('inline-color-text').value = this.value;
        });
        
        document.getElementById('inline-color-text').addEventListener('input', function() {
          document.getElementById('inline-color-text').value = this.value;
        });
        
        // 应用样式更改按钮点击事件
        document.getElementById('apply-style-changes').addEventListener('click', function() {
          const decorationStyle = document.getElementById('decoration-style').value;
          
          // 收集样式配置 - 更新为使用数值
          const suffixStyle = {
            color: document.getElementById('suffix-color-text').value,
            fontSize: document.getElementById('suffix-font-size').value + 'px', // 添加px单位
            fontWeight: document.getElementById('suffix-font-weight').value, // 直接使用数值
            fontStyle: document.getElementById('suffix-font-style').value,
            margin: document.getElementById('suffix-margin').value
          };
          
          const inlineStyle = {
            color: document.getElementById('inline-color-text').value,
            fontSize: document.getElementById('inline-font-size').value + 'px', // 添加px单位
            fontWeight: document.getElementById('inline-font-weight').value, // 直接使用数值
            fontStyle: document.getElementById('inline-font-style').value,
            margin: document.getElementById('inline-margin').value
          };
          
          // 发送更新样式的消息
          vscode.postMessage({
            command: 'updateDecorationStyles',
            data: {
              decorationStyle,
              suffixStyle,
              inlineStyle
            }
          });
        });
        
        // 添加显示译文预览选项的变更处理（自动保存）
        document.getElementById('show-preview-in-edit').addEventListener('change', function() {
          vscode.postMessage({
            command: 'updateShowPreviewInEdit',
            data: { showPreview: this.checked }
          });
        });
        
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
          } else if (message.command === 'updateI18nKeyStatus') {
            // 更新国际化键的状态
            updateI18nKeyStatusInUI(message.data);
          }
        });
        
        // 在UI中更新国际化键状态
        function updateI18nKeyStatusInUI(data) {
          const { index, status, key } = data;
          
          // 查找对应的状态行 - 使用字符串连接而不是嵌套模板字符串
          const statusRow = document.querySelector('.i18n-status-row[data-index="' + index + '"]');
          if (!statusRow) return;
          
          const container = statusRow.querySelector('.i18n-status-container');
          if (!container) return;
          
          // 清空现有状态
          container.innerHTML = '';
          
          // 获取语言映射配置
          const languageMappings = window.languageMappings || [];
          
          // 遍历所有语言，添加状态标签
          for (const [langCode, langStatus] of Object.entries(status)) {
            const exists = langStatus.exists;
            const error = langStatus.error;
            const value = langStatus.value;
            
            // 查找对应的语言映射，以获取文件路径
            const mapping = languageMappings.find(m => m.languageCode === langCode);
            const filePath = mapping ? mapping.filePath : '';
            
            let statusClass = exists ? 'i18n-status-exists' : 'i18n-status-missing';
            let tooltip = '';
            
            // 获取语言名称
            const langName = LANGUAGE_NAMES[langCode] || '';
            let displayText = langName ? langName + '[' + langCode + ']' : langCode;
            
            if (error) {
              statusClass = 'i18n-status-error';
              tooltip = '错误: ' + error;
            } else if (exists && value) {
              tooltip = value;
            } else {
              tooltip = '未找到翻译';
            }
            
            const tagElement = document.createElement('div');
            tagElement.className = 'i18n-status-tag ' + statusClass + ' i18n-status-tooltip';
            tagElement.textContent = displayText;
            
            // 添加数据属性用于点击事件
            tagElement.setAttribute('data-language', langCode);
            tagElement.setAttribute('data-filepath', filePath);
            tagElement.setAttribute('data-key', key);
            
            const tooltipElement = document.createElement('span');
            tooltipElement.className = 'tooltip-text';
            tooltipElement.textContent = tooltip;
            
            tagElement.appendChild(tooltipElement);
            container.appendChild(tagElement);
          }
        }

        // 在初始化脚本中添加
        document.addEventListener('click', function(event) {
          // 查找点击的是否是语言标签
          let target = event.target;
          while (target && !target.matches('.i18n-status-tag')) {
            if (target === document.body) return;
            target = target.parentElement;
          }
          
          if (target) {
            const languageCode = target.getAttribute('data-language');
            const filePath = target.getAttribute('data-filepath');
            const key = target.getAttribute('data-key');
            
            if (filePath && key) {
              vscode.postMessage({
                command: 'openLanguageFile',
                data: {
                  filePath,
                  languageCode,
                  key
                }
              });
            }
          }
        });
      </script>
    </body>
    </html>
  `;
}

module.exports = {
  getPanelHtml,
  escapeHtml
}; 