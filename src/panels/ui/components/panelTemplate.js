const { escapeHtml } = require('../utils/htmlUtils');

/**
 * 生成表格行HTML
 * @param {Object} item 项目数据
 * @param {number} index 项目索引
 * @param {string} scanMode 扫描模式
 * @param {boolean} scanAllFiles 是否扫描所有文件
 * @returns {string} 表格行HTML
 */
function generateTableRow(item, index, scanMode, scanAllFiles) {
  // 生成数据行
  const dataRow = `
    <tr data-filepath="${item.filePath || ''}" data-index="${index}" data-filename="${item.fileName || ''}">
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
        ${`<input type="text" class="i18n-key-input" data-index="${index}" 
            value="${escapeHtml(item.i18nKey || '')}" placeholder="输入国际化键，用于翻译后自动插入">
          <button class="translate-btn" data-index="${index}" title="翻译并保存到所有语言文件">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>
            
          </button>
          <button class="replace-single-btn" data-index="${index}" title="替换此项">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h8.5"/><path d="M13 3h8.5"/><path d="M18 7.5V12l2-2"/><path d="M18 7.5V3"/><path d="M16 6a4 4 0 0 0-4 4"/><path d="M11 10a4 4 0 0 0-4 4"/><path d="M14 22.5l-5.5-5.5 5.5-5.5c.59-.58.59-1.52 0-2.1-.58-.59-1.52-.59-2.1 0l-5.5 5.5c-.58.59-.58 1.53 0 2.12l5.5 5.5c.3.28.7.42 1.1.42.38 0 .77-.14 1.06-.42.56-.55.57-1.47-.06-2.04z"/></svg>
            
          </button>`
        }
      </td>
      ${scanAllFiles ? `
        <td class="file-path-cell text-highlight-trigger" 
          data-start="${item.start}" 
          data-end="${item.end}" 
          data-index="${index}" 
          data-filepath="${item.filePath || ''}"
          title="点击定位到代码位置">
          ${escapeHtml(item.displayPath || item.filePath || '')}
        </td>
      ` : ''}
    </tr>`;
  return dataRow;
}

/**
 * 生成表格行和状态行HTML
 * @param {Object} item 项目数据
 * @param {number} index 项目索引
 * @param {string} scanMode 扫描模式
 * @param {boolean} scanAllFiles 是否扫描所有文件
 * @param {Array} languageMappings 语言映射
 * @param {Object} LANGUAGE_NAMES 语言名称对象
 * @returns {string} 表格行和状态行HTML
 */
function generateTableRowWithStatus(item, index, scanMode, scanAllFiles, languageMappings, LANGUAGE_NAMES) {
  const dataRow = generateTableRow(item, index, scanMode, scanAllFiles);
  
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
}

/**
 * 生成面板主体HTML内容
 * @param {Array} scanPatterns 扫描模式列表
 * @param {Array} replacements 替换项列表
 * @param {Array} localesPaths 本地化文件路径列表
 * @param {Object} context 上下文对象，包含decorationStyle等配置
 * @param {boolean} isConfigExpanded 配置部分是否展开
 * @param {Array} languageMappings 语言映射配置
 * @param {Array} existingI18nCalls 已存在的国际化调用
 * @param {boolean} scanAllFiles 是否扫描所有文件
 * @param {string} currentFilePath 当前文件路径
 * @param {Object} LANGUAGE_NAMES 语言名称映射
 * @returns {string} 面板主体HTML内容
 */
function generatePanelBody(scanPatterns, replacements, localesPaths, context, isConfigExpanded, languageMappings, existingI18nCalls, scanAllFiles, currentFilePath, LANGUAGE_NAMES, config = {}) {
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

  // 预处理文件路径，提取文件名
  if (scanAllFiles) {
    displayItems = displayItems.map(item => {
      if (item.filePath) {
        // 从文件路径中提取文件名（不包含目录和后缀）
        const pathParts = item.filePath.split(/[\/\\]/);
        const fullFileName = pathParts[pathParts.length - 1]; // 最后一部分是文件名
        const fileName = fullFileName.split('.')[0]; // 移除后缀
        
        return {
          ...item,
          fileName: fileName,
          fullFileName: fullFileName
        };
      }
      return item;
    });
  }

  // 获取输出国际化函数名称
  const outputI18nFunctionName = context.outputI18nFunctionName || config.get('functionName', 't');

  return `
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
          <button id="replace-selected" class="action-button replace-btn" title="仅替换已选中的项目">
            替换选中项
          </button>
          <button id="replace-all" class="action-button replace-all-btn" title="替换所有有国际化键的项目（无需选中）">
            替换所有项
          </button>
          <button id="refresh-panel">刷新</button>
          <button id="open-api-translation">API翻译配置</button>
                        <!-- 添加文件名筛选功能，仅在扫描所有文件模式下显示 -->
      ${scanAllFiles ? `
      <div class="file-filter-container">
        <div class="file-filter-input-container">
        <label for="file-name-filter" class="file-name-filter-label">文件名：
          <input  type="text" id="file-name-filter" placeholder="输入文件名进行筛选" class="file-filter-input">
          <button id="clear-file-filter" class="clear-filter-btn" title="清除筛选">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
          </label>
        </div>
      </div>
      ` : ''}
             
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
              <td class="checkbox-cell"></td>
              <td>序号</td>
              ${scanMode === 'all' ? '<td>类型</td>' : (scanMode === 'pending'?'<td>文本</td>':'')}
              ${scanMode === 'translated' ? '<td>源语言值</td>' :(scanMode === 'all' ? '<td>文本</td>':'')}
              <td>国际化键</td>
              ${scanAllFiles ? '<td>文件路径</td>' : ''} <!-- 添加文件路径列 -->
            </tr>
          </thead>
          <tbody id="replacements-tbody">
            ${displayItems.length > 0 ? displayItems.map((item, index) => {
              return generateTableRowWithStatus(item, index, scanMode, scanAllFiles, languageMappings, LANGUAGE_NAMES);
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
          当前文件: ${currentFilePath ? escapeHtml(currentFilePath) : '未打开文件'}
        </div>
      </div>
      
      <!-- 在样式中添加筛选功能相关的CSS样式 -->
      <style>
        .file-filter-container {
          background-color: var(--vscode-editor-background);
          box-shadow: var(--vscode-panel-border) 0px 0px 0px 1px;
          border-radius: 4px;
        }

        .file-filter-input-container {
          display: flex;
          align-items: center;
          position: relative; /* 添加相对定位，用于下拉列表的绝对定位 */
        }
        .file-name-filter-label{
            width: 230px;
    display: flex;
    align-items: center;
    padding-left: 5px;
        }
        .file-filter-input {
          flex: 1;
          width:120px;
          padding: 6px 8px;
          border: 1px solid var(--vscode-input-border);
          background-color: var(--vscode-input-background);
          color: var(--vscode-input-foreground);
          border-radius: 4px;
          font-size: 13px;
        }

        .file-filter-info {
          display: block;
          font-size: 12px;
          color: var(--vscode-descriptionForeground);
          margin-top: 4px;
        }

        .clear-filter-btn {
          background: none;
          border: none;
          cursor: pointer;
          color: var(--vscode-button-foreground);
          margin-left: 5px;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
        }

        .clear-filter-btn:hover {
          background-color: var(--vscode-button-hoverBackground);
        }

        .hidden-row {
          display: none !important;
        }
        
        /* 文件名下拉列表样式 */
        .file-name-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          max-height: 200px;
          overflow-y: auto;
          background-color: var(--vscode-input-background);
          border: 1px solid var(--vscode-panel-border);
          border-radius: 4px;
          z-index: 1000;
          margin-top: 4px;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
        }
        
        .file-dropdown-item {
          padding: 6px 8px;
          cursor: pointer;
          font-size: 13px;
          color: var(--vscode-input-foreground);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          transition: background-color 0.2s;
        }
        
        .file-dropdown-item:hover {
          background-color: var(--vscode-list-hoverBackground);
        }
      </style>
      
      <!-- 配置面板（位于底部） -->
      <div class="${isConfigExpanded ? 'config-section expanded' : 'config-section'}" id="config-section-header" style="display: flex;position: sticky;top: 0;">
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
                <option value="suffix" ${context.decorationStyle === 'suffix' ? 'selected' : ''}>t('key')(译文)</option>
                <option value="inline" ${context.decorationStyle === 'inline' ? 'selected' : ''}>t(译文)</option>
              </select>
              <span class="help-text">选择i18n函数调用的显示风格</span>
            </div>
            <div id="inline-edit-options" class="config-row" style="${context.decorationStyle === 'inline' ? '' : 'display: none;'}">
              <div class="config-item">
                <input type="checkbox" id="show-preview-in-edit" ${context.showFullFormInEditMode ? 'checked' : ''}>
                <label for="show-preview-in-edit">编辑时显示译文预览</label>
              </div>
            </div>
            <!-- 后缀模式样式配置 -->
            <div id="suffix-style-config" class="style-config-group" ${context.decorationStyle === 'suffix' ? '' : 'style="display: none;"'}>
              <div class="config-item">
                <label>文本颜色：</label>
                <input type="color" id="suffix-color" value="${context.suffixStyle?.color || '#6A9955'}" class="color-picker">
                <input type="text" id="suffix-color-text" value="${context.suffixStyle?.color || '#6A9955'}" class="color-text">
              </div>
              <div class="config-item">
                <label>字体大小(px)：</label>
                <input type="number" id="suffix-font-size" value="${parseInt(context.suffixStyle?.fontSize) || 14}" min="8" max="32" class="number-input">
                <span class="unit">px</span>
              </div>
              <div class="config-item">
                <label>字体粗细：</label>
                <input type="number" id="suffix-font-weight" value="${context.suffixStyle?.fontWeight || 400}" min="100" max="900" step="100" class="number-input">
              </div>
              <div class="config-item">
                <label>字体样式：</label>
                <select id="suffix-font-style" class="form-control">
                  <option value="normal" ${context.suffixStyle?.fontStyle === 'normal' ? 'selected' : ''}>正常</option>
                  <option value="italic" ${context.suffixStyle?.fontStyle === 'italic' ? 'selected' : ''}>斜体</option>
                  <option value="oblique" ${context.suffixStyle?.fontStyle === 'oblique' ? 'selected' : ''}>倾斜</option>
                </select>
              </div>
              <div class="config-item">
                <label>文字间距：</label>
                <input type="text" id="suffix-margin" value="${context.suffixStyle?.margin || '0 0 0 3px'}" class="margin-input" placeholder="上 右 下 左 (例如: 0 0 0 3px)">
                <span class="help-text small">格式: 上 右 下 左 (例如: 0 0 0 3px)</span>
              </div>
            </div>
            
            <!-- 内联模式样式配置 -->
            <div id="inline-style-config" class="style-config-group" ${context.decorationStyle === 'inline' ? '' : 'style="display: none;"'}>
              <div class="config-item">
                <label>文本颜色：</label>
                <input type="color" id="inline-color" value="${context.inlineStyle?.color || '#CE9178'}" class="color-picker">
                <input type="text" id="inline-color-text" value="${context.inlineStyle?.color || '#CE9178'}" class="color-text">
              </div>
              <div class="config-item">
                <label>字体大小(px)：</label>
                <input type="number" id="inline-font-size" value="${parseInt(context.inlineStyle?.fontSize) || 14}" min="8" max="32" class="number-input">
                <span class="unit">px</span>
              </div>
              <div class="config-item">
                <label>字体粗细：</label>
                <input type="number" id="inline-font-weight" value="${context.inlineStyle?.fontWeight || 400}" min="100" max="900" step="100" class="number-input">
              </div>
              <div class="config-item">
                <label>字体样式：</label>
                <select id="inline-font-style" class="form-control">
                  <option value="normal" ${context.inlineStyle?.fontStyle === 'normal' ? 'selected' : ''}>正常</option>
                  <option value="italic" ${context.inlineStyle?.fontStyle === 'italic' ? 'selected' : ''}>斜体</option>
                  <option value="oblique" ${context.inlineStyle?.fontStyle === 'oblique' ? 'selected' : ''}>倾斜</option>
                </select>
              </div>
              <div class="config-item">
                <label>文字间距：</label>
                <input type="text" id="inline-margin" value="${context.inlineStyle?.margin || '0'}" class="margin-input" placeholder="上 右 下 左">
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
              <input type="text" id="key-prefix" value="${context.autoGenerateKeyPrefix}" class="text-input">
              <span class="help-text">自动生成键名的前缀，如：前缀.***</span>
            </div>
            <!-- 自动生成键名设置 -->
            <div class="config-item">
              <input type="checkbox" id="auto-generate-key" ${context.autoGenerateKeyFromText ? 'checked' : ''}>
              <label for="auto-generate-key">自动翻译生成键名</label>
              <span class="help-text">开启后将使用翻译API根据文本内容自动生成有意义的键名</span>
            </div>
            
            <!-- 自动翻译所有语言设置 -->
            <div class="config-item">
              <input type="checkbox" id="auto-translate-all" ${context.autoTranslateAllLanguages ? 'checked' : ''}>
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
                ${config.get('IdentifyTheCurrentName', []).map(name => `
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
                ${(config.get('excludeFiles', []) || []).map(pattern => `
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
  `;
}

module.exports = {
  generatePanelBody,
  generateTableRow,
  generateTableRowWithStatus,
  
  /**
   * 文件名筛选工具对象
   * 用于在前端处理文件名筛选功能
   */
  fileNameFilter: {
    // 存储当前筛选值
    currentFilterValue: '',
    
    /**
     * 初始化筛选功能
     * 为筛选输入框和清除按钮添加事件监听器
     */
    initialize: function() {
      const filterInput = document.getElementById('file-name-filter');
      const clearButton = document.getElementById('clear-file-filter');
      
      if (filterInput) {
        // 添加输入事件监听器
        filterInput.addEventListener('input', this.handleFilter.bind(this));
        
        // 添加按键事件，支持按ESC键清除
        filterInput.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            filterInput.value = '';
            this.handleFilter();
          }
        });
        
        // 添加焦点事件，显示文件名下拉列表
        filterInput.addEventListener('focus', this.showFileNameDropdown.bind(this));
        
        // 点击文档其他位置时隐藏下拉列表
        document.addEventListener('click', (e) => {
          if (e.target !== filterInput && !e.target.closest('.file-dropdown-item')) {
            this.hideFileNameDropdown();
          }
        });
      }
      
      if (clearButton) {
        // 添加清除按钮事件
        clearButton.addEventListener('click', () => {
          if (filterInput) {
            filterInput.value = '';
            this.handleFilter();
            // 清除后让输入框重新获得焦点
            filterInput.focus();
          }
        });
      }
      
      // 初始化完成后，如果有之前的筛选值，重新应用筛选
      this.reapplyFilter();
    },
    
    /**
     * 处理筛选
     * 根据输入的文件名筛选表格行
     */
    handleFilter: function() {
      const filterInput = document.getElementById('file-name-filter');
      if (!filterInput) return;
      
      const filterValue = filterInput.value.trim().toLowerCase();
      const tbody = document.getElementById('replacements-tbody');
      
      if (!tbody) return;
      
      // 获取所有表格行
      const rows = tbody.querySelectorAll('tr:not(.i18n-status-row)');
      let visibleCount = 0;
      
      // 遍历所有行，根据文件名筛选
      rows.forEach(row => {
        // 获取行的数据属性
        const filename = row.getAttribute('data-filename') || '';
        const filepath = row.getAttribute('data-filepath') || '';
        
        // 如果没有文件名，可能是从文件路径中提取
        let match = false;
        
        if (filterValue === '') {
          // 如果筛选值为空，显示所有行
          match = true;
        } else {
          // 从文件路径中提取文件名
          const pathParts = filepath.split(/[\/\\]/);
          const fullFileName = pathParts[pathParts.length - 1]; // 最后一部分是文件名
          
          // 改进匹配逻辑
          // 1. 检查文件名是否包含筛选值（包括带点的情况）
          if (fullFileName.toLowerCase().includes(filterValue)) {
            match = true;
          }
          // 2. 检查不含后缀的文件名是否包含筛选值
          else if (filename.toLowerCase().includes(filterValue)) {
            match = true;
          }
          // 3. 检查文件路径是否包含筛选值
          else if (filepath.toLowerCase().includes(filterValue)) {
            match = true;
          }
        }
        
        // 设置行的可见性并添加自定义数据属性标记筛选状态
        if (match) {
          row.classList.remove('hidden-row');
          row.setAttribute('data-filtered', 'visible');
          visibleCount++;
          
          // 如果有关联的状态行，也显示它
          const index = row.getAttribute('data-index');
          if (index) {
            const statusRow = tbody.querySelector(`.i18n-status-row[data-index="${index}"]`);
            if (statusRow) {
              statusRow.classList.remove('hidden-row');
            }
          }
        } else {
          row.classList.add('hidden-row');
          row.setAttribute('data-filtered', 'hidden');
          
          // 隐藏关联的状态行
          const index = row.getAttribute('data-index');
          if (index) {
            const statusRow = tbody.querySelector(`.i18n-status-row[data-index="${index}"]`);
            if (statusRow) {
              statusRow.classList.add('hidden-row');
            }
          }
        }
      });
      
      // 存储当前筛选值
      this.currentFilterValue = filterValue;
      
      // 更新筛选信息
      this.updateFilterInfo(visibleCount, rows.length);
      
      // 将筛选状态发送给扩展
      if (window.vscode) {
        window.vscode.postMessage({
          command: 'updateFilterState',
          data: {
            filterValue: filterValue,
            visibleCount: visibleCount,
            totalCount: rows.length
          }
        });
      }
      
      // 隐藏下拉列表
      this.hideFileNameDropdown();
    },
    
    /**
     * 更新筛选信息
     * @param {number} visibleCount 可见行数
     * @param {number} totalCount 总行数
     */
    updateFilterInfo: function(visibleCount, totalCount) {
      const infoSpan = document.querySelector('.file-filter-info');
      if (infoSpan) {
        if (visibleCount < totalCount) {
          infoSpan.textContent = `筛选中: 显示 ${visibleCount}/${totalCount} 项结果`;
        } else {
          infoSpan.textContent = `筛选将匹配文件名（支持包含或不包含后缀）`;
        }
      }
    },
    
    /**
     * 重新应用筛选
     * 在DOM更新后，恢复之前的筛选状态
     */
    reapplyFilter: function() {
      // 如果有存储的筛选值，重新设置到输入框并应用筛选
      const filterInput = document.getElementById('file-name-filter');
      if (filterInput && this.currentFilterValue) {
        filterInput.value = this.currentFilterValue;
        this.handleFilter();
      }
    },
    
    /**
     * 获取当前可见项的索引列表
     * @returns {Array} 可见项的索引数组
     */
    getVisibleItemIndexes: function() {
      const visibleIndexes = [];
      const tbody = document.getElementById('replacements-tbody');
      
      if (tbody) {
        const rows = tbody.querySelectorAll('tr:not(.i18n-status-row)');
        rows.forEach(row => {
          if (row.getAttribute('data-filtered') !== 'hidden' && !row.classList.contains('hidden-row')) {
            const index = parseInt(row.getAttribute('data-index'));
            if (!isNaN(index)) {
              visibleIndexes.push(index);
            }
          }
        });
      }
      
      return visibleIndexes;
    },
    
    /**
     * 显示文件名下拉列表
     * 根据当前表格中的文件路径生成下拉列表
     */
    showFileNameDropdown: function() {
      // 移除已有的下拉列表
      this.hideFileNameDropdown();
      
      const tbody = document.getElementById('replacements-tbody');
      if (!tbody) return;
      
      // 收集所有唯一的文件名
      const fileNames = new Set();
      const rows = tbody.querySelectorAll('tr:not(.i18n-status-row)');
      
      rows.forEach(row => {
        const filepath = row.getAttribute('data-filepath') || '';
        if (filepath) {
          const pathParts = filepath.split(/[\/\\]/);
          const fileName = pathParts[pathParts.length - 1]; // 完整文件名（带后缀）
          if (fileName) {
            fileNames.add(fileName);
          }
        }
      });
      
      // 如果没有文件名，不显示下拉列表
      if (fileNames.size === 0) return;
      
      // 创建下拉列表容器
      const dropdown = document.createElement('div');
      dropdown.className = 'file-name-dropdown';
      
      // 将文件名添加到下拉列表
      [...fileNames].sort().forEach(fileName => {
        const item = document.createElement('div');
        item.className = 'file-dropdown-item';
        item.textContent = fileName;
        
        // 点击文件名时，设置筛选值并应用筛选
        item.addEventListener('click', () => {
          const filterInput = document.getElementById('file-name-filter');
          if (filterInput) {
            filterInput.value = fileName;
            this.handleFilter();
          }
        });
        
        dropdown.appendChild(item);
      });
      
      // 添加下拉列表到DOM
      const filterContainer = document.querySelector('.file-filter-input-container');
      if (filterContainer) {
        filterContainer.appendChild(dropdown);
      }
    },
    
    /**
     * 隐藏文件名下拉列表
     */
    hideFileNameDropdown: function() {
      const dropdown = document.querySelector('.file-name-dropdown');
      if (dropdown) {
        dropdown.remove();
      }
    }
  }
}; 