const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const utils = require('../utils');
const {
  SUPPORTED_LANGUAGE_MAPPINGS,
  LANGUAGE_NAMES
} = require('../utils/language-mappings');
const {
  getPanelHtml
} = require('./ui/panelHtmlGenerator');
const {
  analyzeDocument
} = require('./services/documentAnalyzer');
const {
  createOrSelectLanguageFiles,
  saveTranslationToFile
} = require('./services/languageFileManager');
const {
  performReplacements,
  generateReplacement
} = require('./services/replacementService');
const {
  generateKeyFromText,
  translateText,
  getLanguageName
} = require('./services/translationService');
const {
  translateTextToAllLanguages
} = require('../services/translationService');
const defaultsConfig = require('../config/defaultsConfig'); // 引入默认配置，更改为明确的名称
const HighlightService = require('./services/highlightService'); // 新增：引入高亮服务
const I18nKeyStatusService = require('./services/i18nKeyStatusService'); // 新增：引入i18n键状态服务
const workspaceScannerService = require('./services/workspaceScannerService');
const pathUtils = require('../utils/path-utils');



/**
 * 批量替换面板类
 */
class BatchReplacementPanel {
  /**
   * @param {vscode.ExtensionContext} context 扩展上下文
   */
  constructor(context) {
    this.context = context;
    this.panel = null;
    this.document = null;
    this.replacements = [];
    this.translatedItems = [];
    this.selectedIndexes = [];
    this.isConfigExpanded = false; // 默认折叠
    this.scanMode = 'pending'; // 扫描模式，默认为待转义
    this.scanAllFiles = false; // 添加扫描所有文件标志
    this.existingI18nCalls = []; // 存储已转义的国际化调用
    this.allFilesResults = {    // 存储所有文件的扫描结果
      replacements: [],
      existingCalls: []
    };

    // 加载配置
    this._loadConfiguration();

    // 处理面板关闭和视图状态变更
    this._disposables = [];

    // 初始化高亮服务
    this.highlightService = new HighlightService();

    // 初始化i18n键状态服务
    this.i18nKeyStatusService = new I18nKeyStatusService();

    // 高亮定时器（移除，现在由highlightService处理）
    // this.highlightTimer = null;
  }

  /**
   * 创建或显示面板
   */
  createOrShow() {
    // 如果已有面板，重新获取当前编辑器文档
    if (this.panel) {
      this.panel.reveal();

      // 检查当前文档是否变化
      const editor = vscode.window.activeTextEditor;
      if (editor && (!this.document || this.document !== editor.document)) {
        this.document = editor.document;
        this.analyzeAndLoadPanel();
      }

      return;
    }

    // 确保有活动编辑器
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showInformationMessage('请先打开一个文件');
      return;
    }

    // 保存文档引用
    this.document = editor.document;

    // 创建面板
    this.panel = vscode.window.createWebviewPanel(
      'i18nSwapperBatchPanel',
      'I18n批量替换',
      vscode.ViewColumn.Beside, {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(this.context.extensionPath, 'media'))
        ]
      }
    );

    // 初始化面板
    this._setupPanel();

    // 开始分析文档
    this.analyzeAndLoadPanel();
  }

  /**
   * 设置面板
   */
  _setupPanel() {
    // 设置面板图标
    this.panel.iconPath = vscode.Uri.file(
      path.join(this.context.extensionPath, 'images', 'icon.png')
    );

    // 处理消息
    this.panel.webview.onDidReceiveMessage(
      this._handlePanelMessage.bind(this),
      null,
      this._disposables
    );

    // 处理面板关闭
    this.panel.onDidDispose(
      () => this._disposePanelResources(),
      null,
      this._disposables
    );
    
    // 监听编辑器活动窗口变化
    this._registerActiveEditorChangeListener();
  }
  
  /**
   * 注册编辑器活动窗口变化监听器
   * 当用户切换到其他文件时，自动更新面板内容
   */
  _registerActiveEditorChangeListener() {
    // 监听活动编辑器变化事件
    this._activeEditorChangeDisposable = vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor && this.panel && !this.scanAllFiles) {
        // 只有在非扫描所有文件模式下，才需要更新内容
        if ((!this.document || this.document.uri.toString() !== editor.document.uri.toString())) {
          console.log('编辑器切换，自动更新面板内容');
          this.document = editor.document;
          this.analyzeAndLoadPanel();
        }
      }
    }, null, this.context.subscriptions);
  }

  /**
   * 释放面板资源
   */
  _disposePanelResources() {
    this.panel = null;

    // 清理所有订阅
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
    
    // 释放活动编辑器变化监听器
    if (this._activeEditorChangeDisposable) {
      this._activeEditorChangeDisposable.dispose();
      this._activeEditorChangeDisposable = null;
    }
  }

  /**
   * 处理面板消息
   * @param {Object} message 消息对象
   */
  async _handlePanelMessage(message) {
    // console.log('面板消息:', message);
    
    try {
      const { command, data } = message;
      
      switch (command) {
        case 'addPattern':
          await this.addScanPattern(data.pattern);
          break;
          
        case 'removePattern':
          await this.removeScanPattern(data.pattern);
          break;
          
        case 'selectLocalesFile':
          await this.selectLocaleFile();
          break;
          
        case 'removeLocalePath':
          await this.removeLocalePath(data.path);
          break;
          
        case 'switchMode':
          await this.switchScanMode(data.mode, data.currentFilter);
          break;
          
        case 'switchScanMode':
          await this.switchScanMode(data.mode, data.currentFilter);
          break;
          
        case 'openI18nFile':
          await this.openI18nFile(data.index);
          break;
          
        case 'copyI18nKey':
          await this.copyI18nKey(data.index);
          break;
          
        case 'refreshScan':
          await this.refreshScan();
          break;
          
        case 'refreshPanel':
          await this.refreshPanel(data.currentFilter);
          break;
          
        case 'toggleSelectAll':
          await this.toggleSelectAll();
          break;
          
        case 'updateI18nKey':
          this.updateI18nKey(data.index, data.key);
          break;
          
        case 'toggleItemSelection':
          this.toggleItemSelection(data.index, data.selected);
          break;
          
        case 'performSelectedReplacements':
          await this.performSelectedReplacements(data.selectedIndexes);
          break;
          
        case 'replaceSelected':
          await this.performSelectedReplacements(data.selectedIndexes);
          break;
          
        case 'replaceAll':
          if (data.visibleOnly && Array.isArray(data.visibleIndexes)) {
            await this.performVisibleReplacements(data.visibleIndexes);
          } else {
            await this.performAllReplacements();
          }
          break;
          
        case 'performAllReplacements':
          await this.performAllReplacements();
          break;
          
        case 'translateItem':
          await this.translateItem(data.index, data.userInputKey);
          break;
          
        case 'highlightText':
          await this.highlightSourceText(data.start, data.end, data.index, data.filePath);
          break;
          
        case 'applyReplacements':
          await this.applyAllReplacements();
          break;
          
        case 'replaceSingleItem':
          await this.replaceSingleItem(data);
          break;
          
        case 'updateConfiguration':
          await this.updateConfiguration(data.config);
          break;
          
        case 'updateGeneralConfig':
          await this.updateGeneralConfig(data.config);
          break;
          
        case 'addI18nFunctionName':
          await this.addI18nFunctionName(data.name);
          break;
          
        case 'removeI18nFunctionName':
          await this.removeI18nFunctionName(data.name);
          break;
          
        case 'toggleConfigExpand':
          this.isConfigExpanded = data.expanded;
          this.updatePanelContent();
          break;
          
        case 'checkI18nKeyStatus':
          await this.checkI18nKeyStatus(data.index, data.key);
          break;
          
        case 'toggleScanAllFiles':
          await this.toggleScanAllFiles(data.scanAllFiles);
          break;
          
        case 'performVisibleReplacements':
          await this.performVisibleReplacements(data.visibleIndexes);
          break;
          
        case 'openLanguageFile':
          await this.openLanguageFile(data.filePath, data.key, data.languageCode);
          break;
          
        case 'openApiTranslation':
          await this.openApiTranslationConfig();
          break;
          
        case 'updateStyleConfig':
          await this.updateStyleConfiguration(data.config);
          break;
          
        case 'updateMissingKeyStyle':
          await this.updateMissingKeyStyle(data.config);
          break;
          
        case 'addExcludePattern':
          await this.addExcludePattern(data.pattern);
          break;
          
        case 'removeExcludePattern':
          await this.removeExcludePattern(data.pattern);
          break;
          
        case 'addIncludePattern':
          await this.addIncludePattern(data.pattern);
          break;
          
        case 'removeIncludePattern':
          await this.removeIncludePattern(data.pattern);
          break;
          
        case 'selectIncludeFile':
          await this.selectIncludeFile(false);
          break;
          
        case 'selectIncludeFolder':
          await this.selectIncludeFile(true);
          break;
        
        case 'updateOutputFunctionName':
          await this.updateOutputFunctionName(data.name);
          break;
          
        case 'updateFilterState':
          // 保存筛选状态到类属性，以便在更新面板时保持
          this.filterState = data;
          break;
      }
    } catch (error) {
      console.error('处理面板消息时出错:', error);
      vscode.window.showErrorMessage(`处理面板操作时出错: ${error.message}`);
    }
  }

  /**
   * 保存翻译到文件
   */
  async saveTranslation(filePath, key, value) {
    try {
      // 获取工作区根目录
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        throw new Error('未找到工作区文件夹');
      }
      const rootPath = workspaceFolders[0].uri.fsPath;

      // 构建绝对路径
      const absolutePath = path.isAbsolute(filePath) ?
        filePath :
        path.join(rootPath, filePath);

      // 显示相对路径
      const relativePath = this.getRelativePath(absolutePath);
      console.log(`保存翻译到文件: ${relativePath}`);

      // 调用语言文件管理服务保存翻译
      await saveTranslationToFile(absolutePath, key, value);

      vscode.window.showInformationMessage(`已保存翻译: ${key} 到文件 ${relativePath}`);

      // 刷新面板
      await this.refreshPanel();
    } catch (error) {
      console.error('保存翻译出错:', error);
      throw error;
    }
  }

  /**
   * 分析并加载面板
   */
  async analyzeAndLoadPanel() {
    if (!this.document || !this.panel) return;

    try {
      vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "分析文档中...",
        cancellable: false
      }, async (progress) => {
        progress.report({
          message: "加载配置..."
        });

        // 获取配置
        const config = vscode.workspace.getConfiguration('i18n-swapper');
        const scanPatterns = config.get('scanPatterns', defaultsConfig.scanPatterns);
        let localesPaths = config.get('localesPaths', defaultsConfig.localesPaths);
        const functionName = config.get('functionName', defaultsConfig.functionName);
        const quoteType = config.get('quoteType', defaultsConfig.quoteType);

        // 尝试检查并选择国际化文件
        if (!localesPaths || localesPaths.length === 0) {
          progress.report({
            message: "选择国际化文件..."
          });
          localesPaths = await utils.checkAndSelectLocaleFile();
        }

        progress.report({
          message: "分析文档内容..."
        });

        // 获取文档内容和类型
        const text = this.document.getText();
        const fileExtension = path.extname(this.document.fileName).toLowerCase();

        // 保存旧的选择状态
        const oldSelectedMap = {};
        this.replacements.forEach((item, index) => {
          if (item.selected) {
            oldSelectedMap[item.text] = true;
          }
        });

        // 分析文档
        this.replacements = await analyzeDocument(
          text, fileExtension, scanPatterns, localesPaths, this.document
        );

        // 分析已转义内容
        this.existingI18nCalls = await this.analyzeExistingI18nCalls(
          text, this.document
        );

        // 恢复选择状态
        this.selectedIndexes = [];
        this.replacements.forEach((item, index) => {
          if (oldSelectedMap[item.text]) {
            item.selected = true;
            this.selectedIndexes.push(index);
          }
        });

        progress.report({
          message: "更新面板..."
        });

        // 更新面板
        await this.updatePanelContent();
      });
    } catch (error) {
      console.error('分析文档出错:', error);
      vscode.window.showErrorMessage(`分析文档失败: ${error.message}`);

      // 即使出错也要显示面板
      this.updatePanelContent();
    }
  }

  /**
   * 分析文档中已存在的国际化调用
   * @param {string} text 文档文本
   * @param {vscode.TextDocument} document 文档对象
   * @returns {Promise<Array>} 找到的国际化调用
   */
  async analyzeExistingI18nCalls(text, document) {
    const existingCalls = [];

    try {
      // 获取配置
      const config = vscode.workspace.getConfiguration('i18n-swapper');
      // 使用配置文件中定义的国际化函数名数组
      const i18nFunctionNames = config.get('IdentifyTheCurrentName', defaultsConfig.IdentifyTheCurrentName);

      // 对每个配置的函数名创建正则表达式
      for (const functionName of i18nFunctionNames) {
        // 确保使用词边界匹配完整的函数名
        const i18nCallRegex = new RegExp(`(\\$?\\b${functionName}\\b)\\s*\\(\\s*(['"])([^'"]+)\\2\\s*\\)`, 'g');

        let match;
        while ((match = i18nCallRegex.exec(text)) !== null) {
          const fullMatch = match[0]; // 完整匹配，如 t('common.submit')
          const fnName = match[1]; // 函数名，如 t 或 $t
          const quoteType = match[2]; // 引号类型，' 或 "
          const i18nKey = match[3]; // 国际化键，如 common.submit

          // 计算位置
          const startPos = match.index;
          const endPos = startPos + fullMatch.length;

          // 获取工作区根目录
          const workspaceFolders = vscode.workspace.workspaceFolders;
          if (!workspaceFolders) continue;

          const rootPath = workspaceFolders[0].uri.fsPath;

          // 获取语言映射配置
          const languageMappings = config.get('tencentTranslation.languageMappings', []);

          // 查找键对应的翻译值
          let translationValue = null;
          let sourceFile = null;
          let sourceText = null;
          const sourceLanguage = config.get('tencentTranslation.sourceLanguage', 'zh');

          for (const mapping of languageMappings) {
            try {
              const filePath = pathUtils.getAbsolutePath(mapping.filePath);
              if (!fs.existsSync(filePath)) continue;

              const localeData = utils.loadLocaleFile(filePath);
              if (!localeData) continue;

              // 获取嵌套键的值
              const keyParts = i18nKey.split('.');
              let value = localeData;
              let exists = true;

              for (const part of keyParts) {
                if (value && typeof value === 'object' && part in value) {
                  value = value[part];
                } else {
                  exists = false;
                  break;
                }
              }
              if (mapping.languageCode === sourceLanguage) {
                sourceText = value;
              }
              if (exists && typeof value === 'string') {
                translationValue = value;
                sourceFile = mapping.filePath;
                break;
              }
            } catch (error) {
              console.error(`获取键 ${i18nKey} 的翻译值时出错:`, error);
            }
          }

          if (typeof sourceText === 'object') {
            sourceText = null;
          }
          // 添加到结果
          existingCalls.push({
            text: sourceText || null,
            i18nKey: i18nKey,
            translationValue: translationValue,
            start: startPos,
            end: endPos,
            fnName: fnName,
            quoteType: quoteType,
            i18nFile: sourceFile,
            source: fullMatch,
            selected: false
          });
        }
      }

      // 添加到结果时转换为相对路径
      existingCalls.forEach(item => {
        if (item.i18nFile) {
          item.i18nFile = pathUtils.getRelativePath(item.i18nFile);
        }
      });
    } catch (error) {
      console.error('分析已存在的国际化调用时出错:', error);
    }

    return existingCalls;
  }

  /**
   * 更新面板内容
   */
  async updatePanelContent() {
    if (!this.panel) return;

    try {
      // 获取当前文件路径
      const currentFilePath = this.document ? pathUtils.getFileRelativePath(this.document.uri) : '';

      // 获取配置
      const config = vscode.workspace.getConfiguration('i18n-swapper');
      const scanPatterns = config.get('scanPatterns', defaultsConfig.scanPatterns);
      const localesPaths = config.get('localesPaths', defaultsConfig.localesPaths);
      const languageMappings = config.get('tencentTranslation.languageMappings', []);

      // 提前加载每个I18n键的翻译值信息
      if (languageMappings && languageMappings.length > 0) {
        await this.loadI18nKeysStatus(languageMappings);
      }

      // 确保处理所有路径信息
      // 处理 replacements 的路径
      if (this.replacements && this.replacements.length > 0) {
        this.replacements.forEach(item => {
          if (item.filePath && !item.displayPath) {
            item.displayPath = item.filePath;
          }
          if (item.i18nFile && !item.displayI18nPath) {
            item.displayI18nPath = item.i18nFile;
          }
        });
      }
      
      // 处理 existingI18nCalls 的路径
      if (this.existingI18nCalls && this.existingI18nCalls.length > 0) {
        this.existingI18nCalls.forEach(item => {
          if (item.i18nFile && !item.displayI18nPath) {
            item.displayI18nPath = item.i18nFile;
          }
          if (!item.displayPath && item.filePath) {
            item.displayPath = item.filePath;
          }
        });
      }
      
      // 处理语言映射的路径
      if (languageMappings && languageMappings.length > 0) {
        languageMappings.forEach(mapping => {
          if (mapping.filePath && !mapping.displayPath) {
            mapping.displayPath = mapping.filePath;
          }
        });
      }

      // 生成HTML内容
      const html = getPanelHtml(
        scanPatterns,
        this.replacements,
        localesPaths,
        {
          decorationStyle: config.get('decorationStyle', 'suffix'),
          showFullFormInEditMode: config.get('showFullFormInEditMode', true),
          suffixStyle: config.get('suffixStyle', {}),
          inlineStyle: config.get('inlineStyle', {}),
          autoGenerateKeyFromText: config.get('autoGenerateKeyFromText', true),
          autoGenerateKeyPrefix: config.get('autoGenerateKeyPrefix', '_iw'),
          autoTranslateAllLanguages: config.get('autoTranslateAllLanguages', true),
          outputI18nFunctionName: config.get('functionName', 't'),
          scanMode: this.scanMode
        },
        this.isConfigExpanded,
        languageMappings,
        this.existingI18nCalls,
        this.scanAllFiles,
        currentFilePath
      );

      // 更新面板内容
      this.panel.webview.html = html;
    } catch (error) {
      console.error('更新面板内容时出错:', error);
      vscode.window.showErrorMessage('更新面板内容时出错: ' + error.message);
    }
  }

  /**
   * 加载所有国际化键的翻译状态
   * @param {Array} languageMappings 语言映射配置
   */
  async loadI18nKeysStatus(languageMappings) {
    try {
      let searchKeys = [];
      if (this.scanMode === 'translated') {
        searchKeys = this.existingI18nCalls;
      } else if (this.scanMode === 'pending') {
        searchKeys = this.replacements;
      } else if (this.scanMode === 'all') {
        searchKeys = this.replacements.concat(this.existingI18nCalls);
      }
      
      // 委托给i18n键状态服务处理
      await this.i18nKeyStatusService.loadI18nKeysStatus(searchKeys, languageMappings);
    } catch (error) {
      console.error('加载国际化键状态时出错:', error);
    }
  }

  /**
   * 刷新面板
   * @param {string} currentFilter 当前的筛选值
   */
  async refreshPanel(currentFilter) {
    try {
      this.selectedIndexes = []; // 清空选中项
      
      // 根据当前扫描模式选择刷新方法
      if (this.scanAllFiles) {
        // 如果当前是扫描所有文件模式，则使用工作区扫描服务重新扫描
        await vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: "刷新工作区扫描结果...",
          cancellable: false
        }, async (progress) => {
          try {
            progress.report({ message: "重新扫描所有文件..." });
            
            // 使用分析现有i18n调用的绑定函数
            const analyzeExistingI18nCallsBound = this.analyzeExistingI18nCalls.bind(this);
            
            // 调用工作区扫描服务
            this.allFilesResults = await workspaceScannerService.scanAllWorkspaceFiles(
              analyzeExistingI18nCallsBound,
              progress
            );
            
            // 更新当前显示的结果
            this.replacements = this.allFilesResults.replacements;
            this.existingI18nCalls = this.allFilesResults.existingCalls;
            
            // 更新面板内容
            await this.updatePanelContent();
            
            // 如果有筛选值，恢复筛选状态
            if (currentFilter && this.panel) {
              // 延迟发送恢复筛选状态的消息，确保面板内容已更新
              setTimeout(() => {
                console.log(`恢复筛选状态: ${currentFilter}`);
                this.panel.webview.postMessage({
                  command: 'restoreFilterState',
                  data: {
                    filterValue: currentFilter
                  }
                });
              }, 200);
            }
          } catch (error) {
            console.error('刷新工作区文件时出错:', error);
            throw error;
          }
        });
        
        vscode.window.showInformationMessage(
          `刷新完成: 找到 ${this.allFilesResults.replacements.length} 个待转义项, ${this.allFilesResults.existingCalls.length} 个已转义项`
        );
      } else {
        // 如果是当前文件模式，则只刷新当前文件
        await this.analyzeAndLoadPanel();
      }
    } catch (error) {
      console.error('刷新面板时出错:', error);
      vscode.window.showErrorMessage(`刷新失败: ${error.message}`);
    }
  }

  /**
   * 选择可见项目
   * @param {Array<number>} visibleIndexes 可见项的索引数组
   * @param {boolean} isChecked 是否选中
   */
  selectVisibleItems(visibleIndexes, isChecked) {
    console.log('选择可见项目：', visibleIndexes, isChecked);
    
    // 更新选中状态
    if (this.scanMode === 'pending' || this.scanMode === 'all') {
      for (const index of visibleIndexes) {
        if (index >= 0 && index < this.replacements.length) {
          this.replacements[index].selected = isChecked;
        }
      }
    }
    
    if (this.scanMode === 'translated' || this.scanMode === 'all') {
      for (const index of visibleIndexes) {
        if (index >= 0 && index < this.existingI18nCalls.length) {
          this.existingI18nCalls[index].selected = isChecked;
        }
      }
    }
    
    // 更新面板
    this._updatePanel();
  }
  
  /**
   * 选择所有项目
   * @param {boolean} updatePanel 是否更新面板
   */
  selectAllItems(updatePanel = true) {
    console.log('选择所有项目');
    
    // 根据当前模式选择
    if (this.scanMode === 'pending' || this.scanMode === 'all') {
      this.replacements.forEach(item => {
        item.selected = true;
      });
    }
    
    if (this.scanMode === 'translated' || this.scanMode === 'all') {
      this.existingI18nCalls.forEach(item => {
        item.selected = true;
      });
    }
    
    // 更新面板
    if (updatePanel) {
      this._updatePanel();
    }
  }

  /**
   * 添加扫描模式
   */
  async addPattern(pattern) {
    if (!pattern) return;

    const config = vscode.workspace.getConfiguration('i18n-swapper');
    const scanPatterns = config.get('scanPatterns', defaultsConfig.scanPatterns);

    if (scanPatterns.includes(pattern)) {
      vscode.window.showInformationMessage(`模式 "${pattern}" 已存在`);
      return;
    }

    scanPatterns.push(pattern);
    await config.update('scanPatterns', scanPatterns, vscode.ConfigurationTarget.Workspace);

    // 刷新分析
    await this.analyzeAndLoadPanel();
  }

  /**
   * 移除扫描模式
   */
  async removePattern(pattern) {
    if (!pattern) return;

    const config = vscode.workspace.getConfiguration('i18n-swapper');
    let scanPatterns = config.get('scanPatterns', defaultsConfig.scanPatterns);

    scanPatterns = scanPatterns.filter(p => p !== pattern);
    await config.update('scanPatterns', scanPatterns, vscode.ConfigurationTarget.Workspace);

    // 刷新分析
    await this.analyzeAndLoadPanel();
  }

  /**
   * 选择国际化文件
   */
  async selectLocalesFiles() {
    try {
      // 获取工作区根目录
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        vscode.window.showErrorMessage('未找到工作区文件夹');
        return;
      }
      const rootPath = workspaceFolders[0].uri.fsPath;

      // 打开文件选择器
      const fileUris = await vscode.window.showOpenDialog({
        canSelectMany: true,
        filters: {
          '国际化文件': ['json', 'js']
        },
        title: '选择国际化文件'
      });

      if (!fileUris || fileUris.length === 0) {
        vscode.window.showInformationMessage('未选择任何文件');
        return;
      }

      // 更新配置
      const relativePaths = fileUris.map(uri => {
        const fullPath = uri.fsPath;
        const relativePath = path.relative(rootPath, fullPath);
        // 确保使用 / 分隔符
        return relativePath.replace(/\\/g, '/');
      });

      const config = vscode.workspace.getConfiguration('i18n-swapper');
      await config.update('localesPaths', relativePaths, vscode.ConfigurationTarget.Workspace);

      // 询问是否要添加更多语言文件
      const createMoreLangs = await vscode.window.showInformationMessage(
        '已添加国际化文件。是否要快速创建更多语言文件？',
        '创建',
        '取消'
      );

      if (createMoreLangs === '创建') {
        await this.showLanguageSelector();
      }

      // 刷新分析
      await this.analyzeAndLoadPanel();
    } catch (error) {
      console.error('选择国际化文件出错:', error);
      vscode.window.showErrorMessage(`选择国际化文件失败: ${error.message}`);
    }
  }

  /**
   * 显示语言选择器对话框
   */
  async showLanguageSelector() {
    await createOrSelectLanguageFiles();
    // 刷新分析
    await this.analyzeAndLoadPanel();
  }

  /**
   * 更新项的国际化键
   * @param {number} index 项索引
   * @param {string} key 国际化键
   */
  updateI18nKey(index, key) {
    if (index < 0 || index >= this.replacements.length) return;

    console.log(`更新项 ${index} 的键为: ${key}`);
    this.replacements[index].i18nKey = key;
  }

  /**
   * 切换项的选中状态
   * @param {number} index 项索引
   * @param {boolean} selected 是否选中
   */
  toggleItemSelection(index, selected) {
    // 根据当前模式获取正确的数据源
    let item;
    if (this.scanMode === 'pending') {
      item = this.replacements[index];
    } else if (this.scanMode === 'translated') {
      item = this.existingI18nCalls[index];
    } else if (this.scanMode === 'all') {
      // 合并数组
      const allItems = [
        ...this.replacements,
        ...this.existingI18nCalls
      ];
      item = allItems[index];
    }

    if (item) {
      console.log(`切换项目 #${index} 的选择状态为: ${selected}`);
      // 确保每个项目都有一个索引字段
      item.index = index;
      item.selected = selected;

      // 更新选中索引列表
      if (selected) {
        if (!this.selectedIndexes.includes(index)) {
          this.selectedIndexes.push(index);
        }
      } else {
        this.selectedIndexes = this.selectedIndexes.filter(i => i !== index);
      }
    }
  }

  /**
   * 执行选中项替换
   */
  async performSelectedReplacements(selectedIndexes) {
    try {
      console.log('执行选中项替换，索引:', selectedIndexes);
      
      // 如果提供了索引数组，使用它；否则使用所有选中项
      const indexesToReplace = selectedIndexes || this.getSelectedIndexes();
      
      // 使用可见项替换方法执行替换
      return await this.performVisibleReplacements(indexesToReplace);
    } catch (error) {
      console.error('执行选中项替换时出错:', error);
      vscode.window.showErrorMessage(`替换失败: ${error.message}`);
    }
  }
  
  /**
   * 获取所有选中项的索引
   * @returns {Array<number>} 选中项的索引数组
   */
  getSelectedIndexes() {
    const selectedIndexes = [];
    
    // 根据当前扫描模式获取正确的数据源
    if (this.scanMode === 'pending') {
      this.replacements.forEach((item, index) => {
        if (item.selected) {
          selectedIndexes.push(index);
        }
      });
    } else if (this.scanMode === 'translated') {
      this.existingI18nCalls.forEach((item, index) => {
        if (item.selected) {
          selectedIndexes.push(index);
        }
      });
    } else if (this.scanMode === 'all') {
      // 扫描所有项目
      const allItems = [
        ...this.replacements,
        ...this.existingI18nCalls
      ];
      
      allItems.forEach((item, index) => {
        if (item.selected) {
          selectedIndexes.push(index);
        }
      });
    }
    
    return selectedIndexes;
  }

  /**
   * 执行所有替换
   */
  async performAllReplacements() {
    try {
      // 检查是否是扫描所有文件模式
      if (this.scanAllFiles) {
        return await this._performMultiFileReplacements();
      } else {
        return await this._performSingleFileReplacements();
      }
    } catch (error) {
      console.error('执行替换所有项时出错:', error);
      vscode.window.showErrorMessage(`替换失败: ${error.message}`);
    }
  }

  /**
   * 在扫描所有文件模式下执行多文件替换
   * @private
   */
  async _performMultiFileReplacements() {
    try {
      // 获取所有有国际化键的项目（不依赖用户选择）
      let allItems = [];
      if (this.scanMode === 'translated') {
        allItems = this.existingI18nCalls.filter(item => item.i18nKey && item.text);
      } else if (this.scanMode === 'pending') {
        allItems = this.replacements.filter(item => item.i18nKey && item.text);
      } else if (this.scanMode === 'all') {
        allItems = [
          ...this.replacements.filter(item => item.i18nKey && item.text),
          ...this.existingI18nCalls.filter(item => item.i18nKey && item.text)
        ];
      }

      if (allItems.length === 0) {
        vscode.window.showInformationMessage('没有可替换的项目，请确保至少一个项目有国际化键');
        return;
      }

      // 创建编辑操作
      const workspaceEdit = new vscode.WorkspaceEdit();
      let totalItems = 0;

      // 获取工作区根目录
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        throw new Error('未找到工作区文件夹');
      }
      const rootPath = workspaceFolders[0].uri.fsPath;

      // 按文件分组处理替换项
      const itemsByFile = {};
      allItems.forEach(item => {
        // 确保文件路径存在
        if (!item.filePath) {
          // 如果没有文件路径，使用当前文档的路径
          if (this.document) {
            item.filePath = this.document.uri.fsPath;
          } else {
            console.warn('项目缺少文件路径且没有当前文档');
            return;
          }
        }
        
        // 规范化文件路径
        let filePath = item.filePath;
        if (!path.isAbsolute(filePath)) {
          filePath = path.join(rootPath, filePath);
        }
        
        if (!itemsByFile[filePath]) {
          itemsByFile[filePath] = [];
        }
        itemsByFile[filePath].push(item);
      });

      // 处理每个文件的替换
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "执行批量替换...",
        cancellable: false
      }, async (progress) => {
        let processedFiles = 0;
        const totalFiles = Object.keys(itemsByFile).length;
        
        // 处理每个文件的替换
        for (const [filePath, fileItems] of Object.entries(itemsByFile)) {
          try {
            progress.report({
              message: `处理文件 ${processedFiles + 1}/${totalFiles}...`,
              increment: 100 / totalFiles
            });
            
            console.log(`处理文件: ${filePath}`);
            
            if (!fs.existsSync(filePath)) {
              throw new Error(`文件不存在: ${filePath}`);
            }
            
            // 获取文件内容
            const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
            
            // 从后向前替换，避免位置变化
            fileItems.sort((a, b) => b.start - a.start);
            
            // 获取配置
            const config = vscode.workspace.getConfiguration('i18n-swapper');
            const functionName = config.get('functionName', 't');
            const quoteType = config.get('quoteType', 'single');
            const quote = quoteType === 'single' ? "'" : '"';
            
            // 处理每个替换项
            for (const item of fileItems) {
              if (!item.i18nKey) continue;
              
              // 获取位置信息
              const position = document.positionAt(item.start);
              
              // 使用统一的replaceFn方法处理替换逻辑
              const replacementResult = utils.replaceFn(
                item.text,
                item.i18nKey,
                functionName,
                quote,
                document,
                position
              );
              
              // 使用返回的范围和替换文本
              workspaceEdit.replace(
                document.uri,
                replacementResult.isVueAttr ? replacementResult.range : new vscode.Range(
                  document.positionAt(item.start),
                  document.positionAt(item.end)
                ),
                replacementResult.replacementText
              );
              
              totalItems++;
            }
            
            processedFiles++;
          } catch (error) {
            console.error(`处理文件 ${filePath} 时出错:`, error);
            vscode.window.showErrorMessage(`处理文件 ${filePath} 时出错: ${error.message}`);
          }
        }
      });

      // 执行所有替换
      const success = await vscode.workspace.applyEdit(workspaceEdit);

      // 显示结果
      if (success) {
        vscode.window.showInformationMessage(`已替换 ${totalItems} 处文本`);

        // 更新面板显示
        if (this.panel) {
          this.panel.webview.postMessage({
            command: 'replacementComplete',
            count: totalItems
          });
        }
        
        // 刷新面板
        await this.refreshPanel();
      } else {
        vscode.window.showErrorMessage('批量替换失败');
      }
    } catch (error) {
      console.error('执行多文件替换时出错:', error);
      vscode.window.showErrorMessage(`替换失败: ${error.message}`);
    }
  }

  /**
   * 在当前文件模式下执行单文件替换
   * @private
   */
  async _performSingleFileReplacements() {
    // 检查文档
    if (!this.document) {
      vscode.window.showWarningMessage('找不到文档，请重新打开面板');
      return;
    }

    // 获取所有有国际化键的替换项
    const validItems = this.replacements.filter(item => item.i18nKey);

    if (validItems.length === 0) {
      vscode.window.showInformationMessage('没有有效的替换项，请确保至少一个项目有国际化键');
      return;
    }

    // 显示进度条
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: "执行所有项替换...",
      cancellable: false
    }, async (progress) => {
      // 创建工作区编辑对象
      const workspaceEdit = new vscode.WorkspaceEdit();
      const totalItems = validItems.length;
      const document = this.document;
      
      if (!document) {
        throw new Error('未找到关联的文档');
      }
      
      // 处理每个替换项
      for (let i = 0; i < totalItems; i++) {
        const item = validItems[i];
        
        // 更新进度
        progress.report({
          message: `替换第 ${i+1}/${totalItems} 项...`,
          increment: 100 / totalItems
        });
        
        // 获取配置
        const config = vscode.workspace.getConfiguration('i18n-swapper');
        const configQuoteType = config.get('quoteType', 'single');
        const functionName = config.get('functionName', 't');
        const codeQuote = configQuoteType === 'single' ? "'" : '"';
        
        // 使用统一的replaceFn方法处理替换逻辑
        const position = document.positionAt(item.start);
        const replacementResult = utils.replaceFn(
          item.text,
          item.i18nKey,
          functionName,
          codeQuote,
          document,
          position
        );
        
        // 使用返回的范围和替换文本
        workspaceEdit.replace(
          document.uri, 
          replacementResult.isVueAttr ? replacementResult.range : new vscode.Range(
            document.positionAt(item.start),
            document.positionAt(item.end)
          ), 
          replacementResult.replacementText
        );
      }

      // 执行所有替换
      const success = await vscode.workspace.applyEdit(workspaceEdit);

      // 显示结果
      if (success) {
        vscode.window.showInformationMessage(`已替换 ${totalItems} 处文本`);

        // 更新面板显示
        if (this.panel) {
          this.panel.webview.postMessage({
            command: 'replacementComplete',
            count: totalItems
          });
        }
        
        // 重新分析文档
        await this.analyzeAndLoadPanel();
      } else {
        vscode.window.showErrorMessage('批量替换失败');
      }
    });
  }

  /**
   * 翻译指定项并生成键
   * @param {number} index 替换项索引
   * @param {string} userInputKey 用户输入的键名
   */
  async translateItem(index, userInputKey = '') {
    let replacementsKeys = [];
    if (this.scanMode === 'translated') {
      replacementsKeys = this.existingI18nCalls
    } else if (this.scanMode === 'pending') {
      replacementsKeys = this.replacements
    } else if (this.scanMode === 'all') {
      replacementsKeys = this.replacements.concat(this.existingI18nCalls);
    }

    if (index < 0 || index >= replacementsKeys.length) return;

    const item = replacementsKeys[index];
    if (!item.text) {
      item.text = await vscode.window.showInputBox({
        prompt: '请输入要翻译的文本',
        placeHolder: '无法识别此处文本，请手动输入',
        validateInput: input => {
          return input && input.trim() !== '' ? null : '文本不能为空';
        }
      });

      // 如果用户取消输入，则终止流程
      if (!item.text) {
        return null; // 返回 null 表示操作被取消
      }
    }
    if (!item || !item.text) return;

    try {
      console.log(`面板翻译项：索引=${index}, 文本="${item.text}", 用户键="${userInputKey}"`);

      // 获取配置
      const config = vscode.workspace.getConfiguration('i18n-swapper');
      const apiKey = config.get('tencentTranslation.apiKey', '');
      const apiSecret = config.get('tencentTranslation.apiSecret', '');
      const region = config.get('tencentTranslation.region', 'ap-guangzhou');
      const sourceLanguage = config.get('tencentTranslation.sourceLanguage', 'zh');
      const languageMappings = config.get('tencentTranslation.languageMappings', []);

      // 生成或使用提供的键名
      let suggestedKey = userInputKey || '';

      // 如果没有输入键名，则自动生成
      if (!suggestedKey) {
        const {
          generateKeyFromTranslation
        } = require('../services/translationService');

        // 检查是否配置了自动翻译生成
        const autoGenerateKeyFromText = config.get('autoGenerateKeyFromText', defaultsConfig.autoGenerateKeyFromText);
        if (autoGenerateKeyFromText) {
          // 使用翻译服务生成键名
          suggestedKey = await generateKeyFromTranslation(item.text);
        } else {
          // 使用简单哈希生成
          suggestedKey = generateKeyFromText(item.text);
        }
      }

      // 保存到所有语言文件
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) throw new Error('未找到工作区');
      const rootPath = workspaceFolders[0].uri.fsPath;

      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: '翻译中...'
      }, async (progress) => {
        for (const mapping of languageMappings) {
          progress.report({
            message: `翻译为 ${getLanguageName(mapping.languageCode)}...`
          });

          if (mapping.languageCode === sourceLanguage) {
            // 源语言直接使用原文
            await saveTranslationToFile(path.join(rootPath, mapping.filePath), suggestedKey, item.text);
          } else {
            // 其他语言调用翻译API
            const translatedText = await translateText(
              item.text,
              sourceLanguage,
              mapping.languageCode,
              apiKey,
              apiSecret,
              region
            );
            await saveTranslationToFile(path.join(rootPath, mapping.filePath), suggestedKey, translatedText);
          }
        }
      });

      // 更新项的键值
      item.i18nKey = suggestedKey;

      // 更新面板内容
      await this.updatePanelContent();
    } catch (error) {
      console.error('[翻译严重错误]:', error);
      vscode.window.showErrorMessage(`翻译失败: ${error.message}`);
    }
  }

  /**
   * 打开API翻译配置面板
   */
  async openApiTranslationConfig() {
    try {
      // 调用命令打开API翻译配置面板
      await vscode.commands.executeCommand('i18n-swapper.openApiTranslationConfig');
    } catch (error) {
      console.error('打开API翻译配置面板出错:', error);
      vscode.window.showErrorMessage(`打开配置面板失败: ${error.message}`);
    }
  }

  /**
   * 添加扫描模式
   */
  async addScanPattern(pattern) {
    if (!pattern) return;

    try {
      // 获取当前配置
      const config = vscode.workspace.getConfiguration('i18n-swapper');
      const scanPatterns = config.get('scanPatterns', defaultsConfig.scanPatterns);

      // 防止重复添加
      if (scanPatterns.includes(pattern)) {
        vscode.window.showInformationMessage(`模式 "${pattern}" 已存在`);
        return;
      }

      // 添加新模式
      scanPatterns.push(pattern);
      await config.update('scanPatterns', scanPatterns, vscode.ConfigurationTarget.Workspace);

      // 刷新面板
      await this.refreshPanel();

      vscode.window.showInformationMessage(`已添加扫描模式: ${pattern}`);
    } catch (error) {
      console.error('添加扫描模式出错:', error);
      throw error;
    }
  }

  /**
   * 移除扫描模式
   */
  async removeScanPattern(pattern) {
    if (!pattern) return;

    try {
      // 获取当前配置
      const config = vscode.workspace.getConfiguration('i18n-swapper');
      let scanPatterns = config.get('scanPatterns', defaultsConfig.scanPatterns);

      // 移除指定模式
      scanPatterns = scanPatterns.filter(p => p !== pattern);
      await config.update('scanPatterns', scanPatterns, vscode.ConfigurationTarget.Workspace);

      // 刷新面板
      await this.refreshPanel();

      vscode.window.showInformationMessage(`已移除扫描模式: ${pattern}`);
    } catch (error) {
      console.error('移除扫描模式出错:', error);
      throw error;
    }
  }

  /**
   * 选择国际化文件
   */
  async selectLocaleFile() {
    try {
      // 打开文件选择对话框
      const fileUris = await vscode.window.showOpenDialog({
        canSelectMany: true,
        openLabel: '选择国际化文件',
        filters: {
          '所有文件': ['*'],
          'JSON文件': ['json'],
          'JavaScript文件': ['js']
        }
      });

      if (!fileUris || fileUris.length === 0) {
        return; // 用户取消了选择
      }

      // 获取当前配置
      const config = vscode.workspace.getConfiguration('i18n-swapper');
      let localesPaths = config.get('localesPaths', defaultsConfig.localesPaths);

      // 获取工作区路径作为基准，以便存储相对路径
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        throw new Error('未找到工作区文件夹');
      }
      const rootPath = workspaceFolders[0].uri.fsPath;

      // 将选择的文件路径转换为相对于工作区的路径
      const newPaths = fileUris.map(uri => {
        const absolutePath = uri.fsPath;
        return this.getRelativePath(absolutePath);
      });

      if (newPaths.length > 0) {
        // 合并并去重
        const uniquePaths = [...new Set([...localesPaths, ...newPaths])];
        await config.update('localesPaths', uniquePaths, vscode.ConfigurationTarget.Workspace);

        // 刷新面板
        await this.refreshPanel();

        vscode.window.showInformationMessage(`已添加 ${newPaths.length} 个国际化文件`);
      }
    } catch (error) {
      console.error('选择国际化文件出错:', error);
      throw error;
    }
  }

  /**
   * 移除国际化文件路径
   */
  async removeLocalePath(path) {
    if (!path) return;

    try {
      // 获取当前配置
      const config = vscode.workspace.getConfiguration('i18n-swapper');
      let localesPaths = config.get('localesPaths', defaultsConfig.localesPaths);

      // 移除指定路径
      localesPaths = localesPaths.filter(p => p !== path);
      await config.update('localesPaths', localesPaths, vscode.ConfigurationTarget.Workspace);

      // 刷新面板
      await this.refreshPanel();

      vscode.window.showInformationMessage(`已移除国际化文件路径: ${path}`);
    } catch (error) {
      console.error('移除国际化文件路径出错:', error);
      throw error;
    }
  }

  /**
   * 切换扫描模式
   * @param {string} mode 扫描模式 'pending'|'translated'|'all'
   * @param {string} currentFilter 当前的筛选值
   */
  async switchScanMode(mode, currentFilter) {
    if (this.scanMode === mode) return;
    
    console.log(`切换扫描模式: ${this.scanMode} -> ${mode}，当前筛选值: ${currentFilter || '无'}`);

    this.scanMode = mode;
    this.selectedIndexes = []; // 切换模式时清空选择

    // 更新面板内容
    await this.updatePanelContent();
    
    // 如果有筛选值，恢复筛选状态
    if (currentFilter && this.panel) {
      // 延迟发送恢复筛选状态的消息，确保面板内容已更新
      setTimeout(() => {
        console.log(`恢复筛选状态: ${currentFilter}`);
        this.panel.webview.postMessage({
          command: 'restoreFilterState',
          data: {
            filterValue: currentFilter
          }
        });
      }, 200);
    }
  }

  /**
   * 打开国际化键对应的文件
   * @param {number} index 项目索引
   */
  async openI18nFile(index) {
    try {
      // 根据当前模式获取正确的数据源
      let item;
      if (this.scanMode === 'pending') {
        item = this.replacements[index];
      } else if (this.scanMode === 'translated') {
        item = this.existingI18nCalls[index];
      } else if (this.scanMode === 'all') {
        // 合并数组
        const allItems = [
          ...this.replacements.map(item => ({
            ...item,
            itemType: 'pending'
          })),
          ...this.existingI18nCalls.map(item => ({
            ...item,
            itemType: 'translated'
          }))
        ];
        item = allItems[index];
      }

      if (!item || !item.i18nKey || !item.i18nFile) {
        vscode.window.showInformationMessage('没有可打开的文件信息');
        return;
      }

      // 执行打开文件命令，指定在第一个窗口打开
      await vscode.commands.executeCommand('i18n-swapper.openLanguageFile', {
        filePath: item.i18nFile,
        langCode: 'unknown',
        i18nKey: item.i18nKey,
        shouldLocateKey: true,
        viewColumn: vscode.ViewColumn.One // 添加这一行
      });
    } catch (error) {
      console.error('打开国际化文件时出错:', error);
      vscode.window.showErrorMessage(`打开文件失败: ${error.message}`);
    }
  }

  /**
   * 复制国际化键到剪贴板
   * @param {number} index 项目索引
   */
  async copyI18nKey(index) {
    try {
      // 根据当前模式获取正确的数据源
      let item;
      if (this.scanMode === 'pending') {
        item = this.replacements[index];
      } else if (this.scanMode === 'translated') {
        item = this.existingI18nCalls[index];
      } else if (this.scanMode === 'all') {
        // 合并数组
        const allItems = [
          ...this.replacements.map(item => ({
            ...item,
            itemType: 'pending'
          })),
          ...this.existingI18nCalls.map(item => ({
            ...item,
            itemType: 'translated'
          }))
        ];
        item = allItems[index];
      }

      if (!item || !item.i18nKey) {
        vscode.window.showInformationMessage('没有可复制的国际化键');
        return;
      }

      // 复制到剪贴板
      await vscode.env.clipboard.writeText(item.i18nKey);
      vscode.window.showInformationMessage(`已复制键 "${item.i18nKey}" 到剪贴板`);
    } catch (error) {
      console.error('复制国际化键时出错:', error);
      vscode.window.showErrorMessage(`复制失败: ${error.message}`);
    }
  }

  /**
   * 刷新扫描
   */
  async refreshScan() {
    try {
      // 清空当前数据
      this.replacements = [];
      this.existingI18nCalls = [];
      this.selectedIndexes = [];

      // 重新分析文档
      await this.analyzeAndLoadPanel();

      // 显示成功消息
      vscode.window.showInformationMessage('已刷新扫描结果');
    } catch (error) {
      console.error('刷新扫描时出错:', error);
      vscode.window.showErrorMessage(`刷新扫描失败: ${error.message}`);
    }
  }

  /**
   * 切换全选/取消全选
   */
  async toggleSelectAll() {
    try {
      // 获取当前显示的项目
      let currentItems = [];
      if (this.scanMode === 'pending') {
        currentItems = this.replacements;
      } else if (this.scanMode === 'translated') {
        currentItems = this.existingI18nCalls;
      } else if (this.scanMode === 'all') {
        // 合并两个列表，并添加类型标记
        currentItems = [
          ...this.replacements.map(item => ({
            ...item,
            itemType: 'pending'
          })),
          ...this.existingI18nCalls.map(item => ({
            ...item,
            itemType: 'translated'
          }))
        ];
      }

      // 检查是否所有项目都已选中
      const allSelected = currentItems.every(item => item.selected);

      // 切换选择状态
      if (allSelected) {
        // 如果全部已选中，则取消全选
        currentItems.forEach(item => {
          item.selected = false;
        });
        this.selectedIndexes = [];
      } else {
        // 如果未全选，则全选
        currentItems.forEach((item, index) => {
          item.selected = true;
        });
        
        // 更新选中索引
        this.selectedIndexes = Array.from({ length: currentItems.length }, (_, index) => index);
      }

      // 强制更新面板状态，保持一致性
      this.panel?.webview.postMessage({
        command: 'updateSelectionInUI',
        selectedIndexes: this.selectedIndexes,
        selectAll: !allSelected
      });
      
      // 延迟更新面板内容，确保状态先被更新
      setTimeout(async () => {
        await this.updatePanelContent();
      }, 100);
    } catch (error) {
      console.error('切换全选状态时出错:', error);
      vscode.window.showErrorMessage(`操作失败: ${error.message}`);
    }
  }

  /**
   * 应用所有替换
   */
  async applyAllReplacements() {
    try {
      // 这里应该使用confirmAllReplacements命令而不是applyAllReplacements
      await vscode.commands.executeCommand('i18n-swapper.confirmAllReplacements');
      // 替换成功后可能需要刷新或关闭面板
      this.panel.dispose();
    } catch (error) {
      console.error('应用所有替换时出错:', error);
      vscode.window.showErrorMessage(`应用替换失败: ${error.message}`);
    }
  }

  /**
   * 获取所有选中的项目
   * @returns {Array} 选中的项目数组
   */
  getSelectedItems() {
    let selectedItems = [];

    // 根据当前扫描模式获取正确的数据源
    if (this.scanMode === 'translated') {
      selectedItems = this.existingI18nCalls.filter((item, index) => 
        item.selected && item.i18nKey
      );
    } else if (this.scanMode === 'pending') {
      selectedItems = this.replacements.filter((item, index) => 
        item.selected && item.i18nKey
      );
    } else if (this.scanMode === 'all') {
      // 合并两个列表
      selectedItems = [
        ...this.replacements.filter(item => item.selected && item.i18nKey),
        ...this.existingI18nCalls.filter(item => item.selected && item.i18nKey)
      ];
    }

    console.log(`找到 ${selectedItems.length} 个选中项`);

    if (selectedItems.length === 0 && this.selectedIndexes.length > 0) {
      // 如果没有选中项但selectedIndexes不为空，说明可能是全选刚被点击
      // 重新尝试获取选中项
      if (this.scanMode === 'translated') {
        selectedItems = this.existingI18nCalls.filter((item, index) => 
          this.selectedIndexes.includes(index) && item.i18nKey
        );
      } else if (this.scanMode === 'pending') {
        selectedItems = this.replacements.filter((item, index) => 
          this.selectedIndexes.includes(index) && item.i18nKey
        );
      } else if (this.scanMode === 'all') {
        // 合并两个列表
        const allItems = [...this.replacements, ...this.existingI18nCalls];
        selectedItems = allItems.filter((item, index) => 
          this.selectedIndexes.includes(index) && item.i18nKey
        );
      }
      
      console.log(`尝试通过索引找到 ${selectedItems.length} 个选中项`);
    }

    // 如果都没找到选中项，但我们有选择索引，尝试获取所有有键的项目
    if (selectedItems.length === 0 && this.selectedIndexes.length > 0) {
      if (this.scanMode === 'translated') {
        selectedItems = this.existingI18nCalls.filter(item => item.i18nKey);
      } else if (this.scanMode === 'pending') {
        selectedItems = this.replacements.filter(item => item.i18nKey);
      } else if (this.scanMode === 'all') {
        selectedItems = [
          ...this.replacements.filter(item => item.i18nKey),
          ...this.existingI18nCalls.filter(item => item.i18nKey)
        ];
      }
      
      console.log(`全选模式下找到 ${selectedItems.length} 个项目`);
    }
    
    return selectedItems;
  }

  // 添加一个方法来加载配置
  _loadConfiguration() {
    const config = vscode.workspace.getConfiguration('i18n-swapper');

    // 加载翻译相关配置
    this.autoGenerateKeyFromText = config.get('autoGenerateKeyFromText', true);
    this.autoGenerateKeyPrefix = config.get('autoGenerateKeyPrefix', '_iw');
    this.autoTranslateAllLanguages = config.get('autoTranslateAllLanguages', true);

    // 其他配置...
  }

  /**
   * 高亮显示源文本
   * @param {number} start 开始位置
   * @param {number} end 结束位置
   * @param {number} index 项目索引
   * @param {string} filePath 文件路径
   */
  async highlightSourceText(start, end, index, filePath) {
    try {
      // 如果提供了文件路径，先打开该文件
      let document;
      if (filePath) {
        // 获取工作区根目录
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
          throw new Error('未找到工作区文件夹');
        }
        const rootPath = workspaceFolders[0].uri.fsPath;

        // 构建完整的文件路径
        const fullPath = path.isAbsolute(filePath) ? filePath : path.join(rootPath, filePath);
        
        // 检查文件是否存在
        if (!fs.existsSync(fullPath)) {
          throw new Error(`文件不存在: ${filePath}`);
        }

        const uri = vscode.Uri.file(fullPath);
        document = await vscode.workspace.openTextDocument(uri);
        
        // 在第一个窗口中打开文件
        await vscode.window.showTextDocument(document, {
          viewColumn: vscode.ViewColumn.One, // 指定在第一个窗口打开
          preserveFocus: true, // 保持面板的焦点
          preview: false // 在新标签页打开
        });
      } else {
        document = this.document;
      }

      // 使用高亮服务高亮文本
      if (document) {
        await this.highlightService.highlightSourceText(document, start, end);
      }
    } catch (error) {
      console.error('高亮源文本时出错:', error);
      vscode.window.showErrorMessage(`高亮文本失败: ${error.message}`);
    }
  }

  /**
   * 替换单个项目
   * @param {number} index 项目索引
   */
  async replaceSingleItem(data) {
    try {
      const index = data.index;
      
      // 获取正确的数据源
      let items = [];
      if (this.scanMode === 'pending') {
        items = this.replacements;
      } else if (this.scanMode === 'translated') {
        items = this.existingI18nCalls;
      } else if (this.scanMode === 'all') {
        items = [...this.replacements, ...this.existingI18nCalls];
      }
      
      // 检查索引是否有效
      if (index < 0 || index >= items.length) {
        vscode.window.showWarningMessage('无效的项目索引');
        return;
      }
      
      const item = items[index];
      
      // 检查项目是否有国际化键
      if (!item.i18nKey) {
        vscode.window.showWarningMessage('无法替换：该项目没有国际化键');
        return;
      }
      
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: '正在替换项目...',
        cancellable: false
      }, async (progress) => {
        // 获取配置
        const config = vscode.workspace.getConfiguration('i18n-swapper');
        const functionName = config.get('functionName', 't');
        const quoteType = config.get('quoteType', 'single');
        const quote = quoteType === 'single' ? "'" : '"';
        
        // 确定要编辑的文档
        let document;
        let editor;
        
        if (this.scanAllFiles && item.fileUri) {
          // 在日志中使用相对路径
          const relativePath = this.getRelativePath(item.fileUri.fsPath);
          console.log(`打开文件进行替换: ${relativePath}`);
          
          // 正常使用 URI 打开文档，但在第一个窗口中
          document = await vscode.workspace.openTextDocument(item.fileUri);
          editor = await vscode.window.showTextDocument(document, {
            viewColumn: vscode.ViewColumn.One // 指定在第一个窗口打开
          });
        } else {
          // 使用当前文档
          document = this.document;
          if (!document) {
            throw new Error('未找到关联的文档');
          }
          
          editor = vscode.window.visibleTextEditors.find(
            e => e.document.uri.toString() === document.uri.toString()
          );
        }
        
        if (!editor) {
          throw new Error('未找到关联的编辑器');
        }
        
        progress.report({
          message: '正在替换...'
        });
        
        // 创建编辑对象
        await editor.edit(editBuilder => {
          const position = document.positionAt(item.start);
          const replacementResult = utils.replaceFn(
            item.text,
            item.i18nKey,
            functionName,
            quote,
            document,
            position
          );
          
          // 使用返回的范围和替换文本
          editBuilder.replace(
            replacementResult.isVueAttr ? replacementResult.range : new vscode.Range(
              document.positionAt(item.start),
              document.positionAt(item.end)
            ),
            replacementResult.replacementText
          );
        });
        
        // 重新分析文档，更新所有项目的位置信息
        if (this.scanAllFiles) {
          // 简单刷新当前项目，而不是重新扫描整个工作区
          item.replaced = true;
          await this.updatePanelContent();
        } else {
          await this.analyzeAndLoadPanel();
        }
        
        vscode.window.showInformationMessage('项目替换成功');
      });
    } catch (error) {
      console.error('替换单个项目出错:', error);
      vscode.window.showErrorMessage(`替换失败: ${error.message}`);
    }
  }

  /**
   * 添加国际化函数名
   * @param {string} name 函数名
   */
  async addI18nFunctionName(name) {
    try {
      // 获取当前配置
      const config = vscode.workspace.getConfiguration('i18n-swapper');
      const functionNames = config.get('IdentifyTheCurrentName', defaultsConfig.IdentifyTheCurrentName);

      // 检查是否已存在
      if (functionNames.includes(name)) {
        vscode.window.showInformationMessage(`函数名 ${name} 已存在`);
        return;
      }

      // 添加新函数名
      functionNames.push(name);

      // 更新配置
      await config.update('IdentifyTheCurrentName', functionNames, vscode.ConfigurationTarget.Workspace);

      // 刷新面板
      await this.refreshPanel();

      vscode.window.showInformationMessage(`已添加国际化函数名: ${name}`);
    } catch (error) {
      console.error('添加国际化函数名出错:', error);
      vscode.window.showErrorMessage(`添加函数名失败: ${error.message}`);
    }
  }

  /**
   * 删除国际化函数名
   * @param {string} name 函数名
   */
  async removeI18nFunctionName(name) {
    try {
      // 获取当前配置
      const config = vscode.workspace.getConfiguration('i18n-swapper');
      let functionNames = config.get('IdentifyTheCurrentName', defaultsConfig.IdentifyTheCurrentName);

      // 过滤掉要删除的函数名
      functionNames = functionNames.filter(fn => fn !== name);

      // 更新配置
      await config.update('IdentifyTheCurrentName', functionNames, vscode.ConfigurationTarget.Workspace);

      // 刷新面板
      await this.refreshPanel();

      vscode.window.showInformationMessage(`已删除国际化函数名: ${name}`);
    } catch (error) {
      console.error('删除国际化函数名出错:', error);
      vscode.window.showErrorMessage(`删除函数名失败: ${error.message}`);
    }
  }

  /**
   * 检查单个国际化键在各语言中的状态
   * @param {number} index 项的索引
   * @param {string} key 要检查的国际化键
   */
  async checkI18nKeyStatus(index, key) {
    if (index < 0 || index >= this.replacements.length || !key) return;

    try {
      // 获取语言映射配置
      const config = vscode.workspace.getConfiguration('i18n-swapper');
      const languageMappings = config.get('tencentTranslation.languageMappings', defaultsConfig.tencentTranslation.languageMappings);

      if (!languageMappings || languageMappings.length === 0) return;

      // 委托给i18n键状态服务处理
      const status = await this.i18nKeyStatusService.checkI18nKeyStatus(
        this.replacements[index], 
        key,
        languageMappings
      );

      // 将更新的状态发送回面板
      if (this.panel) {
        this.panel.webview.postMessage({
          command: 'updateI18nKeyStatus',
          data: {
            index,
            status,
            key
          }
        });
      }
    } catch (error) {
      console.error('检查国际化键状态时出错:', error);
    }
  }

  /**
   * 打开语言文件并定位到指定的键
   * @param {string} filePath 文件路径
   * @param {string} key 国际化键
   * @param {string} languageCode 语言代码
   */
  async openLanguageFile(filePath, key, languageCode) {
    // 修改为在第一个窗口打开
    await this.i18nKeyStatusService.openLanguageFile(
      filePath, 
      key, 
      languageCode,
      vscode.ViewColumn.One // 指定在第一个窗口打开
    );
  }

  // 添加排除模式
  async addExcludePattern(pattern) {
    const config = vscode.workspace.getConfiguration('i18n-swapper');
    const excludeFiles = config.get('excludeFiles', defaultsConfig.excludeFiles);
    
    if (!excludeFiles.includes(pattern)) {
      excludeFiles.push(pattern);
      await config.update('excludeFiles', excludeFiles, vscode.ConfigurationTarget.Workspace);
      this.refreshPanel();
    }
  }

  // 删除排除模式
  async removeExcludePattern(pattern) {
    const config = vscode.workspace.getConfiguration('i18n-swapper');
    let excludeFiles = config.get('excludeFiles', defaultsConfig.excludeFiles);
    
    excludeFiles = excludeFiles.filter(p => p !== pattern);
    await config.update('excludeFiles', excludeFiles, vscode.ConfigurationTarget.Workspace);
    this.refreshPanel();
  }
  
  // 添加包含文件或文件夹
  async addIncludePattern(pattern) {
    const config = vscode.workspace.getConfiguration('i18n-swapper');
    const includeFiles = config.get('includeFiles', defaultsConfig.includeFiles);
    
    if (!includeFiles.includes(pattern)) {
      includeFiles.push(pattern);
      await config.update('includeFiles', includeFiles, vscode.ConfigurationTarget.Workspace);
      this.refreshPanel();
    }
  }

  // 删除包含文件或文件夹
  async removeIncludePattern(pattern) {
    const config = vscode.workspace.getConfiguration('i18n-swapper');
    let includeFiles = config.get('includeFiles', defaultsConfig.includeFiles);
    
    includeFiles = includeFiles.filter(p => p !== pattern);
    await config.update('includeFiles', includeFiles, vscode.ConfigurationTarget.Workspace);
    this.refreshPanel();
  }
  
  /**
   * 获取相对路径
   * @param {string} absolutePath 绝对路径
   * @returns {string} 相对于工作区的路径
   */
  getRelativePath(absolutePath) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return absolutePath;
    
    const rootPath = workspaceFolder.uri.fsPath;
    
    // 确保路径使用一致的路径分隔符
    const normalizedAbsolutePath = absolutePath.replace(/\\/g, '/');
    const normalizedRootPath = rootPath.replace(/\\/g, '/');
    
    if (normalizedAbsolutePath.startsWith(normalizedRootPath)) {
      // 去除开头的斜杠，保持相对路径格式
      const relativePath = normalizedAbsolutePath.substring(normalizedRootPath.length);
      return relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;
    }
    
    return absolutePath;
  }
  
  /**
   * 选择要包含的文件或文件夹
   * @param {boolean} folderOnly 是否只选择文件夹
   */
  async selectIncludeFile(folderOnly = false) {
    try {
      // 创建打开文件对话框选项
      const options = {
        canSelectFiles: !folderOnly,
        canSelectFolders: folderOnly,
        canSelectMany: true,
        openLabel: folderOnly ? '选择要包含的文件夹' : '选择要包含的文件',
        filters: {
          '所有文件': ['*']
        }
      };
      
      // 显示文件选择对话框
      const uris = await vscode.window.showOpenDialog(options);
      
      if (uris && uris.length > 0) {
        // 获取当前配置
        const config = vscode.workspace.getConfiguration('i18n-swapper');
        const includeFiles = config.get('includeFiles', defaultsConfig.includeFiles);
        const updatedIncludeFiles = [...includeFiles]; // 创建新数组，避免直接修改原始数组
        
        const fs = require('fs');
        let addedFiles = 0;
        let addedDirs = 0;
        
        // 处理每个选中的文件/文件夹
        for (const uri of uris) {
          try {
            const isDirectory = folderOnly || fs.statSync(uri.fsPath).isDirectory();
            
            // 转换为相对路径
            let relativePath = this.getRelativePath(uri.fsPath);
            
            // 如果是文件夹，确保路径以斜杠结尾
            if (isDirectory && !relativePath.endsWith('/')) {
              relativePath += '/';
              addedDirs++;
            } else if (!isDirectory) {
              addedFiles++;
            }
            
            // 如果不在列表中，则添加
            if (!updatedIncludeFiles.includes(relativePath)) {
              updatedIncludeFiles.push(relativePath);
              console.log(`添加 ${isDirectory ? '目录' : '文件'}: ${relativePath}`);
            }
          } catch (error) {
            console.error(`处理所选项时出错: ${uri.fsPath}`, error);
            vscode.window.showWarningMessage(`处理 ${uri.fsPath} 时出错: ${error.message}`);
          }
        }
        
        // 更新配置
        await config.update('includeFiles', updatedIncludeFiles, vscode.ConfigurationTarget.Workspace);
        
        // 刷新面板
        this.refreshPanel();
        
        const message = folderOnly ? 
          `已添加 ${addedDirs} 个文件夹到扫描列表` :
          `已添加 ${addedFiles} 个文件到扫描列表`;
        vscode.window.showInformationMessage(message);
      }
    } catch (error) {
      console.error('选择包含文件/文件夹时出错:', error);
      vscode.window.showErrorMessage('选择包含文件/文件夹时出错: ' + error.message);
    }
  }

  /**
   * 切换扫描所有文件模式
   * @param {boolean} scanAllFiles 是否扫描所有文件
   */
  async toggleScanAllFiles(scanAllFiles) {
    try {
      // 更新扫描模式
      this.scanAllFiles = scanAllFiles;
      
      // 如果切换到扫描所有文件且当前有打开的面板
      if (scanAllFiles && this.panel) {
        await vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: "扫描所有文件中...",
          cancellable: false
        }, async (progress) => {
          try {
            // 使用工作区扫描服务扫描所有文件
            const results = await workspaceScannerService.scanAllWorkspaceFiles(
              this.analyzeExistingI18nCalls.bind(this),
              progress
            );
            
            // 替换当前的扫描结果
            this.replacements = results.replacements;
            this.existingI18nCalls = results.existingCalls;
            
            // 更新面板内容
            await this.updatePanelContent();
            
            vscode.window.showInformationMessage(`扫描完成，找到 ${this.replacements.length} 个待替换项和 ${this.existingI18nCalls.length} 个已转义项`);
          } catch (error) {
            console.error('扫描所有文件时出错:', error);
            vscode.window.showErrorMessage('扫描所有文件时出错: ' + error.message);
          }
        });
      } else if (!scanAllFiles && this.document) {
        // 如果切换到仅扫描当前文件，并且存在当前文档
        // 重新分析当前文档
        await this.analyzeAndLoadPanel();
      }
      
      // // 更新配置
      // await vscode.workspace.getConfiguration('i18n-swapper').update(
      //   'scanAllFilesMode',
      //   scanAllFiles,
      //   vscode.ConfigurationTarget.Workspace
      // );
    } catch (error) {
      console.error('切换扫描模式时出错:', error);
      vscode.window.showErrorMessage('切换扫描模式时出错: ' + error.message);
    }
  }

  /**
   * 执行可见项的替换（针对筛选后的项目）
   * @param {Array<number>} visibleIndexes 可见项的索引数组
   */
  async performVisibleReplacements(visibleIndexes) {
    try {
      console.log('执行可见项替换，可见索引:', visibleIndexes);
      
      // 检查是否是扫描所有文件模式
      if (this.scanAllFiles) {
        return await this._performMultiFileReplacementsForIndexes(visibleIndexes);
      } else {
        // 单文件模式下，传递可见的索引
        return await this._performSingleFileReplacementsForIndexes(visibleIndexes);
      }
    } catch (error) {
      console.error('执行可见项替换时出错:', error);
      vscode.window.showErrorMessage(`替换失败: ${error.message}`);
    }
  }

  /**
   * 在扫描所有文件模式下执行指定索引项的多文件替换
   * @param {Array<number>} indexes 要替换的项目索引数组
   * @private
   */
  async _performMultiFileReplacementsForIndexes(indexes) {
    try {
      // 获取指定索引的项目
      let items = [];
      for (const index of indexes) {
        if (this.scanMode === 'translated' && this.existingI18nCalls[index]) {
          const item = this.existingI18nCalls[index];
          if (item.i18nKey && item.text) {
            items.push(item);
          }
        } else if ((this.scanMode === 'pending' || this.scanMode === 'all') && this.replacements[index]) {
          const item = this.replacements[index];
          if (item.i18nKey && item.text) {
            items.push(item);
          }
        }
      }

      if (items.length === 0) {
        vscode.window.showInformationMessage('没有可替换的项目，请确保选中的项目有国际化键');
        return;
      }

      // 创建编辑操作
      const workspaceEdit = new vscode.WorkspaceEdit();
      let totalItems = 0;

      // 获取工作区根目录
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        throw new Error('未找到工作区文件夹');
      }
      const rootPath = workspaceFolders[0].uri.fsPath;

      // 按文件分组处理替换项
      const itemsByFile = {};
      items.forEach(item => {
        // 确保文件路径存在
        if (!item.filePath) {
          // 如果没有文件路径，使用当前文档的路径
          if (this.document) {
            item.filePath = this.document.uri.fsPath;
          } else {
            console.warn('项目缺少文件路径且没有当前文档');
            return;
          }
        }
        
        // 规范化文件路径
        let filePath = item.filePath;
        if (!path.isAbsolute(filePath)) {
          filePath = path.join(rootPath, filePath);
        }
        
        if (!itemsByFile[filePath]) {
          itemsByFile[filePath] = [];
        }
        itemsByFile[filePath].push(item);
      });

      // 处理每个文件的替换
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "执行批量替换...",
        cancellable: false
      }, async (progress) => {
        const totalFiles = Object.keys(itemsByFile).length;
        let processedFiles = 0;
        
        // 处理每个文件的替换
        for (const [filePath, fileItems] of Object.entries(itemsByFile)) {
          try {
            progress.report({
              message: `处理文件 ${processedFiles + 1}/${totalFiles}...`,
              increment: 100 / totalFiles
            });
            
            console.log(`处理文件: ${filePath}`);
            
            if (!fs.existsSync(filePath)) {
              throw new Error(`文件不存在: ${filePath}`);
            }
            
            // 获取文件内容
            const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
            
            // 从后向前替换，避免位置变化
            fileItems.sort((a, b) => b.start - a.start);
            
            // 获取配置
            const config = vscode.workspace.getConfiguration('i18n-swapper');
            const functionName = config.get('functionName', 't');
            const quoteType = config.get('quoteType', 'single');
            const quote = quoteType === 'single' ? "'" : '"';
            
            // 处理每个替换项
            for (const item of fileItems) {
              if (!item.i18nKey) continue;
              
              // 获取位置信息
              const position = document.positionAt(item.start);
              
              // 使用统一的replaceFn方法处理替换逻辑
              const replacementResult = utils.replaceFn(
                item.text,
                item.i18nKey,
                functionName,
                quote,
                document,
                position
              );
              
              // 使用返回的范围和替换文本
              workspaceEdit.replace(
                document.uri,
                replacementResult.isVueAttr ? replacementResult.range : new vscode.Range(
                  document.positionAt(item.start),
                  document.positionAt(item.end)
                ),
                replacementResult.replacementText
              );
              
              totalItems++;
            }
            
            processedFiles++;
          } catch (error) {
            console.error(`处理文件 ${filePath} 时出错:`, error);
            throw new Error(`处理文件 ${path.basename(filePath)} 时出错: ${error.message}`);
          }
        }
      });

      // 应用所有编辑
      const success = await vscode.workspace.applyEdit(workspaceEdit);
      if (success) {
        vscode.window.showInformationMessage(`成功替换 ${totalItems} 个项目`);
        // 刷新面板
        await this.refreshPanel();
        return true;
      } else {
        vscode.window.showErrorMessage('无法应用替换编辑');
        return false;
      }
    } catch (error) {
      console.error('执行指定索引项多文件替换时出错:', error);
      vscode.window.showErrorMessage(`替换失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 在单文件模式下执行指定索引项的替换
   * @param {Array<number>} indexes 要替换的项目索引数组
   * @private
   */
  async _performSingleFileReplacementsForIndexes(indexes) {
    try {
      // 获取指定索引的项目
      let items = [];
      for (const index of indexes) {
        if (index >= 0 && index < this.replacements.length) {
          const item = this.replacements[index];
          if (item.i18nKey && item.text) {
            items.push(item);
          }
        }
      }

      if (items.length === 0) {
        vscode.window.showInformationMessage('没有可替换的项目，请确保选中的项目有国际化键');
        return false;
      }

      // 创建编辑操作
      const workspaceEdit = new vscode.WorkspaceEdit();
      
      // 从后向前替换，避免位置变化
      items.sort((a, b) => b.start - a.start);
      
      // 获取配置
      const config = vscode.workspace.getConfiguration('i18n-swapper');
      const functionName = config.get('functionName', 't');
      const quoteType = config.get('quoteType', 'single');
      const quote = quoteType === 'single' ? "'" : '"';
      
      // 处理每个替换项
      for (const item of items) {
        // 获取位置信息
        const position = this.document.positionAt(item.start);
        
        // 使用统一的replaceFn方法处理替换逻辑
        const replacementResult = utils.replaceFn(
          item.text,
          item.i18nKey,
          functionName,
          quote,
          this.document,
          position
        );
        
        // 使用返回的范围和替换文本
        workspaceEdit.replace(
          this.document.uri,
          replacementResult.isVueAttr ? replacementResult.range : new vscode.Range(
            this.document.positionAt(item.start),
            this.document.positionAt(item.end)
          ),
          replacementResult.replacementText
        );
      }

      // 应用所有编辑
      const success = await vscode.workspace.applyEdit(workspaceEdit);
      if (success) {
        vscode.window.showInformationMessage(`成功替换 ${items.length} 个项目`);
        return true;
      } else {
        vscode.window.showErrorMessage('无法应用替换编辑');
        return false;
      }
    } catch (error) {
      console.error('执行指定索引项单文件替换时出错:', error);
      vscode.window.showErrorMessage(`替换失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 销毁面板时清理资源
   */
  dispose() {
    // 委托给高亮服务处理
    if (this.highlightService) {
      this.highlightService.dispose();
    }

    // 释放活动编辑器变化监听器
    if (this._activeEditorChangeDisposable) {
      this._activeEditorChangeDisposable.dispose();
      this._activeEditorChangeDisposable = null;
    }

    // 现有的清理代码...
    if (this.panel) {
      this.panel.dispose();
    }
  }
}

module.exports = BatchReplacementPanel;