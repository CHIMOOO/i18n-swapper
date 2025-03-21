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
    selectAllCheckbox.addEventListener('change', function() {
      const isChecked = this.checked;
      
      // 在修改DOM前先通知后端状态变化
      vscode.postMessage({
        command: 'toggleSelectAll',
        data: {}
      });
      
      // 然后本地更新复选框状态
      document.querySelectorAll('.item-checkbox').forEach(checkbox => {
        checkbox.checked = isChecked;
      });
      
      // 防止事件重复触发，设置一个标志
      selectAllCheckbox.dataset.updating = "true";
      
      // 使用延时确保状态稳定
      setTimeout(() => {
        delete selectAllCheckbox.dataset.updating;
      }, 100);
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
        // 延迟执行，确保DOM已更新
        setTimeout(() => {
          if (window.fileNameFilter && typeof window.fileNameFilter.initialize === 'function') {
            window.fileNameFilter.initialize();
          }
        }, 500);
      });
    });
  `;
}

module.exports = {
  getPanelScripts
}; 