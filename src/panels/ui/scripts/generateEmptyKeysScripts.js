/**
 * 自动生成空国际化键的功能模块
 * 提供前端界面与后端扩展交互的功能
 */

/**
 * 获取自动生成空键的前端脚本
 * @returns {string} 前端脚本代码
 */
function getGenerateEmptyKeysScripts() {
  return `
    // 生成空键按钮事件处理
    document.getElementById('generate-empty-keys').addEventListener('click', async function() {
      // 显示确认对话框
      const confirmed = await confirmAction('确定要为所有空的国际化键自动生成键名并翻译吗？');
      if (!confirmed) {
        return;
      }
      
      // 获取当前可见的项目
      const visibleItems = [];
      const rows = document.querySelectorAll('#replacements-tbody tr:not(.i18n-status-row)');
      
      for (let i = 0; i < rows.length; i++) {
        // 只处理可见行
        if (!rows[i].classList.contains('hidden-row')) {
          // 获取行索引
          const index = parseInt(rows[i].getAttribute('data-index'));
          
          // 获取国际化键输入框
          const keyInput = rows[i].querySelector('.i18n-key-input');
          
          // 如果行有效且国际化键为空，加入处理列表
          if (!isNaN(index) && keyInput && (!keyInput.value || keyInput.value.trim() === '')) {
            visibleItems.push(index);
          }
        }
      }
      
      // 如果没有空键，显示提示
      if (visibleItems.length === 0) {
        showToast('没有找到空的国际化键', 'info');
        return;
      }
      
      // 显示正在处理的提示
      showToast(\`正在为 \${visibleItems.length} 个空键生成键名...\`, 'info');
      
      // 发送生成命令
      vscode.postMessage({
        command: 'generateEmptyKeys',
        data: {
          indexes: visibleItems
        }
      });
    });
    
    // 监听空键生成完成事件
    window.addEventListener('message', (event) => {
      const message = event.data;
      
      // 处理生成完成事件
      if (message.command === 'generateEmptyKeysCompleted') {
        // 显示生成结果
        const { success, failed } = message.data;
        const totalCount = success + failed;
        
        if (failed === 0) {
          showToast(\`成功为 \${success} 个空键生成了键名\`, 'success');
        } else if (success === 0) {
          showToast(\`生成失败，所有 \${failed} 个键名生成失败\`, 'error');
        } else {
          showToast(\`部分成功：\${success}个成功，\${failed}个失败\`, 'warning');
        }
      }
    });
  `;
}

module.exports = {
  getGenerateEmptyKeysScripts
}; 