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
 * @param {Array} existingI18nCalls 已存在的国际化调用
 */
function getPanelHtml(scanPatterns, replacements, localesPaths, context = {}, isConfigExpanded = false, languageMappings = [], existingI18nCalls = []) {
  // 从上下文中获取扫描模式
  const scanMode = context.scanMode || 'pending';
  
  // 根据模式确定要显示的数据
  let displayItems = [];
  if (scanMode === 'pending') {
    displayItems = replacements;
  } else if (scanMode === 'translated') {
    displayItems = existingI18nCalls;
  } else if (scanMode === 'all') {
    // 合并两个数组，添加类型标记
    displayItems = [
      ...replacements.map(item => ({ ...item, itemType: 'pending' })),
      ...existingI18nCalls.map(item => ({ ...item, itemType: 'translated' }))
    ];
  }
  
  // 获取样式配置
  const decorationStyle = context.decorationStyle || 'suffix';
  const suffixStyle = context.suffixStyle || {};
  const inlineStyle = context.inlineStyle || {};
  
  // 配置部分的CSS类
  const configSectionClass = isConfigExpanded ? 'config-section expanded' : 'config-section';
  
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
          padding: 5px 0;
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
          width: 120px;
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
          margin-top: 0;
          padding: 6px 10px;
          border: 1px solid var(--vscode-panel-border);
          background: #6366f1;
          color: white;
          border-radius: 8px;
          cursor: pointer;
        }
        .config-section h3 {
          margin-top: 0;
          margin-bottom: 0;
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
          margin-top: 0;
          margin-bottom: 0;
          padding: 0 0 10px 0;
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
        
        /* 模式切换按钮样式 */
        .mode-switcher {
          display: flex;
          border-bottom: 1px solid #ccc;
        }
        
        .mode-button {
          padding: 6px 12px;
          margin-right: 10px;
          border-radius: 4px 4px 0 0;
          background: var(--vscode-button-secondaryBackground);
          color: var(--vscode-button-secondaryForeground);
          cursor: pointer;
        }
        
        .mode-button.active {
          background: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          font-weight: bold;
        }
        
        /* 项目类型标记 */
        .item-type-tag {
          display: inline-block;
          border-radius: 3px;
          font-size: 12px;
          margin-right: 5px;
        }
        
        .item-type-pending {
          color: #1890ff;
        }
        
        .item-type-translated {
          color: #fff;
        }

        /* 已转义项的操作按钮样式 */
        .i18n-key-actions {
          display: flex;
          margin-top: 4px;
        }

        .i18n-key-actions button {
          background: transparent;
          border: 1px solid #ccc;
          border-radius: 3px;
          padding: 2px 4px;
          margin-right: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .i18n-key-actions button:hover {
          background: var(--vscode-button-secondaryHoverBackground);
        }

        .i18n-key {
          display: block;
          font-family: var(--vscode-editor-font-family);
          color: var(--vscode-textLink-foreground);
          word-break: break-all;
        }

        .translation-preview {
          color: #e5b95c;
          margin-left: 4px;
        }

        /* 添加文本来源和文件路径的样式 */
        /* 文本来源和文件路径样式 */
        .text-source {
          font-size: 0.85em;
          color: var(--vscode-descriptionForeground);
          margin-top: 4px;
        }

        .file-path {
          font-size: 0.85em;
          color: var(--vscode-descriptionForeground);
          margin-top: 4px;
          word-break: break-all;
        }

       

        /* 改进文本单元格样式 */
        .text-cell {
          word-break: break-all;
          max-width: 300px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        
        
        <!-- 模式切换按钮 -->
        <div class="mode-switcher">
          <button class="mode-button ${scanMode === 'pending' ? 'active' : ''}" data-mode="pending">
            待转义 (${replacements.length})
          </button>
          <button class="mode-button ${scanMode === 'translated' ? 'active' : ''}" data-mode="translated">
            已转义 (${existingI18nCalls.length})
          </button>
          <button class="mode-button ${scanMode === 'all' ? 'active' : ''}" data-mode="all">
            全部 (${replacements.length + existingI18nCalls.length})
          </button>
        </div>
        
    <div class="toolbar">
          <div class="tools-group">
            <button id="replace-selected" class="action-button replace-btn">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3Z"/></svg>
              替换选中项
            </button>
            <button id="replace-all" class="action-button replace-all-btn">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5H2v7"/><path d="m6 9 11 11"/><path d="m15 5 5 5"/><path d="M22 2 2 22"/></svg>
              替换所有项
            </button>
            <button id="refresh-panel">刷新</button>
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
                ${scanMode === 'all' ? '<th>类型</th>' : (scanMode === 'pending'?'<th>文本</th>':'')}
                ${scanMode === 'translated' ? '<th>源语言值</th>' :(scanMode === 'all' ? '<th>文本</th>':'')}
                <th>国际化键</th>
                <th>来源</th>
              </tr>
            </thead>
            <tbody>
              ${displayItems.length > 0 ? displayItems.map((item, index) => {
                // 生成每一项的表格行，包括数据行和状态行
                const dataRow = `
                  <tr>
                    <td class="checkbox-cell">
                      <input type="checkbox" class="item-checkbox" data-index="${index}" ${item.selected ? 'checked' : ''}>
                    </td>
                    <td>${index + 1}</td>
                    ${scanMode === 'all' ? `
                      <td>
                        <span class="item-type-tag item-type-${item.itemType || 'pending'}">
                          ${item.itemType === 'translated' ? '已转义' : '待转义'}
                        </span>
                      </td>
                    ` : ''}
                    <td class="text-cell ${item.i18nKey ? 'has-key' : ''}" title="${escapeHtml(item.text)}">
                      
                      ${item.translationValue ? `<span class="translation-preview">${escapeHtml(item.translationValue)}</span>` : `${escapeHtml(item.text)}`}
                    </td>
                    <td>
                      ${ `<input type="text" class="i18n-key-input" data-index="${index}" 
                          value="${escapeHtml(item.i18nKey || '')}" placeholder="输入国际化键，用于翻译后自动插入">
                        <button class="translate-btn" data-index="${index}" title="翻译并保存到所有语言文件">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>
                          翻译
                        </button>`
                      }
                    </td>
                    <td>${escapeHtml(item.source || '文本')}</td>
                  </tr>`;
                
                // 只有当项有i18nKey且languageMappings存在时才添加状态行
                let statusRow = '';
                if (item.i18nKey && languageMappings && languageMappings.length > 0) {
                  statusRow = `
                    <tr class="i18n-status-row" data-index="${index}">
                      <td colspan="${scanMode === 'all' ? '6' : '5'}">
                      
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
              }).join('') : `
                <tr>
                  <td colspan="${scanMode === 'all' ? '6' : '5'}" class="no-data">
                    ${scanMode === 'pending' ? '未找到需要国际化的文本' : 
                      scanMode === 'translated' ? '未找到已国际化的文本' : 
                      '未找到任何文本'}
                  </td>
                </tr>
              `}
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
        <div class="${configSectionClass}" id="config-section-header" style="display: flex;position: sticky;top: 0;">
          <h3>🔧 配置设置</h3>
          <span style="margin-left:auto;font-weight: 700;">（点击展开/关闭）</span>
        </div>
        <div class="collapsible-section-content" id="config-section-content" style="${isConfigExpanded ? 'display: block;' : 'display: none;'}">
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
            <h4>3、装饰显示风格</h4>
          </div>
          
        
          
          <!-- 添加样式配置部分 -->
          <div class="config-row">
            <div class="style-config-container">
              <div class="config-item" style="margin-bottom: 10px;">
                <select id="decoration-style" class="form-control">
                  <option value="suffix" ${decorationStyle === 'suffix' ? 'selected' : ''}>t('key')(译文)</option>
                  <option value="inline" ${decorationStyle === 'inline' ? 'selected' : ''}>t(译文)</option>
                </select>
                <span class="help-text">选择i18n函数调用的显示风格</span>
              </div>
              <div id="inline-edit-options" class="config-row" style="${decorationStyle === 'inline' ? '' : 'display: none;'}">
                <div class="config-item">
                  <input type="checkbox" id="show-preview-in-edit" ${context.showFullFormInEditMode ? 'checked' : ''}>
                  <label for="show-preview-in-edit">编辑时显示译文预览</label>
                </div>
              </div>
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
        
        // 替换选中按钮点击事件
        document.getElementById('replace-selected').addEventListener('click', () => {
          vscode.postMessage({
            command: 'replaceSelected'
          });
        });
        
        // 替换所有按钮点击事件
        document.getElementById('replace-all').addEventListener('click', () => {
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

        // 模式切换按钮
        document.querySelectorAll('.mode-button').forEach(button => {
          button.addEventListener('click', () => {
            const mode = button.getAttribute('data-mode');
            if (mode) {
              vscode.postMessage({
                command: 'switchScanMode',
                data: { mode: mode }
              });
            }
          });
        });

       

        // 使用事件委托
        document.addEventListener('click', (event) => {
          // 刷新扫描按钮
          if (event.target.id === 'refresh-scan' || event.target.closest('#refresh-scan')) {
            vscode.postMessage({
              command: 'refreshScan',
              data: {}
            });
          }
          
          // 全选/取消全选按钮
          if (event.target.id === 'select-all' || event.target.closest('#select-all')) {
            vscode.postMessage({
              command: 'toggleSelectAll',
              data: {}
            });
          }
          
          // 翻译选中项按钮
          if (event.target.id === 'translate-selected' || event.target.closest('#translate-selected')) {
            vscode.postMessage({
              command: 'translateSelected',
              data: {}
            });
          }
        });

        // 在脚本的最后添加一个函数来绑定所有事件
        function bindAllEvents() {
          // 模式切换按钮
          document.querySelectorAll('.mode-button').forEach(button => {
            button.addEventListener('click', () => {
              const mode = button.getAttribute('data-mode');
              if (mode) {
                vscode.postMessage({
                  command: 'switchScanMode',
                  data: { mode: mode }
                });
              }
            });
          });

          // 刷新扫描按钮
          const refreshScanBtn = document.getElementById('refresh-scan');
          if (refreshScanBtn) {
            refreshScanBtn.addEventListener('click', () => {
              vscode.postMessage({
                command: 'refreshScan',
                data: {}
              });
            });
          }

          // 全选/取消全选按钮
          const selectAllBtn = document.getElementById('select-all');
          if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => {
              vscode.postMessage({
                command: 'toggleSelectAll',
                data: {}
              });
            });
          }
        }

        // 调用绑定函数
        bindAllEvents();

        // 如果有消息处理，可以在收到消息后重新绑定
        window.addEventListener('message', (event) => {
          const message = event.data;
          if (message.command === 'updateContent') {
            // 等待 DOM 更新
            setTimeout(bindAllEvents, 0);
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