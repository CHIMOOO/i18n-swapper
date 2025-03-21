/**
 * 生成面板的JavaScript代码
 * @param {Object} languageMappings 语言映射配置
 * @param {Object} LANGUAGE_NAMES 语言名称映射
 * @returns {string} 包含所有脚本的JavaScript代码
 */
function getPanelScripts(languageMappings, LANGUAGE_NAMES) {
  return `
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
    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener('change', function() {
        const isChecked = this.checked;
        
        // 获取当前可见项的索引（考虑筛选状态）
        let visibleIndexes = [];
        const rows = document.querySelectorAll('#replacements-tbody tr:not(.i18n-status-row)');
        
        // 如果没有表格，尝试获取所有复选框
        if (rows.length === 0) {
          document.querySelectorAll('.item-checkbox').forEach((checkbox, idx) => {
            const row = checkbox.closest('tr');
            if (row && !row.classList.contains('hidden-row')) {
              visibleIndexes.push(parseInt(checkbox.getAttribute('data-index')));
            }
          });
        } else {
          // 如果有表格，遍历行
          for (let i = 0; i < rows.length; i++) {
            if (!rows[i].classList.contains('hidden-row')) {
              const index = parseInt(rows[i].getAttribute('data-index'));
              if (!isNaN(index)) {
                visibleIndexes.push(index);
              }
            }
          }
        }
        
        console.log('全选/取消全选，可见索引:', visibleIndexes);
        
        // 在修改DOM前先通知后端状态变化，只更新可见项
        vscode.postMessage({
          command: 'toggleSelectVisible',
          data: {
            isChecked,
            visibleIndexes
          }
        });
        
        // 然后本地更新复选框状态，只更新可见项的复选框
        document.querySelectorAll('.item-checkbox').forEach(checkbox => {
          const row = checkbox.closest('tr');
          if (row && !row.classList.contains('hidden-row')) {
            checkbox.checked = isChecked;
          }
        });
      });
    }
    
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
    document.getElementById('replace-selected').addEventListener('click', async function() {
      const confirmed = await confirmAction('确定要替换选中的项目吗？替换后请手动保存确认。');
      if (!confirmed) {
        return;
      }
      
      // 获取可见且选中的项目索引
      const selectedVisibleIndexes = [];
      
      // 获取表格中所有可见行
      const checkboxes = document.querySelectorAll('.item-checkbox');
      for (let i = 0; i < checkboxes.length; i++) {
        // 检查是否选中且可见
        const row = checkboxes[i].closest('tr');
        if (checkboxes[i].checked && !row.classList.contains('hidden-row')) {
          selectedVisibleIndexes.push(i);
        }
      }
      
      if (selectedVisibleIndexes.length === 0) {
        showToast('请先选择要替换的项目', 'warning');
        return;
      }
      
      // 发送替换选中项命令
      vscode.postMessage({
        command: 'replaceSelected',
        data: {
          selectedIndexes: selectedVisibleIndexes
        }
      });
    });
    
    // 确认操作函数
    function confirmAction(message) {
      // 创建自定义确认对话框
      return new Promise((resolve) => {
        // 检查是否已存在确认框
        let existingDialog = document.getElementById('custom-confirm-dialog');
        if (existingDialog) {
          existingDialog.remove();
        }
        
        // 创建确认对话框容器
        const dialog = document.createElement('div');
        dialog.id = 'custom-confirm-dialog';
        dialog.style.position = 'fixed';
        dialog.style.top = '0';
        dialog.style.left = '0';
        dialog.style.right = '0';
        dialog.style.bottom = '0';
        dialog.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        dialog.style.display = 'flex';
        dialog.style.justifyContent = 'center';
        dialog.style.alignItems = 'center';
        dialog.style.zIndex = '9999';
        
        // 创建对话框内容
        const dialogContent = document.createElement('div');
        dialogContent.style.backgroundColor = 'var(--vscode-editor-background)';
        dialogContent.style.color = 'var(--vscode-editor-foreground)';
        dialogContent.style.padding = '20px';
        dialogContent.style.borderRadius = '5px';
        dialogContent.style.boxShadow = 'var(--vscode-button-background) 0px 0px 10px 10px';
        dialogContent.style.width = '300px';
        dialogContent.style.border ='1px solid rgb(255 255 255 / 35%)';
        
        // 添加消息
        const messageElement = document.createElement('p');
        messageElement.textContent = message;
        messageElement.style.marginBottom = '10px';
        dialogContent.appendChild(messageElement);
        
        // 添加额外提示信息
        const tipElement = document.createElement('p');
        tipElement.textContent = '（无国际化键的数据无法替换）';
        tipElement.style.fontSize = '12px';
        tipElement.style.color = 'var(--vscode-descriptionForeground)';
        tipElement.style.marginBottom = '20px';
        dialogContent.appendChild(tipElement);
        
        // 添加按钮容器
        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.justifyContent = 'flex-end';
        
        // 确认按钮
        const confirmButton = document.createElement('button');
        confirmButton.textContent = '确认';
        confirmButton.style.backgroundColor = 'var(--vscode-button-background)';
        confirmButton.style.color = 'var(--vscode-button-foreground)';
        confirmButton.style.border = 'none';
        confirmButton.style.padding = '5px 10px';
        confirmButton.style.marginLeft = '10px';
        confirmButton.style.cursor = 'pointer';
        confirmButton.style.borderRadius = '3px';
        
        // 取消按钮
        const cancelButton = document.createElement('button');
        cancelButton.textContent = '取消';
        cancelButton.style.backgroundColor = 'var(--vscode-button-secondaryBackground, #333)';
        cancelButton.style.color = 'var(--vscode-button-secondaryForeground, #fff)';
        cancelButton.style.border = 'none';
        cancelButton.style.padding = '5px 10px';
        cancelButton.style.cursor = 'pointer';
        cancelButton.style.borderRadius = '3px';
        
        // 添加按钮事件
        confirmButton.onclick = () => {
          dialog.remove();
          resolve(true);
        };
        
        cancelButton.onclick = () => {
          dialog.remove();
          resolve(false);
        };
        
        // 添加按钮到容器
        buttonContainer.appendChild(cancelButton);
        buttonContainer.appendChild(confirmButton);
        dialogContent.appendChild(buttonContainer);
        
        // 添加内容到对话框
        dialog.appendChild(dialogContent);
        
        // 添加对话框到文档
        document.body.appendChild(dialog);
        
        // 聚焦确认按钮
        confirmButton.focus();
      });
    }
    
    // 替换按钮点击事件 - 替换所有
    document.getElementById('replace-all').addEventListener('click', async function() {
      const confirmed = await confirmAction('确定要替换所有项目吗？替换后请手动保存确认。');
      if (!confirmed) {
        return;
      }
      
      // 获取当前可见的项目索引
      const visibleIndexes = [];
      const rows = document.querySelectorAll('#replacements-tbody tr:not(.i18n-status-row)');
      for (let i = 0; i < rows.length; i++) {
        if (!rows[i].classList.contains('hidden-row')) {
          visibleIndexes.push(parseInt(rows[i].getAttribute('data-index')));
        }
      }
      
      // 判断是否有筛选
      const hasFilter = window.fileNameFilter && window.fileNameFilter.currentFilterValue && window.fileNameFilter.currentFilterValue.trim() !== '';
      
      // 发送替换所有命令
      vscode.postMessage({
        command: 'replaceAll',
        data: {
          visibleOnly: hasFilter,
          visibleIndexes: hasFilter ? visibleIndexes : []
        }
      });
    });
    
    // 刷新按钮
    document.getElementById('refresh-panel').addEventListener('click', function() {
      // 记录当前筛选状态，刷新后恢复
      let currentFilter = '';
      if (window.fileNameFilter) {
        currentFilter = window.fileNameFilter.currentFilterValue || '';
      }
      
      vscode.postMessage({
        command: 'refreshPanel',
        data: {
          currentFilter: currentFilter
        }
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
        
        // 更新全选复选框状态（考虑筛选）
        const allItems = document.querySelectorAll('.item-checkbox');
        let visibleItems = [];
        
        // 获取当前可见项
        allItems.forEach(checkbox => {
          const row = checkbox.closest('tr');
          if (row && row.getAttribute('data-filtered') !== 'hidden' && !row.classList.contains('hidden-row')) {
            visibleItems.push(parseInt(checkbox.getAttribute('data-index')));
          }
        });
        
        // 检查所有可见项是否都被选中
        const allVisibleSelected = visibleItems.length > 0 && 
          visibleItems.every(index => selectedIndexes.includes(index));
        
        if (selectAllCheckbox) {
          selectAllCheckbox.checked = allVisibleSelected;
        }
        
        // 更新所有项的选中状态
        document.querySelectorAll('.item-checkbox').forEach(checkbox => {
          const index = parseInt(checkbox.getAttribute('data-index'));
          checkbox.checked = selectedIndexes.includes(index);
        });
      } else if (message.command === 'updateI18nKeyStatus') {
        // 更新国际化键的状态
        updateI18nKeyStatusInUI(message.data);
      } else if (message.command === 'restoreFilterState') {
        // 恢复筛选状态
        if (window.fileNameFilter && message.data && message.data.filterValue) {
          window.fileNameFilter.currentFilterValue = message.data.filterValue;
          // 延迟执行以确保DOM已更新
          setTimeout(() => {
            window.fileNameFilter.reapplyFilter();
          }, 200);
        }
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

    // 模式切换按钮事件
    document.querySelectorAll('.mode-button').forEach(button => {
      button.addEventListener('click', function() {
        const mode = this.getAttribute('data-mode');
        
        // 记录当前筛选状态
        let currentFilter = '';
        if (window.fileNameFilter) {
          currentFilter = window.fileNameFilter.currentFilterValue || '';
        }
        
        // 发送切换命令，并提供当前筛选值
        vscode.postMessage({
          command: 'switchScanMode',
          data: {
            mode,
            currentFilter
          }
        });
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
      // 记录当前筛选状态，刷新后恢复
      let currentFilter = '';
      if (window.fileNameFilter) {
        currentFilter = window.fileNameFilter.currentFilterValue || '';
      }
      
      vscode.postMessage({
        command: 'toggleScanAllFiles',
        data: { 
          scanAllFiles: this.checked,
          currentFilter: currentFilter
        }
      });
    });

    // 初始化文件名筛选功能
    // 检测DOM是否加载完成
    document.addEventListener('DOMContentLoaded', function() {
      // 如果存在fileNameFilter模块，则初始化筛选功能
      if (window.fileNameFilter && typeof window.fileNameFilter.initialize === 'function') {
        window.fileNameFilter.initialize();
      }
    });
    
    // 为了确保即使在DOMContentLoaded之后加载脚本，也能正确初始化
    // 如果DOM已经加载完成，则直接初始化
    if (document.readyState === 'complete' || document.readyState === 'loaded' || document.readyState === 'interactive') {
      if (window.fileNameFilter && typeof window.fileNameFilter.initialize === 'function') {
        window.fileNameFilter.initialize();
      }
    }
    
    // 监听扫描所有文件模式切换，重新初始化筛选功能
    document.getElementById('scan-all-files').addEventListener('change', function() {
      // 延迟执行，确保DOM已更新
      setTimeout(() => {
        if (window.fileNameFilter && typeof window.fileNameFilter.initialize === 'function') {
          window.fileNameFilter.initialize();
        }
      }, 500);
    });
    
    // 监听模式切换按钮点击，重新初始化筛选功能
    document.querySelectorAll('.mode-button').forEach(button => {
      button.addEventListener('click', function() {
        // 记录当前筛选状态
        let currentFilter = '';
        if (window.fileNameFilter) {
          currentFilter = window.fileNameFilter.currentFilterValue || '';
        }
        
        // 获取模式
        const mode = this.getAttribute('data-mode');
        if (mode) {
          vscode.postMessage({
            command: 'switchScanMode',
            data: { 
              mode: mode,
              currentFilter: currentFilter
            }
          });
        }
      });
    });

    // 显示提示信息
    function showToast(message, type = 'info') {
      // 创建或获取现有的toast容器
      let toastContainer = document.getElementById('toast-container');
      if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.style.position = 'fixed';
        toastContainer.style.top = '10px';
        toastContainer.style.right = '10px';
        toastContainer.style.zIndex = '1000';
        document.body.appendChild(toastContainer);
      }
      
      // 创建新的toast
      const toast = document.createElement('div');
      toast.className = 'toast toast-' + type;
      toast.innerHTML = message;
      
      // 设置toast样式
      toast.style.backgroundColor = type === 'info' ? '#4CAF50' : type === 'warning' ? '#ff9800' : '#f44336';
      toast.style.color = 'white';
      toast.style.padding = '10px';
      toast.style.borderRadius = '5px';
      toast.style.marginBottom = '5px';
      toast.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
      toast.style.minWidth = '200px';
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.5s';
      
      // 添加到容器
      toastContainer.appendChild(toast);
      
      // 显示toast
      setTimeout(() => {
        toast.style.opacity = '1';
      }, 10);
      
      // 3秒后移除
      setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
          if (toastContainer.contains(toast)) {
            toastContainer.removeChild(toast);
          }
          
          // 如果没有更多toast，移除容器
          if (toastContainer.children.length === 0) {
            document.body.removeChild(toastContainer);
          }
        }, 500);
      }, 3000);
    }

    // 处理 restoreFilterState 消息
    window.addEventListener('message', event => {
      const message = event.data;
      
      if (message.command === 'restoreFilterState' && message.data && message.data.filterValue) {
        const filterInput = document.getElementById('file-name-filter');
        if (filterInput && window.fileNameFilter) {
          filterInput.value = message.data.filterValue;
          // 使用筛选器的处理函数应用筛选
          window.fileNameFilter.handleFilter();
        }
      }
    });

    // 删除排除模式
    document.querySelectorAll('.remove-exclude-pattern').forEach(btn => {
      btn.addEventListener('click', function(event) {
        // 阻止事件冒泡
        event.stopPropagation();
        
        const pattern = this.getAttribute('data-pattern');
        vscode.postMessage({
          command: 'removeExcludePattern',
          data: { pattern }
        });
      });
    });
    
    // 添加包含文件或文件夹按钮
    const addIncludePatternBtn = document.getElementById('add-include-pattern');
    if (addIncludePatternBtn) {
      addIncludePatternBtn.addEventListener('click', function(event) {
        // 阻止事件冒泡
        event.stopPropagation();
        
        const input = document.getElementById('new-include-pattern');
        const pattern = input.value.trim();
        
        if (pattern) {
          vscode.postMessage({
            command: 'addIncludePattern',
            data: { pattern }
          });
          
          input.value = '';
        }
      });
    }
    
    // 选择文件或文件夹按钮
    const selectIncludeFileBtn = document.getElementById('select-include-file');
    if (selectIncludeFileBtn) {
      selectIncludeFileBtn.addEventListener('click', () => {
        vscode.postMessage({
          command: 'selectIncludeFile'
        });
      });
    }
    
    // 删除包含文件或文件夹
    document.querySelectorAll('.remove-include-pattern').forEach(btn => {
      btn.addEventListener('click', function(event) {
        // 阻止事件冒泡
        event.stopPropagation();
        
        const pattern = this.getAttribute('data-pattern');
        vscode.postMessage({
          command: 'removeIncludePattern',
          data: { pattern }
        });
      });
    });

    // 处理选择文件夹按钮
    const selectIncludeFolderBtn = document.getElementById('select-include-folder');
    if (selectIncludeFolderBtn) {
      selectIncludeFolderBtn.addEventListener('click', () => {
        vscode.postMessage({
          command: 'selectIncludeFolder'
        });
      });
    }
  `;
}

module.exports = {
  getPanelScripts
}; 