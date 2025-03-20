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
   * 初始化面板
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
  }

  /**
   * 处理面板消息
   * @param {Object} message 消息对象
   */
  async _handlePanelMessage(message) {
    const {
      command,
      data
    } = message;
    try {
      switch (command) {
        case 'updateI18nKey':
          this.updateI18nKey(data.index, data.key);
          break;
        case 'toggleSelection':
          this.toggleItemSelection(data.index, data.selected);
          break;
        case 'toggleSelectAll':
          await this.toggleSelectAll();
          break;
        case 'performReplacements':
          await this.performSelectedReplacements();
          break;
        case 'refreshPanel':
          await this.refreshPanel();
          break;
        case 'addPattern':
          await this.addScanPattern(data.pattern);
          break;
        case 'removePattern':
          await this.removeScanPattern(data.pattern);
          break;
        case 'selectLocalesFiles':
          await this.selectLocalesFiles();
          break;
        case 'createLanguageFiles':
          await this.showLanguageSelector();
          break;
        case 'saveTranslation':
          await this.saveTranslation(data.filePath, data.key, data.value);
          break;
        case 'translateItem':
          await this.translateItem(data.index, data.key);
          break;
        case 'openApiTranslation':
          await this.openApiTranslationConfig();
          break;
        case 'addScanPattern':
          await this.addScanPattern(data.pattern);
          break;
        case 'removeScanPattern':
          await this.removeScanPattern(data.pattern);
          break;
        case 'selectLocaleFile':
          await this.selectLocaleFile();
          break;
        case 'removeLocalePath':
          await this.removeLocalePath(data.path);
          break;
        case 'toggleConfig':
          this.isConfigExpanded = !this.isConfigExpanded;
          await this.updatePanelContent();
          break;
        case 'updateDecorationStyle':
          await this.highlightService.updateDecorationStyle(data.style);
          break;
        case 'updateDecorationStyles':
          await this.highlightService.updateDecorationStyles(data);
          break;
        case 'updateShowPreviewInEdit':
          await this.highlightService.updateShowPreviewInEdit(data.showPreview);
          break;
        case 'updateKey':
          this.updateI18nKey(data.index, data.key);
          break;
        case 'checkI18nKeyStatus':
          await this.checkI18nKeyStatus(data.index, data.key);
          break;
        case 'openLanguageFile':
          await this.openLanguageFile(data.filePath, data.key, data.languageCode);
          break;
        case 'replaceSelected':
          await this.performSelectedReplacements();
          break;
        case 'replaceAll':
          await this.performAllReplacements();
          break;
        case 'switchScanMode':
          if (data.mode !== undefined) {
            this.switchScanMode(data.mode);
          } else {
            console.error('切换模式失败：未提供模式参数');
          }
          break;
        case 'openI18nFile':
          if (data.index !== undefined) {
            await this.openI18nFile(data.index);
          } else {
            console.error('打开文件失败：未提供索引参数');
          }
          break;
        case 'copyI18nKey':
          if (data.index !== undefined) {
            await this.copyI18nKey(data.index);
          } else {
            console.error('复制键失败：未提供索引参数');
          }
          break;
        case 'refreshScan':
          await this.refreshScan();
          break;
        case 'updateConfig':
          await vscode.workspace.getConfiguration().update(
            data.key,
            data.value,
            vscode.ConfigurationTarget.Workspace
          );

          // 如果是自动翻译相关设置，可能需要刷新
          if (data.key.includes('autoGenerate') ||
            data.key.includes('autoTranslate')) {
            // 更新内部缓存的配置
            this._loadConfiguration();
          }
          break;
        case 'updateMissingKeyStyles':
          await this.highlightService.updateMissingKeyStyles(data);
          break;
        case 'highlightSourceText':
          const { start, end, index, filePath } = data;
          await this.highlightSourceText(start, end, index, filePath);
          break;
        case 'replaceSingleItem':
          await this.replaceSingleItem(data);
          break;
        case 'addI18nFunctionName':
          await this.addI18nFunctionName(data.name);
          break;
        case 'removeI18nFunctionName':
          await this.removeI18nFunctionName(data.name);
          break;
        case 'updateOutputI18nFunctionName':
          try {
            const {
              functionName
            } = data;
            if (functionName) {
              // 更新配置
              await vscode.workspace.getConfiguration('i18n-swapper').update('functionName', functionName, vscode.ConfigurationTarget.Workspace);

              // 不要尝试更新上下文对象，它是不可扩展的
              // this.context.outputI18nFunctionName = functionName; // 删除这行

              // 更新内部状态（如果需要）
              this.outputI18nFunctionName = functionName; // 使用实例变量而不是context

              vscode.window.showInformationMessage(`已更新输出国际化函数名称为: ${functionName}`);
            }
          } catch (error) {
            vscode.window.showErrorMessage(`更新输出国际化函数名称失败: ${error.message}`);
          }
          break;
        case 'addExcludePattern':
          this.addExcludePattern(data.pattern);
          break;
        case 'removeExcludePattern':
          this.removeExcludePattern(data.pattern);
          break;
        case 'toggleScanAllFiles':
          await this.toggleScanAllFiles(data.scanAllFiles);
          break;
        case 'refresh-panel':
          await this.refreshPanel();
          break;
        default:
          console.log(`未处理的命令: ${command}`);
      }
    } catch (error) {
      console.error('处理面板消息时出错:', error);
      vscode.window.showErrorMessage(`处理操作失败: ${error.message}`);
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
   */
  async refreshPanel() {
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
   * 选择所有项
   */
  selectAllItems(selected) {
    if (selected) {
      // 选择所有项
      this.selectedIndexes = this.replacements
        .map((_, index) => index)
        .filter(index => this.replacements[index].text);

      // 更新所有项的选中状态
      this.replacements.forEach(item => {
        if (item.text) {
          item.selected = true;
        }
      });
    } else {
      // 取消所有选择
      this.selectedIndexes = [];
      this.replacements.forEach(item => {
        item.selected = false;
      });
    }

    // 更新UI
    this.panel?.webview.postMessage({
      command: 'updateSelectionInUI',
      selectedIndexes: this.selectedIndexes,
      selectAll: selected
    });
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
   * 翻译并替换所选项目
   */
  async performSelectedReplacements() {
    try {
      const selectedItems = this.getSelectedItems();

      console.log(`获取到 ${selectedItems.length} 个选中项目`);

      if (selectedItems.length === 0) {
        vscode.window.showInformationMessage('没有选中的项目');
        return;
      }

      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: '正在替换所选项目...',
        cancellable: false
      }, async (progress) => {
        // 获取配置
        const config = vscode.workspace.getConfiguration('i18n-swapper');
        const functionName = config.get('functionName', 't');
        const quoteType = config.get('quoteType', 'single');
        const quote = quoteType === 'single' ? "'" : '"';

        // 获取当前编辑的文档
        const document = this.document;
        if (!document) {
          throw new Error('未找到关联的文档');
        }

        // 获取编辑器
        const editor = vscode.window.visibleTextEditors.find(
          editor => editor.document.uri.toString() === document.uri.toString()
        );

        if (!editor) {
          throw new Error('未找到关联的编辑器');
        }

        progress.report({
          message: `准备替换 ${selectedItems.length} 项...`
        });

        // 按从后往前的顺序排序
        const sortedItems = selectedItems.sort((a, b) => b.start - a.start);

        await editor.edit(editBuilder => {
          for (const item of sortedItems) {
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
            editBuilder.replace(
                replacementResult.isVueAttr ? replacementResult.range : new vscode.Range(
                    document.positionAt(item.start),
                    document.positionAt(item.end)
                ), 
                replacementResult.replacementText
            );
          }
        });

        // 更新已替换的项目状态
        // 标记已替换的项目
        const replacedIndexes = selectedItems.map(item => item.index);

        // 重新分析文档，更新所有项目的位置信息
        await this.analyzeAndLoadPanel();

        vscode.window.showInformationMessage(`已替换 ${selectedItems.length} 项`);
      });
    } catch (error) {
      console.error('替换所选项目出错:', error);
      vscode.window.showErrorMessage(`替换失败: ${error.message}`);
    }
  }

  /**
   * 执行所有项替换
   */
  async performAllReplacements() {
    try {
      // 检查文档
      if (!this.document) {
        vscode.window.showWarningMessage('找不到文档，请重新打开面板');
        return;
      }

      // 获取所有有国际化键的替换项
      const validItems = this.replacements.filter(item => item.i18nKey);

      if (validItems.length === 0) {
        vscode.window.showInformationMessage('没有有效的替换项');
        return;
      }

      // 获取当前编辑器，但不尝试打开新窗口
      const editor = vscode.window.activeTextEditor;

      // 显示进度条
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "执行批量替换...",
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
              this.document.uri, 
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
        } else {
          vscode.window.showErrorMessage('批量替换失败');
        }
      });

    } catch (error) {
      console.error('执行替换所有项时出错:', error);
      vscode.window.showErrorMessage(`替换失败: ${error.message}`);
    }
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
   * @param {string} mode 模式名称：'pending'、'translated' 或 'all'
   */
  async switchScanMode(mode) {
    if (this.scanMode === mode) return;

    this.scanMode = mode;
    this.selectedIndexes = []; // 切换模式时清空选择

    // 更新面板内容
    await this.updatePanelContent();
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
        this.selectedIndexes = currentItems.map((_, index) => index);
      }

      // 更新面板内容
      await this.updatePanelContent();
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
    let itemsSource = [];

    // 根据当前扫描模式确定项目来源
    if (this.scanMode === 'translated') {
      itemsSource = this.existingI18nCalls;
    } else if (this.scanMode === 'pending') {
      itemsSource = this.replacements;
    } else if (this.scanMode === 'all') {
      // 合并两个列表
      itemsSource = [...this.replacements, ...this.existingI18nCalls];
    }

    // 筛选所有选中且有i18nKey的项目
    return itemsSource.filter(item =>
      item.selected && item.i18nKey &&
      (this.selectedIndexes.includes(item.index) ||
        this.selectedIndexes.length === 0 && item.selected)
    );
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
        const uri = vscode.Uri.file(filePath);
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

  /**
   * 销毁面板时清理资源
   */
  dispose() {
    // 委托给高亮服务处理
    if (this.highlightService) {
      this.highlightService.dispose();
    }

    // 现有的清理代码...
    if (this.panel) {
      this.panel.dispose();
    }
  }

  // 添加排除模式
  async addExcludePattern(pattern) {
    const config = vscode.workspace.getConfiguration('i18n-swapper');
    const excludeFiles = config.get('excludeFiles', defaultsConfig.excludeFiles);
    
    if (!excludeFiles.includes(pattern)) {
      excludeFiles.push(pattern);
      await config.update('excludeFiles', excludeFiles, vscode.ConfigurationTarget.Global);
      this.refreshPanel();
    }
  }

  // 删除排除模式
  async removeExcludePattern(pattern) {
    const config = vscode.workspace.getConfiguration('i18n-swapper');
    let excludeFiles = config.get('excludeFiles', defaultsConfig.excludeFiles);
    
    excludeFiles = excludeFiles.filter(p => p !== pattern);
    await config.update('excludeFiles', excludeFiles, vscode.ConfigurationTarget.Global);
    this.refreshPanel();
  }

  /**
   * 切换扫描所有文件模式
   * @param {boolean} scanAll 是否扫描所有文件
   */
  async toggleScanAllFiles(scanAll) {
    try {
      // 更新扫描模式
      this.scanAllFiles = scanAll;
      
      // 如果切换到扫描所有文件且当前有打开的面板
      if (scanAll && this.panel) {
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
      } else if (!scanAll && this.document) {
        // 如果切换到仅扫描当前文件，并且存在当前文档
        // 重新分析当前文档
        await this.analyzeAndLoadPanel();
      }
      
      // // 更新配置
      // await vscode.workspace.getConfiguration('i18n-swapper').update(
      //   'scanAllFilesMode',
      //   scanAll,
      //   vscode.ConfigurationTarget.Global
      // );
    } catch (error) {
      console.error('切换扫描模式时出错:', error);
      vscode.window.showErrorMessage('切换扫描模式时出错: ' + error.message);
    }
  }

  /**
   * 获取相对于工作区根目录的路径
   * @param {string} absolutePath 绝对路径
   * @returns {string} 相对路径
   */
  getRelativePath(absolutePath) {
    try {
      return pathUtils.getRelativePath(absolutePath);
    } catch (error) {
      console.error('计算相对路径时出错:', error);
      return absolutePath;
    }
  }
}

module.exports = BatchReplacementPanel;