/**
 * 转义HTML特殊字符，防止XSS攻击
 * @param {string} text 需要转义的文本
 * @returns {string} 转义后的文本
 */
const vscode = require('vscode');

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
const {
  LANGUAGE_NAMES
} = require('../../utils/language-mappings');
const defaultsConfig = require('../../config/defaultsConfig'); // 引入默认配置，更改为明确的名称

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
function getPanelHtml(scanPatterns, replacements, localesPaths, context = {}, isConfigExpanded = false, languageMappings = [], existingI18nCalls = [], scanAllFiles = false) {
  // 获取配置
  const config = vscode.workspace.getConfiguration('i18n-swapper');
  const decorationStyle = context.decorationStyle || config.get('decorationStyle', 'suffix');
  const showFullFormInEditMode = context.showFullFormInEditMode !== undefined ?
    context.showFullFormInEditMode : config.get('showFullFormInEditMode', true);
  const suffixStyle = context.suffixStyle || config.get('suffixStyle', {});
  const inlineStyle = context.inlineStyle || config.get('inlineStyle', {});

  // 添加新的翻译功能设置项
  const autoGenerateKeyFromText = context.autoGenerateKeyFromText !== undefined ?
    context.autoGenerateKeyFromText : config.get('autoGenerateKeyFromText', true);
  const autoGenerateKeyPrefix = context.autoGenerateKeyPrefix ||
    config.get('autoGenerateKeyPrefix', '_iw');
  const autoTranslateAllLanguages = context.autoTranslateAllLanguages !== undefined ?
    context.autoTranslateAllLanguages : config.get('autoTranslateAllLanguages', true);

  // 获取输出国际化函数名称
  const outputI18nFunctionName = context.outputI18nFunctionName || config.get('functionName', 't');

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
      ...replacements.map(item => ({
        ...item,
        itemType: 'pending'
      })),
      ...existingI18nCalls.map(item => ({
        ...item,
        itemType: 'translated'
      }))
    ];
  }

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
        .translate-btn, .replace-single-btn {
          margin-left: 5px;
          display: inline-flex;
          align-items: center;
          gap: 3px;
        }
        .translate-btn svg, .replace-single-btn svg {
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
          // left: 50%;
          // transform: translateX(-50%);
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
        /* 修改工具提示的位置规则，只对多个标签时最后一个标签生效 */
        .i18n-status-tag:nth-child(n+4):last-child .tooltip-text {
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
        .pattern-list, .locale-paths-list,#i18n-function-names {
          margin: 5px 0;
          padding: 0;
          list-style: none;
          display: flex;
          flex-wrap: wrap;
        }
         .pattern-list li,.locale-path-item span,#i18n-function-names .function-name-item {
        padding: 0 0 0 8px;
            margin-right: 8px;
        }
           .pattern-list li button,.locale-path-item .remove-locale-path,#i18n-function-names .function-name-item button {
        background:oklch(0.396 0.141 25.723);
            padding: 5px 5px;
        }
            #i18n-function-names .function-name-item{
                border: 1px solid var(--vscode-input-border);
    border-radius: 3px;
            }
         
    .del-svg{
       height: 16px;
    width: 16px;
    fill: #d6d6dd;
    }
          .pattern-list li  span,#i18n-function-names .function-name-item span{
              margin-right: 10px;
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
          #suffix-style-config,#inline-style-config,#missing-key-style-container{
            display: flex;
            align-items: center;
            flex-wrap: wrap;
          }
             #suffix-style-config .config-item,#inline-style-config .config-item,#missing-key-style-container .config-item{
             margin-right:35px;
              margin-bottom:8px;
             }
           #suffix-style-config   .help-text,#inline-style-config .help-text,#missing-key-style-container .help-text{
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

        .text-highlight-trigger {
          cursor: pointer;
          // text-decoration: underline solid #409eff;
          transition: background-color 0.2s;
        }
        
        .text-highlight-trigger:hover {
          background-color: rgba(64, 158, 255, 0.1);
        }

        /* 添加扫描所有文件开关样式 */
        .scan-all-files-toggle {
          display: flex;
          align-items: center;
          margin-left: auto;
          padding-right: 10px;
        }
        
        .scan-mode-info {
          display: flex;
          align-items: center;
          background-color: var(--vscode-editorWidget-background);
          padding: 3px 8px;
          border-radius: 3px;
        }
        
        .scan-all-files-toggle input {
          margin-right: 5px;
        }
        
        .scan-status {
          font-size: 12px;
          color: var(--vscode-descriptionForeground);
          margin-left: 5px;
        }
        
        .help-icon {
          display: inline-block;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background-color: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          text-align: center;
          font-size: 10px;
          line-height: 14px;
          margin-left: 5px;
          cursor: help;
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
          
          <!-- 添加扫描所有文件开关，并增加更明确的描述 -->
          <div class="scan-all-files-toggle">
            <div class="scan-mode-info">
              <input type="checkbox" id="scan-all-files" ${scanAllFiles ? 'checked' : ''}>
              <label for="scan-all-files">扫描所有文件</label>
              <span class="scan-status">${scanAllFiles ? '(工作区)' : '(当前文件)'}</span>
              <span class="help-icon" title="开启后将扫描整个工作区的文件，而不仅仅是当前文件。注意：这可能会较为耗时。">?</span>
            </div>
          </div>
        </div>
        
    <div class="toolbar">
          <div class="tools-group">
            <button id="replace-selected" class="action-button replace-btn">
              替换选中项
            </button>
            <button id="replace-all" class="action-button replace-all-btn">
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
              </tr>
            </thead>
            <tbody>
              ${displayItems.length > 0 ? displayItems.map((item, index) => {
                // 生成每一项的表格行，包括数据行和状态行
                const dataRow = `
                  <tr data-filepath="${item.filePath || ''}" data-index="${index}">
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
                    <td class="text-cell text-highlight-trigger" 
                        data-start="${item.start}" 
                        data-end="${item.end}" 
                        data-index="${index}" 
                        data-filepath="${item.filePath || ''}"
                        title="点击定位到代码位置">${item.translationValue ? `<span class="translation-preview">${escapeHtml(item.translationValue)}</span>` : `${escapeHtml(item.text)}`}</td>
                    <td>
                      ${ `<input type="text" class="i18n-key-input" data-index="${index}" 
                          value="${escapeHtml(item.i18nKey || '')}" placeholder="输入国际化键，用于翻译后自动插入">
                        <button class="translate-btn" data-index="${index}" title="翻译并保存到所有语言文件">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>
                          翻译
                        </button>
                        <button class="replace-single-btn" data-index="${index}" title="替换此项">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h8.5"/><path d="M13 3h8.5"/><path d="M18 7.5V12l2-2"/><path d="M18 7.5V3"/><path d="M16 6a4 4 0 0 0-4 4"/><path d="M11 10a4 4 0 0 0-4 4"/><path d="M14 22.5l-5.5-5.5 5.5-5.5c.59-.58.59-1.52 0-2.1-.58-.59-1.52-.59-2.1 0l-5.5 5.5c-.58.59-.58 1.53 0 2.12l5.5 5.5c.3.28.7.42 1.1.42.38 0 .77-.14 1.06-.42.56-.55.57-1.47-.06-2.04z"/></svg>
                          替换
                        </button>`
                      }
                    </td>
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
                          }).join('')
                          } </div> </td> </tr>
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

          
          <!-- 国际化文件配置 -->
          <div class="config-row">
            <h4>1、配置源文件的国际化字库列表（将根据文件内已有的值进行扫描）</h4>
            <ul class="locale-paths-list">
              ${localesPaths.map(path => `
                <li class="locale-path-item">
                  <span>${escapeHtml(path)}</span>
                  <button class="remove-locale-path" data-path="${escapeHtml(path)}"> <svg class="del-svg" data-slot="icon" fill="currentColor" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path clip-rule="evenodd" fill-rule="evenodd" d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.275 5.5a.75.75 0 0 1-1.498-.075l.275-5.5a.75.75 0 0 1 .786-.711Z"></path>
                  </svg></button>
                </li>
              `).join('')}
            </ul>
            <button id="select-locale-file">添加文件</button>
          </div>

          <!-- 扫描模式配置 -->
          <div class="config-row">
            <h4>2、扫描属性配置</h4>
            <ul class="pattern-list">
              ${scanPatterns.map(pattern => `
                <li class="pattern-item">
                  <span>${escapeHtml(pattern)}</span>
                  <button class="remove-pattern" data-pattern="${escapeHtml(pattern)}">
                      <svg class="del-svg" data-slot="icon" fill="currentColor" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path clip-rule="evenodd" fill-rule="evenodd" d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.275 5.5a.75.75 0 0 1-1.498-.075l.275-5.5a.75.75 0 0 1 .786-.711Z"></path>
                  </svg>
                  </button>
                </li>
              `).join('')}
            </ul>
            <div class="new-pattern-input">
              <input type="text" id="new-pattern" placeholder="输入新的扫描属性">
              <button id="add-pattern">添加</button>
            </div>
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
                  <input type="checkbox" id="show-preview-in-edit" ${showFullFormInEditMode ? 'checked' : ''}>
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
          
          <!-- 将缺失键样式设置移到这里，作为一个单独的配置部分 -->
          <div class="config-row">
            <h4>4、缺失键样式</h4>
          </div>
          <div class="config-row">
            <div id="missing-key-style-container" class="style-config-container">
              <div class="config-item">
                <label>边框宽度：</label>
                <input type="text" id="missing-key-border-width" value="${config.missingKeyBorderWidth || '0 0 2px 0'}" class="margin-input" placeholder="上 右 下 左 (例如: 0 0 2px 0)">
                <span class="help-text small">格式: 上 右 下 左 (例如: 0 0 2px 0)</span>
              </div>
              
              <div class="config-item">
                <label>边框样式：</label>
                <select id="missing-key-border-style">
                  <option value="solid" ${config.missingKeyBorderStyle === 'solid' ? 'selected' : ''}>实线</option>
                  <option value="dashed" ${config.missingKeyBorderStyle === 'dashed' ? 'selected' : ''}>虚线</option>
                  <option value="dotted" ${config.missingKeyBorderStyle === 'dotted' ? 'selected' : ''}>点状线</option>
                  <option value="double" ${config.missingKeyBorderStyle === 'double' ? 'selected' : ''}>双线</option>
                </select>
              </div>
              <div class="config-item">
                <label>边框间距：</label>
                <input type="text" id="missing-key-border-spacing" value="${config.missingKeyBorderSpacing || '2px'}" class="small-input" placeholder="例如: 2px">
              </div>           
              <div class="config-item">
                <label>边框颜色：</label>
                <input type="color" id="missing-key-border-color" value="${config.missingKeyBorderColor || '#ff6900'}" class="color-picker">
                <input type="text" id="missing-key-border-color-text" value="${config.missingKeyBorderColor || '#ff6900'}" class="color-text">
              </div>
              

              
              <!-- 添加保存按钮 -->
              <button id="save-missing-key-style" class="primary-button">保存缺失键样式</button>
            </div>
          </div>
          
          <!-- 添加翻译功能设置模块，现在成为第5项 -->
          <div class="config-row">
            <h4>5、翻译功能设置</h4>
          </div>
          <div class="config-row">
            <div class="style-config-container">
                
            <!-- 生成键名前缀设置 -->
              <div class="config-item">
                <label>键名前缀：</label>
                <input type="text" id="key-prefix" value="${autoGenerateKeyPrefix}" class="text-input">
                <span class="help-text">自动生成键名的前缀，如：前缀.***</span>
              </div>
              <!-- 自动生成键名设置 -->
              <div class="config-item">
                <input type="checkbox" id="auto-generate-key" ${autoGenerateKeyFromText ? 'checked' : ''}>
                <label for="auto-generate-key">自动翻译生成键名</label>
                <span class="help-text">开启后将使用翻译API根据文本内容自动生成有意义的键名</span>
              </div>
              
              
              
              <!-- 自动翻译所有语言设置 -->
              <div class="config-item">
                <input type="checkbox" id="auto-translate-all" ${autoTranslateAllLanguages ? 'checked' : ''}>
                <label for="auto-translate-all">自动翻译到所有语言</label>
                <span class="help-text">开启后会自动翻译并保存到所有配置的语言文件</span>
              </div>
            </div>
          </div>

          <!-- 在配置部分添加国际化函数名配置 -->
          <div class="config-row">
            <h4>6、国际化函数识别配置</h4>
            <div class="style-config-container">
              <div class="config-item">
                <label>识别的国际化函数：</label>
                <div id="i18n-function-names">
                  ${config.get('IdentifyTheCurrentName', defaultsConfig.IdentifyTheCurrentName).map(name => `
                    <div class="function-name-item">
                      <span>${escapeHtml(name)}</span>
                      <button class="remove-function-name" data-name="${escapeHtml(name)}"> <svg class="del-svg" data-slot="icon" fill="currentColor" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path clip-rule="evenodd" fill-rule="evenodd" d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.275 5.5a.75.75 0 0 1-1.498-.075l.275-5.5a.75.75 0 0 1 .786-.711Z"></path>
                  </svg></button>
                    </div>
                  `).join('')}
                </div>
                <div class="new-function-input">
                  <input type="text" id="new-function-name" placeholder="输入国际化函数名">
                  <button id="add-function-name">添加</button>
                </div>
                <span class="help-text">定义哪些函数名会被识别为国际化调用，例如：t, $t</span>
              </div>
            </div>
          </div>

          <!-- 添加输出国际化函数名配置 -->
          <div class="config-row">
            <h4>7、输出国际化函数配置</h4>
            <div class="style-config-container">
              <div class="config-item">
                <label>输出国际化函数名称：</label>
                <input type="text" id="output-i18n-function-name" value="${escapeHtml(outputI18nFunctionName)}" class="text-input">
                <span class="help-text">替换时使用的国际化函数名称，例如：t, $t</span>
                <button id="save-output-function-name" class="primary-button" style="margin-left: 10px;">保存</button>
              </div>
            </div>
          </div>

          <!-- 添加扫描排除配置 -->
          <div class="config-row">
            <h4>8、扫描排除配置</h4>
            <div class="style-config-container">
              <div class="config-item">
                <label>排除的文件或目录模式：</label>
                <div id="exclude-patterns" class="locale-paths-list">
                  ${(config.get('excludeFiles', defaultsConfig.excludeFiles) || []).map(pattern => `
                    <div class="function-name-item locale-path-item">
                      <span>${escapeHtml(pattern)}</span>
                      <button class="remove-exclude-pattern remove-pattern remove-locale-path" data-pattern="${escapeHtml(pattern)}"> <svg class="del-svg" data-slot="icon" fill="currentColor" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path clip-rule="evenodd" fill-rule="evenodd" d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.275 5.5a.75.75 0 0 1-1.498-.075l.275-5.5a.75.75 0 0 1 .786-.711Z"></path>
                  </svg></button>
                    </div>
                  `).join('')}
                </div>
                <div class="new-function-input">
                  <input type="text" id="new-exclude-pattern" placeholder="输入要排除的文件或目录模式">
                  <button id="add-exclude-pattern">添加</button>
                </div>
                <span class="help-text">定义扫描时要排除的文件或目录模式，例如：**/node_modules/**, **/*.test.js</span>
              </div>
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
        
        // 替换单个项按钮
        document.querySelectorAll('.replace-single-btn').forEach(btn => {
          btn.addEventListener('click', function() {
            const index = parseInt(this.getAttribute('data-index'));
            
            // 先确保该项被选中
            vscode.postMessage({
              command: 'replaceSingleItem',
              data: {
                index
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
          
          // 获取缺失键样式配置
          const missingKeyBorderWidth = document.getElementById('missing-key-border-width').value;
          const missingKeyBorderStyle = document.getElementById('missing-key-border-style').value;
          const missingKeyBorderColor = document.getElementById('missing-key-border-color').value;
          const missingKeyBorderSpacing = document.getElementById('missing-key-border-spacing').value;
          
          // 构建配置对象
          const updatedConfig = {
            decorationStyle,
            suffixStyle,
            inlineStyle,
            missingKeyBorderWidth,
            missingKeyBorderStyle,
            missingKeyBorderColor,
            missingKeyBorderSpacing
          };
          
          // 发送更新样式的消息
          vscode.postMessage({
            command: 'updateDecorationStyles',
            data: {
              decorationStyle,
              suffixStyle,
              inlineStyle,
              updatedConfig
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

          // 绑定排除模式事件
          bindExcludePatternEvents();
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

        // 翻译功能设置事件处理
        document.getElementById('auto-generate-key').addEventListener('change', function() {
          vscode.postMessage({
            command: 'updateConfig',
            data: {
              key: 'i18n-swapper.autoGenerateKeyFromText',
              value: this.checked
            }
          });
        });
        
        document.getElementById('key-prefix').addEventListener('change', function() {
          vscode.postMessage({
            command: 'updateConfig',
            data: {
              key: 'i18n-swapper.autoGenerateKeyPrefix',
              value: this.value
            }
          });
        });
        
        document.getElementById('auto-translate-all').addEventListener('change', function() {
          vscode.postMessage({
            command: 'updateConfig',
            data: {
              key: 'i18n-swapper.autoTranslateAllLanguages',
              value: this.checked
            }
          });
        });

        // 为颜色输入框和选择器添加联动事件
        document.getElementById('missing-key-border-color').addEventListener('input', function() {
          document.getElementById('missing-key-border-color-text').value = this.value;
        });

        document.getElementById('missing-key-border-color-text').addEventListener('input', function() {
          document.getElementById('missing-key-border-color').value = this.value;
        });

        // 添加保存缺失键样式按钮的事件处理
        document.getElementById('save-missing-key-style').addEventListener('click', function() {
          // 获取缺失键样式配置
          const missingKeyBorderWidth = document.getElementById('missing-key-border-width').value;
          const missingKeyBorderStyle = document.getElementById('missing-key-border-style').value;
          const missingKeyBorderColor = document.getElementById('missing-key-border-color').value;
          const missingKeyBorderSpacing = document.getElementById('missing-key-border-spacing').value;
          
          // 构建配置对象
          const missingKeyConfig = {
            missingKeyBorderWidth,
            missingKeyBorderStyle,
            missingKeyBorderColor,
            missingKeyBorderSpacing
          };
          
          // 发送更新样式的消息
          vscode.postMessage({
            command: 'updateMissingKeyStyles',
            data: missingKeyConfig
          });
        });

        // 添加文本高亮点击处理
        document.querySelectorAll('.text-highlight-trigger').forEach(item => {
          item.addEventListener('click', () => {
            const start = parseInt(item.getAttribute('data-start'));
            const end = parseInt(item.getAttribute('data-end'));
            const index = parseInt(item.getAttribute('data-index'));
            
            // 获取当前元素所在行
            const row = item.closest('tr');
            // 尝试获取文件路径 - 从数据行或状态行中获取
            const filePath = row.getAttribute('data-filepath') || '';
            
            // 发送消息时包含完整信息
            vscode.postMessage({
              command: 'highlightSourceText',
              data: {
                start: start,
                end: end,
                index: index,
                filePath: filePath // 添加文件路径信息
              }
            });
          });
        });

        // 添加国际化函数名
        document.getElementById('add-function-name').addEventListener('click', function() {
          const input = document.getElementById('new-function-name');
          const name = input.value.trim();
          
          if (name) {
            vscode.postMessage({
              command: 'addI18nFunctionName',
              data: { name }
            });
            
            input.value = '';
          }
        });

        // 删除国际化函数名
        document.querySelectorAll('.remove-function-name').forEach(btn => {
          btn.addEventListener('click', function() {
            const name = this.getAttribute('data-name');
            vscode.postMessage({
              command: 'removeI18nFunctionName',
              data: { name }
            });
          });
        });

        // 添加输出国际化函数名保存按钮的事件处理
        document.getElementById('save-output-function-name').addEventListener('click', function() {
          const functionName = document.getElementById('output-i18n-function-name').value.trim();
          
          if (functionName) {
            vscode.postMessage({
              command: 'updateOutputI18nFunctionName',
              data: { functionName }
            });
          }
        });

        // 添加排除模式事件绑定
        function bindExcludePatternEvents() {
          const addBtn = document.getElementById('add-exclude-pattern');
          if (addBtn) {
            addBtn.addEventListener('click', function() {
              const input = document.getElementById('new-exclude-pattern');
              const pattern = input.value.trim();
              
              if (pattern) {
                vscode.postMessage({
                  command: 'addExcludePattern',
                  data: { pattern }
                });
                
                input.value = '';
              }
            });
          }
          
          document.querySelectorAll('.remove-exclude-pattern').forEach(btn => {
            btn.addEventListener('click', function() {
              const pattern = this.getAttribute('data-pattern');
              vscode.postMessage({
                command: 'removeExcludePattern',
                data: { pattern }
              });
            });
          });
        }

        // 扫描所有文件切换
        document.getElementById('scan-all-files').addEventListener('change', function() {
          vscode.postMessage({
            command: 'toggleScanAllFiles',
            data: { scanAllFiles: this.checked }
          });
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