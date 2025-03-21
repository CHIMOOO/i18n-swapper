/**
 * 生成面板的CSS样式
 * @returns {string} 包含所有样式的CSS代码
 */
function getPanelStyles() {
  return `
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
          flex-wrap: wrap;
          width: 100%;
         
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
      border: 1px solid var(--vscode-panel-border);
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
      margin-left: auto;
    }
      .select-all-container label{
            white-space: nowrap;
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
     .pattern-list li,.locale-path-item span,.function-name-item {
    padding: 0 0 0 8px;
        margin-right: 8px;
    }
        .function-name-item.locale-path-item span{
            padding-left:0;
        }

       .pattern-list li button,.locale-path-item .remove-locale-path,#i18n-function-names .function-name-item button {
    background:oklch(0.396 0.141 25.723);
        padding: 5px 5px;
    }
       .function-name-item,.locale-path-item,.pattern-item{
            border: 1px solid var(--vscode-panel-border);
border-radius: 3px;
        }
     
.del-svg{
   height: 16px;
width: 16px;
fill: #d6d6dd;
}
      .pattern-list li  span,.function-name-item span{
          margin-right: 10px;
      }
    .pattern-item, .locale-path-item {
      display: flex;
      align-items: center;
      margin-bottom: 5px;
      border: 1px solid var(--vscode-panel-border);
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
      border: 1px solid var(--vscode-panel-border);
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
    }

    .text-highlight-trigger {
      cursor: pointer;
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

    /* 文件路径单元格样式 */
    .file-path-cell {
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 0.9em;
      color: var(--vscode-descriptionForeground);
    }

    .file-path-cell:hover {
      text-overflow: clip;
      white-space: normal;
      word-break: break-all;
    }
  `;
}

module.exports = {
  getPanelStyles
}; 