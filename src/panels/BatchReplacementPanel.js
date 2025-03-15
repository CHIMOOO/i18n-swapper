const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const utils = require('../utils');
const { SUPPORTED_LANGUAGE_MAPPINGS, LANGUAGE_NAMES } = require('../utils/language-mappings');
const { getPanelHtml } = require('./ui/panelHtmlGenerator');
const { analyzeDocument } = require('./services/documentAnalyzer');
const { createOrSelectLanguageFiles, saveTranslationToFile } = require('./services/languageFileManager');
const { performReplacements, generateReplacement } = require('./services/replacementService');
const { generateKeyFromText, translateText, getLanguageName } = require('./services/translationService');

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
    this.selectedIndexes = [];
    this.isConfigExpanded = false; // 默认折叠
    
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

    // 获取当前活动编辑器
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showInformationMessage('没有打开的编辑器');
      return;
    }

    this.document = editor.document;

    // 创建新的面板
    this.panel = vscode.window.createWebviewPanel(
      'i18nBatchReplacer',
      '批量替换国际化',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(this.context.extensionPath, 'src', 'webview'))
        ],
        retainContextWhenHidden: true
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
   * @param {object} message 消息对象
   */
  async _handlePanelMessage(message) {
    const { command, data } = message;
    
    try {
      switch (command) {
        case 'updateI18nKey':
          this.updateI18nKey(data.index, data.key);
          break;
        case 'toggleSelection':
          this.toggleItemSelection(data.index, data.selected);
          break;
        case 'toggleSelectAll':
          this.selectAllItems(data.selected);
          break;
        case 'performReplacements':
          await this.performSelectedReplacements();
          break;
        case 'refreshPanel':
          await this.refreshPanel();
          break;
        case 'addPattern':
          await this.addPattern(data.pattern);
          break;
        case 'removePattern':
          await this.removePattern(data.pattern);
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
        case 'toggleConfigSection':
          this.isConfigExpanded = data.expanded;
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
        default:
          console.log(`未处理的命令: ${command}`);
      }
    } catch (error) {
      console.error('处理面板消息时出错:', error);
      vscode.window.showErrorMessage(`处理面板操作失败: ${error.message}`);
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
      const absolutePath = path.isAbsolute(filePath) 
        ? filePath 
        : path.join(rootPath, filePath);
      
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
        progress.report({ message: "加载配置..." });

        // 获取配置
        const config = vscode.workspace.getConfiguration('i18n-swapper');
        const scanPatterns = config.get('scanPatterns', []);
        let localesPaths = config.get('localesPaths', []);

        // 尝试检查并选择国际化文件
        if (!localesPaths || localesPaths.length === 0) {
          progress.report({ message: "选择国际化文件..." });
          localesPaths = await utils.checkAndSelectLocaleFile();
        }

        progress.report({ message: "分析文档内容..." });

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

        // 恢复选择状态
        this.selectedIndexes = [];
        this.replacements.forEach((item, index) => {
          if (oldSelectedMap[item.text]) {
            item.selected = true;
            this.selectedIndexes.push(index);
          }
        });

        progress.report({ message: "更新面板..." });

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
   * 更新面板内容
   */
  async updatePanelContent() {
    if (!this.panel) return;
    
    try {
      // 获取当前配置
      const config = vscode.workspace.getConfiguration('i18n-swapper');
      const scanPatterns = config.get('scanPatterns', []);
      const localesPaths = config.get('localesPaths', []);
      const decorationStyle = config.get('decorationStyle', 'suffix');
      const suffixStyle = config.get('suffixStyle', {
        color: '#6A9955',
        fontSize: '1em',
        fontWeight: 'normal'
      });
      const inlineStyle = config.get('inlineStyle', {
        color: '#CE9178',
        fontSize: '1em',
        fontWeight: 'normal'
      });
      
      // 获取编辑模式预览配置
      const showFullFormInEditMode = config.get('showFullFormInEditMode', true);
      
      // 构建传递给面板的上下文
      const context = {
        decorationStyle,
        suffixStyle,
        inlineStyle,
        showFullFormInEditMode
      };
      
      // 生成面板HTML
      const html = getPanelHtml(
        scanPatterns || [], 
        this.replacements || [], 
        localesPaths || [],
        context,
        this.isConfigExpanded
      );
      
      // 更新面板内容
      this.panel.webview.html = html;
    } catch (error) {
      console.error('更新面板内容时出错:', error);
      vscode.window.showErrorMessage(`更新面板内容失败: ${error.message}`);
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
      const scanPatterns = config.get('scanPatterns', []);
      const localesPaths = config.get('localesPaths', []);
      
      // 重新分析文档
      if (this.document) {
        const text = this.document.getText();
        const fileExtension = path.extname(this.document.fileName).toLowerCase();
        
        // 分析文档内容
        this.replacements = await analyzeDocument(
          text, fileExtension, scanPatterns, localesPaths, this.document
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
    const scanPatterns = config.get('scanPatterns', []);
    
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
    let scanPatterns = config.get('scanPatterns', []);
    
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
    console.log('执行选中项的替换');
    
    if (!this.selectedIndexes || this.selectedIndexes.length === 0) {
      vscode.window.showInformationMessage('请先选择要替换的项');
      return;
    }
    
    await this.doBatchReplace(this.selectedIndexes);
  }

  /**
   * 执行批量替换
   * @param {number[]} indexes 选中的索引数组
   */
  async doBatchReplace(indexes) {
    if (!indexes || !Array.isArray(indexes) || indexes.length === 0) {
      vscode.window.showInformationMessage('没有选中任何项');
      return;
    }
    
    console.log('执行批量替换，选中的索引:', indexes);
    
    // 筛选有效的替换项
    const validItems = indexes
      .map(index => this.replacements[index])
      .filter(item => item && item.i18nKey);
    
    if (validItems.length === 0) {
      vscode.window.showInformationMessage('选中的项目没有可用的国际化键');
      return;
    }
    
    try {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document !== this.document) {
        vscode.window.showWarningMessage('编辑器已更改，请重新打开批量替换面板');
        return;
      }
      
      // 执行替换
      const successCount = await performReplacements(this.document, validItems);
      
      vscode.window.showInformationMessage(`成功替换了 ${successCount} 处文本`);
      
      // 刷新面板
      await this.refreshPanel();
    } catch (error) {
      console.error('批量替换出错:', error);
      vscode.window.showErrorMessage(`批量替换失败: ${error.message}`);
    }
  }

  /**
   * 翻译指定项并生成键
   * @param {number} index 替换项索引
   * @param {string} userInputKey 用户输入的键名
   */
  async translateItem(index, userInputKey = '') {
    if (index < 0 || index >= this.replacements.length) return;

    const item = this.replacements[index];
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
      const languageMappings = config.get('tencentTranslation.languageMappings', []);
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
      const scanPatterns = config.get('scanPatterns', []);
      
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
      let scanPatterns = config.get('scanPatterns', []);
      
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
      let localesPaths = config.get('localesPaths', []);
      
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
      let localesPaths = config.get('localesPaths', []);
      
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
      await config.update('decorationStyle', style, vscode.ConfigurationTarget.Global);
      
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
      const { decorationStyle, suffixStyle, inlineStyle } = data;
      const config = vscode.workspace.getConfiguration('i18n-swapper');
      
      // 更新所有样式配置
      await config.update('decorationStyle', decorationStyle, vscode.ConfigurationTarget.Global);
      await config.update('suffixStyle', suffixStyle, vscode.ConfigurationTarget.Global);
      await config.update('inlineStyle', inlineStyle, vscode.ConfigurationTarget.Global);
      
      // 应用新的样式
      await vscode.commands.executeCommand('i18n-swapper.refreshI18nDecorations');
      
      // 提示用户
      vscode.window.showInformationMessage('已更新装饰样式设置');
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
      const config = vscode.workspace.getConfiguration('i18n-swapper');
      await config.update('showFullFormInEditMode', showPreview, vscode.ConfigurationTarget.Global);
      
      // 刷新装饰
      await vscode.commands.executeCommand('i18n-swapper.refreshI18nDecorations');
      
      vscode.window.showInformationMessage(
        showPreview 
          ? '已启用内联模式编辑时显示译文预览' 
          : '已禁用内联模式编辑时显示译文预览'
      );
    } catch (error) {
      console.error('更新译文预览设置时出错:', error);
      throw error;
    }
  }
}

module.exports = BatchReplacementPanel; 