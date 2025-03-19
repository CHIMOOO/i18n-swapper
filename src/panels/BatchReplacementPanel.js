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

    // 加载配置
    this._loadConfiguration();

    // 处理面板关闭和视图状态变更
    this._disposables = [];

    // 添加高亮装饰器
    this.highlightDecorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: 'rgba(255, 193, 7, 0.3)',
      borderWidth: '1px',
      borderStyle: 'solid',
      borderColor: '#FFC107',
      borderRadius: '3px',
      overviewRulerColor: '#FFC107',
      overviewRulerLane: vscode.OverviewRulerLane.Center
    });

    // 高亮定时器
    this.highlightTimer = null;
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
          // 获取缺失键样式配置
          const {
            missingKeyBorderWidth, missingKeyBorderStyle, missingKeyBorderColor, missingKeyBorderSpacing
          } = message.data;

          // 更新配置
          const config = vscode.workspace.getConfiguration('i18n-swapper');

          // 逐项更新配置
          config.update('missingKeyBorderWidth', missingKeyBorderWidth, vscode.ConfigurationTarget.Workspace);
          config.update('missingKeyBorderStyle', missingKeyBorderStyle, vscode.ConfigurationTarget.Workspace);
          config.update('missingKeyBorderColor', missingKeyBorderColor, vscode.ConfigurationTarget.Workspace);
          config.update('missingKeyBorderSpacing', missingKeyBorderSpacing, vscode.ConfigurationTarget.Workspace);

          // 通知用户
          vscode.window.showInformationMessage('缺失键样式设置已保存，返回代码页面重新激活');

          // 如果需要，刷新装饰器
          if (this.decorator) {
            this.decorator.updateDecorations();
          }
          break;
        case 'highlightSourceText':
          await this.highlightSourceText(data.start, data.end, data.index);
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
   */
  async highlightSourceText(start, end, index) {
    try {
      if (!this.document) {
        vscode.window.showWarningMessage('没有打开的文档');
        return;
      }

      // 获取当前所有可见编辑器
      const visibleEditors = vscode.window.visibleTextEditors;

      // 查找包含目标文档的编辑器
      let targetEditor = null;
      for (const editor of visibleEditors) {
        if (editor.document.uri.toString() === this.document.uri.toString()) {
          targetEditor = editor;
          break;
        }
      }

      // 如果没找到目标编辑器，再尝试显示文档但不切换焦点
      if (!targetEditor) {
        // 使用preserveFocus:true保持面板焦点
        await vscode.window.showTextDocument(this.document, {
          preserveFocus: true,
          viewColumn: vscode.ViewColumn.One // 强制使用第一个视图列
        });

        // 重新获取编辑器引用
        for (const editor of vscode.window.visibleTextEditors) {
          if (editor.document.uri.toString() === this.document.uri.toString()) {
            targetEditor = editor;
            break;
          }
        }
      }

      // 如果仍然没有找到目标编辑器，给出错误提示
      if (!targetEditor) {
        vscode.window.showErrorMessage('无法定位到源文档编辑器');
        return;
      }

      // 获取要高亮的项目
      let item = null;
      if (this.scanMode === 'pending') {
        item = this.replacements[index];
      } else if (this.scanMode === 'translated') {
        item = this.existingI18nCalls[index];
      } else if (this.scanMode === 'all') {
        // 在合并数组中查找
        const allItems = [...this.replacements, ...this.existingI18nCalls];
        item = allItems[index];
      }

      // 使用项目中原始的start和end，而不是参数中传入的
      if (item && typeof item.start === 'number' && typeof item.end === 'number') {
        start = item.start;
        end = item.end;
      }

      // 创建位置范围
      const startPos = this.document.positionAt(start);
      const endPos = this.document.positionAt(end);
      const range = new vscode.Range(startPos, endPos);

      // 滚动到位置并居中显示
      targetEditor.revealRange(range, vscode.TextEditorRevealType.InCenter);

      // 添加高亮装饰
      targetEditor.setDecorations(this.highlightDecorationType, [range]);

      // 设置选择
      targetEditor.selection = new vscode.Selection(startPos, endPos);

      // 清除之前的定时器
      if (this.highlightTimer) {
        clearTimeout(this.highlightTimer);
      }

      // 5秒后自动清除高亮
      this.highlightTimer = setTimeout(() => {
        targetEditor.setDecorations(this.highlightDecorationType, []);
        this.highlightTimer = null;
      }, 5000);

    } catch (error) {
      console.error('高亮源文本出错:', error);
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
        await this.analyzeAndLoadPanel();

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
   * 销毁面板时清理资源
   */
  dispose() {
    // 清除高亮定时器
    if (this.highlightTimer) {
      clearTimeout(this.highlightTimer);
      this.highlightTimer = null;
    }

    // 清除高亮装饰
    if (this.highlightDecorationType) {
      this.highlightDecorationType.dispose();
    }

    // 现有的清理代码...

    if (this.panel) {
      this.panel.dispose();
    }
  }
}

module.exports = BatchReplacementPanel;