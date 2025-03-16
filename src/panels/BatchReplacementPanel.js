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
const defaultsConfig = require('../config/defaultsConfig'); // 引入默认配置，更改为明确的名称

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
    this.scanMode = 'pending'; // 新增：扫描模式，默认为待转义
    this.existingI18nCalls = []; // 新增：存储已转义的国际化调用

    // 处理面板关闭和视图状态变更
    this._disposables = [];
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
      data = {}
    } = message; // 添加默认空对象，防止 data 为 undefined

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
          await this._updateDecorationStyle(data.style);
          break;
        case 'updateDecorationStyles':
          await this.updateDecorationStyles(data);
          break;
        case 'updateShowPreviewInEdit':
          await this._updateShowPreviewInEdit(data.showPreview);
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

      // 调用语言文件管理服务保存翻译
      await saveTranslationToFile(absolutePath, key, value);

      vscode.window.showInformationMessage(`已保存翻译: ${key}`);

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
      const functionName = config.get('functionName', 't');

      // 构建正则表达式匹配 t('key') 或 $t('key') 模式
      // 支持单引号和双引号
      const i18nCallRegex = new RegExp(`(\\$?${functionName})\\s*\\(\\s*(['"])([^'"]+)\\2\\s*\\)`, 'g');

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
            const filePath = path.join(rootPath, mapping.filePath);
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
      // 获取当前配置
      const config = vscode.workspace.getConfiguration('i18n-swapper');
      const scanPatterns = config.get('scanPatterns', defaultsConfig.scanPatterns);
      const localesPaths = config.get('localesPaths', defaultsConfig.localesPaths);
      const decorationStyle = config.get('decorationStyle', defaultsConfig.decorationStyle);
      const suffixStyle = config.get('suffixStyle', defaultsConfig.suffixStyle);
      const inlineStyle = config.get('inlineStyle', defaultsConfig.inlineStyle);

      // 获取编辑模式预览配置
      const showFullFormInEditMode = config.get('showFullFormInEditMode', defaultsConfig.showFullFormInEditMode);

      // 获取语言映射配置
      const languageMappings = config.get('tencentTranslation.languageMappings', defaultsConfig.tencentTranslation.languageMappings);

      // 提前加载每个I18n键的翻译值信息
      if (languageMappings && languageMappings.length > 0) {
        await this.loadI18nKeysStatus(languageMappings);
      }

      // 构建传递给面板的上下文
      const context = {
        decorationStyle,
        suffixStyle,
        inlineStyle,
        showFullFormInEditMode,
        scanMode: this.scanMode // 新增：传递扫描模式
      };

      // 生成面板HTML
      const html = getPanelHtml(
        scanPatterns || [],
        this.replacements || [],
        localesPaths || [],
        context,
        this.isConfigExpanded,
        languageMappings || [],
        this.existingI18nCalls || [] // 新增：传递已转义的国际化调用
      );

      // 更新面板内容
      this.panel.webview.html = html;
    } catch (error) {
      console.error('更新面板内容时出错:', error);
      vscode.window.showErrorMessage(`更新面板内容失败: ${error.message}`);
    }
  }

  /**
   * 加载所有国际化键的翻译状态
   * @param {Array} languageMappings 语言映射配置
   */
  async loadI18nKeysStatus(languageMappings) {
    try {
      // 获取工作区根目录
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) return;
      const rootPath = workspaceFolders[0].uri.fsPath;
      let searchKeys = [];
      if (this.scanMode === 'translated') {
        searchKeys = this.existingI18nCalls
      } else if (this.scanMode === 'pending') {
        searchKeys = this.replacements
      } else if (this.scanMode === 'all') {
        searchKeys = this.replacements.concat(this.existingI18nCalls);
      }
      // 为每个替换项加载翻译状态
      for (const item of searchKeys) {
        if (!item.i18nKey) continue;

        // 如果不存在翻译状态对象，则创建一个
        if (!item.i18nStatus) {
          item.i18nStatus = {};
        }

        // 遍历每种语言，检查键是否存在
        for (const mapping of languageMappings) {
          try {
            const fullPath = path.join(rootPath, mapping.filePath);

            // 检查文件是否存在
            if (!fs.existsSync(fullPath)) {
              item.i18nStatus[mapping.languageCode] = {
                exists: false,
                value: null,
                error: '文件不存在'
              };
              continue;
            }

            // 读取文件内容
            const fileContent = fs.readFileSync(fullPath, 'utf8');
            let i18nData;

            // 解析文件内容
            if (fullPath.endsWith('.json')) {
              i18nData = JSON.parse(fileContent);
            } else if (fullPath.endsWith('.js')) {
              // 简单解析JS模块导出
              const match = fileContent.match(/export\s+default\s+({[\s\S]*?});?$/m);
              if (match && match[1]) {
                i18nData = Function(`return ${match[1]}`)();
              } else {
                item.i18nStatus[mapping.languageCode] = {
                  exists: false,
                  value: null,
                  error: '无法解析JS文件'
                };
                continue;
              }
            } else {
              item.i18nStatus[mapping.languageCode] = {
                exists: false,
                value: null,
                error: '不支持的文件类型'
              };
              continue;
            }

            // 获取嵌套键的值
            const keyParts = item.i18nKey.split('.');
            let value = i18nData;
            let exists = true;

            for (const part of keyParts) {
              if (value && typeof value === 'object' && part in value) {
                value = value[part];
              } else {
                exists = false;
                value = null;
                break;
              }
            }

            // 保存状态
            item.i18nStatus[mapping.languageCode] = {
              exists,
              value: exists ? value : null
            };
          } catch (error) {
            console.error(`加载键 ${item.i18nKey} 的 ${mapping.languageCode} 翻译状态时出错:`, error);
            item.i18nStatus[mapping.languageCode] = {
              exists: false,
              value: null,
              error: error.message
            };
          }
        }
      }
    } catch (error) {
      console.error('加载国际化键状态时出错:', error);
    }
  }

  /**
   * 刷新面板
   */
  async refreshPanel() {
    if (!this.panel) return;

    try {
      // 获取配置
      const config = vscode.workspace.getConfiguration('i18n-swapper');
      const scanPatterns = config.get('scanPatterns', defaultsConfig.scanPatterns);
      const localesPaths = config.get('localesPaths', defaultsConfig.localesPaths);

      // 重新分析文档
      if (this.document) {
        const text = this.document.getText();
        const fileExtension = path.extname(this.document.fileName).toLowerCase();

        // 分析文档内容 - 待转义内容
        this.replacements = await analyzeDocument(
          text, fileExtension, scanPatterns, localesPaths, this.document
        );

        // 分析已转义内容
        this.existingI18nCalls = await this.analyzeExistingI18nCalls(
          text, this.document
        );
      }

      // 更新面板
      this.updatePanelContent();
    } catch (error) {
      console.error('刷新面板时出错:', error);
      vscode.window.showErrorMessage(`刷新面板失败: ${error.message}`);
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
    if (index >= 0 && index < this.replacements.length) {
      this.replacements[index].selected = selected;

      // 更新选中索引数组
      if (selected && !this.selectedIndexes.includes(index)) {
        this.selectedIndexes.push(index);
        console.log(`添加项 ${index} 到选中列表，当前选中: ${this.selectedIndexes.length} 项`);
      } else if (!selected && this.selectedIndexes.includes(index)) {
        this.selectedIndexes = this.selectedIndexes.filter(i => i !== index);
        console.log(`从选中列表移除项 ${index}，当前选中: ${this.selectedIndexes.length} 项`);
      }
    }
  }

  /**
   * 执行选中项的替换
   */
  async performSelectedReplacements() {
    try {
      if (!this.document) {
        vscode.window.showWarningMessage('找不到文档，请重新打开面板');
        return;
      }

      // 筛选所有选中且有i18nKey的替换项
      const selectedItems = this.replacements.filter(item => item.selected && item.i18nKey);

      if (selectedItems.length === 0) {
        vscode.window.showInformationMessage('没有选择任何有效的替换项');
        return;
      }

      // 获取替换服务
      const replacementService = require('./services/replacementService');

      // 在进度条中执行替换
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: '执行替换',
        cancellable: false
      }, async (progress) => {
        progress.report({
          message: '正在替换...'
        });

        // 执行替换
        const count = await replacementService.performReplacements(this.document, selectedItems);

        // 从列表中移除已替换的项目
        if (count > 0) {
          this.replacements = this.replacements.filter(item =>
            !(item.selected && item.i18nKey)
          );

          // 更新面板
          await this.updatePanelContent();
        }

        vscode.window.showInformationMessage(`已替换 ${count} 个文本`);
      });
    } catch (error) {
      console.error('执行选中替换时出错:', error);
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

          // 创建替换范围
          const range = new vscode.Range(
            this.document.positionAt(item.start),
            this.document.positionAt(item.end)
          );

          // 生成替换文本
          let replacement;
          if (item.hasQuotes) {
            replacement = `${functionName}(${codeQuote}${item.i18nKey}${codeQuote})`;
          } else {
            const utils = require('../../utils');
            replacement = utils.generateReplacementText(
              item.text,
              item.i18nKey,
              functionName,
              codeQuote,
              this.document,
              this.document.positionAt(item.start)
            );
          }

          // 添加到工作区编辑中
          workspaceEdit.replace(this.document.uri, range, replacement);
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
    if (!item || !item.text) return;

    try {
      console.log(`[翻译开始] 索引: ${index}, 文本: "${item.text}"`);

      // 获取腾讯翻译API配置
      const config = vscode.workspace.getConfiguration('i18n-swapper');
      const apiKey = config.get('tencentTranslation.apiKey', '');
      const apiSecret = config.get('tencentTranslation.apiSecret', '');
      const region = config.get('tencentTranslation.region', 'ap-guangzhou');
      const sourceLanguage = config.get('tencentTranslation.sourceLanguage', 'zh');

      // 使用参数传入的键名或生成一个新的
      let suggestedKey = userInputKey || '';

      // 如果没有输入键名，则生成一个
      if (!suggestedKey) {
        suggestedKey = generateKeyFromText(item.text);
      }

      // 更新键名
      item.i18nKey = suggestedKey;

      console.log(`[翻译] 使用键名: ${suggestedKey}, 源语言: ${sourceLanguage}`);

      // 获取语言映射
      const languageMappings = config.get('tencentTranslation.languageMappings', defaultsConfig.tencentTranslation.languageMappings);
      console.log(`[翻译] 语言映射配置: ${JSON.stringify(languageMappings)}`);

      // 无法继续翻译
      if (!languageMappings || languageMappings.length === 0) {
        vscode.window.showWarningMessage('未配置语言映射，请先在API翻译配置中添加语言映射');
        return;
      }

      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: '翻译中...',
        cancellable: false
      }, async (progress) => {
        // 检查API配置
        if (!apiKey || !apiSecret) {
          vscode.window.showWarningMessage('未配置腾讯翻译API密钥，请先在API翻译配置中设置');
          return;
        }

        // 获取工作区目录
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
          vscode.window.showErrorMessage('未找到工作区文件夹');
          return;
        }
        const rootPath = workspaceFolders[0].uri.fsPath;

        // 遍历所有目标语言进行翻译
        for (const mapping of languageMappings) {
          try {
            progress.report({
              message: `翻译为 ${getLanguageName(mapping.languageCode)}...`
            });

            // 如果是源语言，直接使用原文
            if (mapping.languageCode === sourceLanguage) {
              await saveTranslationToFile(
                path.join(rootPath, mapping.filePath),
                suggestedKey,
                item.text
              );
              continue;
            }

            // 调用翻译API
            const translatedText = await translateText(
              item.text,
              sourceLanguage,
              mapping.languageCode,
              apiKey,
              apiSecret,
              region
            );

            console.log(`[翻译结果] ${mapping.languageCode}: "${translatedText}"`);

            // 保存翻译结果
            await saveTranslationToFile(
              path.join(rootPath, mapping.filePath),
              suggestedKey,
              translatedText
            );
          } catch (error) {
            console.error(`翻译到 ${mapping.languageCode} 失败:`, error);
            vscode.window.showErrorMessage(`翻译到 ${getLanguageName(mapping.languageCode)} 失败: ${error.message}`);
          }
        }

        vscode.window.showInformationMessage(`已生成键名 "${suggestedKey}" 并保存翻译`);
        await this.updatePanelContent();
      });
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
        const relativePath = path.relative(rootPath, absolutePath);
        return relativePath;
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
   * 更新装饰风格设置
   */
  async _updateDecorationStyle(style) {
    try {
      // 更新配置
      const config = vscode.workspace.getConfiguration('i18n-swapper');
      await config.update('decorationStyle', style, vscode.ConfigurationTarget.Workspace);

      // 通知用户
      const styleNames = {
        'suffix': "t('key')(译文)",
        'inline': "t(译文)"
      };
      vscode.window.showInformationMessage(`已将i18n装饰显示风格设置为: ${styleNames[style]}`);

      // 发送命令刷新装饰
      await vscode.commands.executeCommand('i18n-swapper.refreshI18nDecorations');
    } catch (error) {
      console.error('更新装饰风格设置时出错:', error);
      vscode.window.showErrorMessage(`更新装饰风格出错: ${error.message}`);
    }
  }

  /**
   * 更新装饰样式设置
   */
  async updateDecorationStyles(data) {
    try {
      const {
        decorationStyle,
        suffixStyle,
        inlineStyle
      } = data;

      // 使用VSCode API更新配置
      const config = vscode.workspace.getConfiguration('i18n-swapper');
      await config.update('decorationStyle', decorationStyle, vscode.ConfigurationTarget.Workspace);
      await config.update('suffixStyle', suffixStyle, vscode.ConfigurationTarget.Workspace);
      await config.update('inlineStyle', inlineStyle, vscode.ConfigurationTarget.Workspace);

      // 应用新的样式
      await vscode.commands.executeCommand('i18n-swapper.refreshI18nDecorations');

      // 提示用户
      vscode.window.showInformationMessage('已更新装饰样式设置，手动返回代码页面激活生效。');
    } catch (error) {
      console.error('更新装饰样式设置时出错:', error);
      vscode.window.showErrorMessage(`更新样式设置失败: ${error.message}`);
    }
  }

  /**
   * 更新内联模式编辑时显示译文预览设置
   */
  async _updateShowPreviewInEdit(showPreview) {
    try {
      // 使用VSCode API更新配置
      const config = vscode.workspace.getConfiguration('i18n-swapper');
      await config.update('showFullFormInEditMode', showPreview, vscode.ConfigurationTarget.Workspace);

      // 刷新装饰
      await vscode.commands.executeCommand('i18n-swapper.refreshI18nDecorations');

      vscode.window.showInformationMessage(
        showPreview ?
        '已启用内联模式编辑时显示译文预览' :
        '已禁用内联模式编辑时显示译文预览'
      );
    } catch (error) {
      console.error('更新译文预览设置时出错:', error);
      vscode.window.showErrorMessage(`更新译文预览设置失败: ${error.message}`);
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

      // 更新项的键值
      this.replacements[index].i18nKey = key;

      // 获取工作区根目录
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) return;
      const rootPath = workspaceFolders[0].uri.fsPath;

      // 初始化状态对象
      if (!this.replacements[index].i18nStatus) {
        this.replacements[index].i18nStatus = {};
      }

      // 检查每种语言中的状态
      for (const mapping of languageMappings) {
        try {
          const fullPath = path.join(rootPath, mapping.filePath);

          // 检查文件是否存在
          if (!fs.existsSync(fullPath)) {
            this.replacements[index].i18nStatus[mapping.languageCode] = {
              exists: false,
              value: null,
              error: '文件不存在'
            };
            continue;
          }

          // 读取文件内容
          const fileContent = fs.readFileSync(fullPath, 'utf8');
          let i18nData;

          // 解析文件内容
          if (fullPath.endsWith('.json')) {
            i18nData = JSON.parse(fileContent);
          } else if (fullPath.endsWith('.js')) {
            // 简单解析JS模块导出
            const match = fileContent.match(/export\s+default\s+({[\s\S]*?});?$/m);
            if (match && match[1]) {
              i18nData = Function(`return ${match[1]}`)();
            } else {
              this.replacements[index].i18nStatus[mapping.languageCode] = {
                exists: false,
                value: null,
                error: '无法解析JS文件'
              };
              continue;
            }
          } else {
            this.replacements[index].i18nStatus[mapping.languageCode] = {
              exists: false,
              value: null,
              error: '不支持的文件类型'
            };
            continue;
          }

          // 获取嵌套键的值
          const keyParts = key.split('.');
          let value = i18nData;
          let exists = true;

          for (const part of keyParts) {
            if (value && typeof value === 'object' && part in value) {
              value = value[part];
            } else {
              exists = false;
              value = null;
              break;
            }
          }

          // 保存状态
          this.replacements[index].i18nStatus[mapping.languageCode] = {
            exists,
            value: exists ? value : null
          };
        } catch (error) {
          console.error(`检查键 ${key} 的 ${mapping.languageCode} 状态时出错:`, error);
          this.replacements[index].i18nStatus[mapping.languageCode] = {
            exists: false,
            value: null,
            error: error.message
          };
        }
      }

      // 将更新的状态发送回面板
      if (this.panel) {
        this.panel.webview.postMessage({
          command: 'updateI18nKeyStatus',
          data: {
            index,
            status: this.replacements[index].i18nStatus,
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
    try {
      // 获取工作区根目录
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        throw new Error('未找到工作区文件夹');
      }
      const rootPath = workspaceFolders[0].uri.fsPath;

      // 构建完整文件路径
      const fullPath = path.isAbsolute(filePath) ?
        filePath :
        path.join(rootPath, filePath);

      // 检查文件是否存在
      if (!fs.existsSync(fullPath)) {
        throw new Error(`文件不存在: ${filePath}`);
      }

      // 打开文件
      const document = await vscode.workspace.openTextDocument(fullPath);
      const editor = await vscode.window.showTextDocument(document);

      // 尝试在文件中查找键并定位光标
      const content = document.getText();

      // 根据文件类型选择不同的查找方式
      let position = null;

      if (fullPath.endsWith('.json')) {
        // JSON文件查找格式: "key": 或 "nested.key":
        const keyParts = key.split('.');
        let searchKey = '';

        // 处理嵌套键，生成搜索模式
        if (keyParts.length === 1) {
          // 单级键: "key":
          searchKey = `"${key}"\\s*:`;
        } else {
          // 尝试直接查找最末级键
          const lastKey = keyParts[keyParts.length - 1];
          searchKey = `"${lastKey}"\\s*:`;
        }

        const regex = new RegExp(searchKey);
        const text = document.getText();
        const match = regex.exec(text);

        if (match) {
          const offset = match.index;
          position = document.positionAt(offset);
        }
      } else if (fullPath.endsWith('.js') || fullPath.endsWith('.ts')) {
        // JS/TS文件查找: key: 或 'key': 或 "key":
        const keyParts = key.split('.');
        const lastKey = keyParts[keyParts.length - 1];
        const searchKey = `['\"]?${lastKey}['\"]?\\s*:`;

        const regex = new RegExp(searchKey);
        const text = document.getText();
        const match = regex.exec(text);

        if (match) {
          const offset = match.index;
          position = document.positionAt(offset);
        }
      }

      // 如果找到位置，滚动到该位置
      if (position) {
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
      } else {
        // 未找到精确位置时，提示用户
        vscode.window.showInformationMessage(`已打开 ${filePath}，但未找到键 "${key}" 的精确位置`);
      }

      // 无论是否找到位置，记录一条日志信息
      console.log(`已打开文件 ${filePath} 查找键 ${key} [${languageCode}]`);
    } catch (error) {
      console.error('打开语言文件出错:', error);
      vscode.window.showErrorMessage(`打开文件失败: ${error.message}`);
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

      // 执行打开文件命令
      await vscode.commands.executeCommand('i18n-swapper.openLanguageFile', {
        filePath: item.i18nFile,
        langCode: 'unknown', // 这里可能需要从文件名推断语言代码
        i18nKey: item.i18nKey,
        shouldLocateKey: true
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
}

module.exports = BatchReplacementPanel;