/**
 * 编辑值输入框样式定义
 * 用于右键菜单编辑功能的样式
 */
function getEditValueStyles() {
  return `
    /* 编辑值输入框样式 */
    .edit-value-input-container {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 40px;
      background-color: var(--vscode-editor-background);
      border-bottom: 1px solid var(--vscode-editorWidget-border);
      display: flex;
      align-items: center;
      padding: 0 10px;
      z-index: 10000;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
    }
    
    .edit-value-input {
      flex: 1;
      height: 28px;
      padding: 0 8px;
      border: 1px solid var(--vscode-input-border);
      background-color: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border-radius: 3px;
      font-size: 14px;
    }
    
    .edit-value-save {
      margin-left: 10px;
      padding: 4px 10px;
      border: none;
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border-radius: 3px;
      cursor: pointer;
    }
    
    .edit-value-cancel {
      margin-left: 5px;
      padding: 4px 10px;
      border: none;
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border-radius: 3px;
      cursor: pointer;
    }
  `;
}

module.exports = { getEditValueStyles }; 