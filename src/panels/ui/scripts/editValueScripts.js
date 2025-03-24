/**
 * 编辑值脚本定义
 * 用于右键菜单编辑功能的JavaScript脚本
 */
function getEditValueScripts() {
  return `
    // 定义全局变量，用于管理编辑输入框
    window.editInputContainer = null;
    
    // 确保函数定义在全局作用域
    window.showEditValueMenu = function(event, language, filePath, key, value) {
      event.preventDefault();
      
      // 创建编辑输入框
      window.showEditValueInput(language, filePath, key, value);
      
      return false;
    };
    
    // 显示编辑值的输入框
    window.showEditValueInput = function(language, filePath, key, value) {
      // 移除已有的输入框
      window.removeEditValueInput();
      
      // 创建输入框容器
      window.editInputContainer = document.createElement('div');
      window.editInputContainer.className = 'edit-value-input-container';
      
      // 语言标识
      const langLabel = document.createElement('span');
      langLabel.style.marginRight = '10px';
      langLabel.style.fontWeight = 'bold';
      langLabel.textContent = \`[\${language}]\`;
      
      // 创建输入框
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'edit-value-input';
      input.value = value;
      input.placeholder = '输入翻译值';
      
      // 保存按钮
      const saveButton = document.createElement('button');
      saveButton.className = 'edit-value-save';
      saveButton.textContent = '保存';
      saveButton.onclick = function() {
        window.saveTranslationValue(language, filePath, key, input.value);
      };
      
      // 取消按钮
      const cancelButton = document.createElement('button');
      cancelButton.className = 'edit-value-cancel';
      cancelButton.textContent = '取消';
      cancelButton.onclick = window.removeEditValueInput;
      
      // 按下Enter键保存，按下Esc键取消
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          window.saveTranslationValue(language, filePath, key, input.value);
        } else if (e.key === 'Escape') {
          window.removeEditValueInput();
        }
      });
      
      // 添加元素到容器
      window.editInputContainer.appendChild(langLabel);
      window.editInputContainer.appendChild(input);
      window.editInputContainer.appendChild(saveButton);
      window.editInputContainer.appendChild(cancelButton);
      
      // 添加容器到页面
      document.body.appendChild(window.editInputContainer);
      
      // 聚焦输入框
      input.focus();
      input.select();
    };
    
    // 保存翻译值
    window.saveTranslationValue = function(language, filePath, key, value) {
      // 发送消息给VS Code扩展
      vscode.postMessage({
        command: 'saveTranslation',
        language: language,
        filePath: filePath,
        key: key,
        value: value
      });
      
      // 移除输入框
      window.removeEditValueInput();
    };
    
    // 移除编辑输入框
    window.removeEditValueInput = function() {
      if (window.editInputContainer) {
        window.editInputContainer.remove();
        window.editInputContainer = null;
      }
    };
    
    // 监听点击事件，当点击页面其他区域时隐藏输入框
    document.addEventListener('click', function(e) {
      if (window.editInputContainer && !window.editInputContainer.contains(e.target)) {
        window.removeEditValueInput();
      }
    });
  `;
}

module.exports = { getEditValueScripts }; 