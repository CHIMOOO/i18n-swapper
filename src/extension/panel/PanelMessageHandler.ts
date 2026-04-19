/**
 * WebView 消息处理器
 * 接收 WebView 消息并调度到对应的核心服务
 */
import * as vscode from 'vscode';
import * as path from 'path';
import type { ConfigManager } from '../core/config/ConfigManager';
import type { LocaleStore } from '../core/locale/LocaleStore';
import type { LocaleFileIO } from '../core/locale/LocaleFileIO';
import type { KeyResolver } from '../core/locale/KeyResolver';
import type { TextReplacer } from '../core/replacer/TextReplacer';
import type { TranslationService } from '../core/translation/TranslationService';
import type { IPlatformAdapter } from '../platforms/types';
import { WorkspaceScanner } from './WorkspaceScanner';
import { LANGUAGE_NAMES } from '../core/types';

export interface PanelDependencies {
  configManager: ConfigManager;
  localeStore: LocaleStore;
  translationService: TranslationService;
  getRootPath: () => string | undefined;
  refreshCallback: () => void;
  localeFileIO?: LocaleFileIO;
  keyResolver?: KeyResolver;
  textReplacer?: TextReplacer;
  workspaceScanner?: WorkspaceScanner;
  adapter?: IPlatformAdapter;
}

type PostMessage = (message: unknown) => void;

type ScanMode = 'current' | 'all';

export class PanelMessageHandler {
  private scanMode: ScanMode = 'current';
  private followActiveEditor = true;
  /** 上一次推送给前端的活动编辑器路径，避免重复触发扫描 */
  private lastActiveFilePath: string | null = null;

  constructor(
    private deps: PanelDependencies,
    private postMessage: PostMessage
  ) {}

  updateDeps(deps: Partial<PanelDependencies>): void {
    Object.assign(this.deps, deps);
  }

  updatePostMessage(fn: PostMessage): void {
    this.postMessage = fn;
  }

  private get platformReady(): boolean {
    return !!(this.deps.adapter && this.deps.localeFileIO && this.deps.textReplacer && this.deps.workspaceScanner);
  }

  private ensurePlatformReady(action: string): boolean {
    if (this.platformReady) return true;
    this.postMessage({ command: 'error', payload: { message: `${action}: 平台尚未就绪，请先选择平台或配置语言文件` } });
    return false;
  }

  async handleMessage(message: { command: string; payload?: unknown }): Promise<void> {
    try {
      switch (message.command) {
        case 'ready':
          await this.handleReady();
          break;
        case 'getConfig':
          this.handleGetConfig();
          break;
        case 'getLocaleData':
          this.handleGetLocaleData();
          break;
        case 'getLanguageStatus':
          this.handleGetLanguageStatus();
          break;
        case 'getPlatformStatus':
          this.handleGetPlatformStatus();
          break;
        case 'scanWorkspace':
          if (this.ensurePlatformReady('扫描工作区')) await this.handleScanWorkspace();
          break;
        case 'scanCurrentFile':
          if (this.ensurePlatformReady('扫描当前文件')) await this.handleScanCurrentFile();
          break;
        case 'replaceItem':
          if (this.ensurePlatformReady('替换')) await this.handleReplaceItem(message.payload as any);
          break;
        case 'batchReplace':
          if (this.ensurePlatformReady('批量替换')) await this.handleBatchReplace(message.payload as any);
          break;
        case 'translateKey':
          if (this.ensurePlatformReady('翻译')) await this.handleTranslateKey(message.payload as any);
          break;
        case 'addTranslation':
          if (this.ensurePlatformReady('添加翻译')) await this.handleAddTranslation(message.payload as any);
          break;
        case 'editTranslation':
          if (this.ensurePlatformReady('编辑翻译')) await this.handleEditTranslation(message.payload as any);
          break;
        case 'searchKeys':
          this.handleSearchKeys(message.payload as any);
          break;
        case 'openFile':
          await this.handleOpenFile(message.payload as any);
          break;
        case 'highlightText':
          await this.handleHighlightText(message.payload as any);
          break;
        case 'updateConfig':
          await this.handleUpdateConfig(message.payload as any);
          break;
        case 'configArrayAdd':
          await this.handleConfigArrayAdd(message.payload as any);
          break;
        case 'configArrayRemove':
          await this.handleConfigArrayRemove(message.payload as any);
          break;
        case 'setLocalesPaths':
          await this.handleSetLocalesPaths(message.payload as any);
          break;
        case 'setLanguageMappings':
          await this.handleSetLanguageMappings(message.payload as any);
          break;
        case 'pickPathForConfig':
          await this.handlePickPathForConfig(message.payload as any);
          break;
        case 'testTranslationApi':
          await this.handleTestTranslationApi();
          break;
        case 'selectLocaleFiles':
          await this.handleSelectLocaleFiles();
          break;
        case 'openSettings':
          await this.handleOpenSettings(message.payload as any);
          break;
        case 'copyToClipboard':
          await this.handleCopyToClipboard(message.payload as any);
          break;
        case 'setScanMode':
          this.handleSetScanMode(message.payload as any);
          break;
        case 'setFollowActiveEditor':
          this.handleSetFollowActiveEditor(message.payload as any);
          break;
        case 'translateScanItem':
          if (this.ensurePlatformReady('翻译')) await this.handleTranslateScanItem(message.payload as any);
          break;
        case 'refreshData':
          await this.handleRefreshData();
          break;
        case 'switchPlatform':
          await vscode.commands.executeCommand('i18n-swapper.switchPlatform');
          break;
        case 'discoverLocaleFiles':
          await vscode.commands.executeCommand('i18n-swapper.discoverLocaleFiles');
          break;
        case 'initializeLocales':
          await vscode.commands.executeCommand('i18n-swapper.initializeLocales');
          break;
        default:
          console.warn(`[i18n-swapper] 未知的面板消息: ${message.command}`);
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      this.postMessage({ command: 'error', payload: { message: errorMsg } });
    }
  }

  private async handleReady(): Promise<void> {
    this.handleGetPlatformStatus();
    this.handleGetConfig();
    this.postScanModeState();
    if (this.platformReady) {
      this.handleGetLocaleData();
      this.handleGetLanguageStatus();
      // 初始上报当前活动编辑器
      this.notifyActiveEditorChanged(vscode.window.activeTextEditor, { rescan: false });
    }
  }

  private handleGetPlatformStatus(): void {
    const { configManager, adapter } = this.deps;
    this.postMessage({
      command: 'platformStatus',
      payload: {
        platformReady: this.platformReady,
        hasLocalesPaths: configManager.localesPaths.length > 0,
        platformName: adapter?.displayName,
      },
    });
  }

  private handleGetConfig(): void {
    const { configManager, translationService, adapter } = this.deps;
    const tt = configManager.tencentTranslation;
    const userFunctionName = configManager.functionName;
    const platformDefaultFunctionName = adapter?.defaultFunctionName ?? userFunctionName;
    // 用户未显式覆盖时（保持默认 't'），按平台返回更合适的函数名
    const effectiveFunctionName =
      adapter && (!userFunctionName || userFunctionName === 't')
        ? platformDefaultFunctionName
        : userFunctionName;
    this.postMessage({
      command: 'configData',
      payload: {
        platform: configManager.platform,
        localesPaths: configManager.localesPaths,
        functionName: configManager.functionName,
        effectiveFunctionName,
        platformDefaultFunctionName,
        availableFunctionNames: adapter?.availableFunctionNames ?? [],
        quoteType: configManager.quoteType,
        defaultLocale: configManager.defaultLocale,
        identifyFunctionNames: configManager.identifyFunctionNames,
        matchPatterns: configManager.matchPatterns,
        scanPatterns: configManager.scanPatterns,
        excludeFiles: configManager.excludeFiles,
        includeFiles: configManager.includeFiles,
        decorationStyle: configManager.decorationStyle,
        showFullFormInEditMode: configManager.showFullFormInEditMode,
        suffixStyle: configManager.suffixStyle,
        inlineStyle: configManager.inlineStyle,
        missingKeyStyle: configManager.missingKeyStyle,
        apiKey: tt.apiKey,
        apiSecret: tt.apiSecret,
        apiRegion: tt.region,
        sourceLanguage: tt.sourceLanguage,
        languageMappings: tt.languageMappings,
        translationConfigured: translationService.isConfigured,
        autoGenerateKeyFromText: configManager.autoGenerateKeyFromText,
        autoGenerateKeyPrefix: configManager.autoGenerateKeyPrefix,
        autoTranslateAllLanguages: configManager.autoTranslateAllLanguages,
        defaultRepositories: configManager.defaultRepositories,
        localeResSubPaths: configManager.localeResSubPaths,
        keyMappingFiles: configManager.keyMappingFiles,
        skipPrompt: configManager.skipPrompt,
      },
    });
  }

  private handleGetLocaleData(): void {
    const { localeStore } = this.deps;
    this.postMessage({
      command: 'localeData',
      payload: {
        flatData: localeStore.getFlatData(),
        keyCount: localeStore.keyCount,
        languageCodes: localeStore.getAllLanguageCodes(),
      },
    });
  }

  private handleGetLanguageStatus(): void {
    const { localeStore, configManager } = this.deps;
    const mappings = configManager.languageMappings;
    const flatData = localeStore.getFlatData();
    const sourceKeys = Object.keys(flatData);

    const languages = mappings.map((mapping) => {
      const langData = localeStore.getLanguageData(mapping.languageCode);
      const translatedKeys: string[] = [];
      const missingKeys: string[] = [];

      for (const key of sourceKeys) {
        const value = localeStore.getNestedValue(mapping.languageCode, key);
        if (value) {
          translatedKeys.push(key);
        } else {
          missingKeys.push(key);
        }
      }

      return {
        code: mapping.languageCode,
        name: LANGUAGE_NAMES[mapping.languageCode] || LANGUAGE_NAMES[mapping.languageCode.split('-')[0]] || mapping.languageCode,
        filePath: mapping.filePath,
        totalKeys: sourceKeys.length,
        translatedKeys: translatedKeys.length,
        missingKeys,
      };
    });

    this.postMessage({
      command: 'languageStatus',
      payload: { languages, sourceKeys },
    });
  }

  private async handleScanWorkspace(): Promise<void> {
    const rootPath = this.deps.getRootPath();
    if (!rootPath) {
      this.postMessage({ command: 'error', payload: { message: '未找到工作区' } });      return;
    }

    const { configManager, adapter, workspaceScanner } = this.deps;
    const extensions = adapter!.supportedExtensions;

    const results = await workspaceScanner!.scanWorkspace(
      rootPath,
      extensions,
      configManager.excludeFiles,
      configManager.includeFiles,
      (progress) => {
        this.postMessage({ command: 'scanProgress', payload: progress });
      }
    );

    for (const result of results) {
      this.postMessage({ command: 'scanResult', payload: this.enrichExistingValues(result) });
    }

    this.postMessage({
      command: 'scanProgress',
      payload: { current: results.length, total: results.length, currentFile: '', phase: 'complete' },
    });
  }

  private async handleScanCurrentFile(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      this.postMessage({ command: 'error', payload: { message: '没有打开的编辑器' } });
      return;
    }

    const { workspaceScanner } = this.deps;
    const result = await workspaceScanner!.scanSingleFile(editor.document.uri.fsPath);

    if (result) {
      this.postMessage({ command: 'scanResult', payload: this.enrichExistingValues(result) });
    } else {
      this.postMessage({ command: 'info', payload: { message: '当前文件没有发现待处理文本' } });
    }
  }

  private async handleReplaceItem(payload: {
    filePath: string;
    start: number;
    end: number;
    text: string;
    i18nKey: string;
  }): Promise<void> {
    const rootPath = this.deps.getRootPath();
    if (!rootPath) return;

    const { configManager, textReplacer } = this.deps;
    const absolutePath = path.isAbsolute(payload.filePath)
      ? payload.filePath
      : path.join(rootPath, payload.filePath);

    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(absolutePath));
    const ctx = this.buildReplaceContext(rootPath);

    const count = await textReplacer!.batchReplace(document, [
      { start: payload.start, end: payload.end, key: payload.i18nKey, text: payload.text },
    ], ctx);

    this.postMessage({
      command: 'replaceResult',
      payload: { success: count > 0, count, message: count > 0 ? '替换成功' : '替换失败' },
    });

    if (count > 0) {
      this.deps.refreshCallback();
    }
  }

  private async handleBatchReplace(payload: {
    filePath: string;
    items: Array<{ start: number; end: number; text: string; key: string }>;
  }): Promise<void> {
    const rootPath = this.deps.getRootPath();
    if (!rootPath) return;

    const { textReplacer } = this.deps;
    const absolutePath = path.isAbsolute(payload.filePath)
      ? payload.filePath
      : path.join(rootPath, payload.filePath);

    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(absolutePath));
    const ctx = this.buildReplaceContext(rootPath);
    const count = await textReplacer!.batchReplace(document, payload.items, ctx);

    this.postMessage({
      command: 'replaceResult',
      payload: { success: count > 0, count, message: `成功替换 ${count} 项` },
    });

    if (count > 0) {
      this.deps.refreshCallback();
    }
  }

  private async handleTranslateKey(payload: {
    key: string;
    text: string;
    targetLanguages?: string[];
  }): Promise<void> {
    const { translationService, localeFileIO, configManager } = this.deps;
    const rootPath = this.deps.getRootPath();
    if (!rootPath) return;

    if (!translationService.isConfigured) {
      this.postMessage({ command: 'error', payload: { message: '翻译 API 未配置' } });
      return;
    }

    const mappings = configManager.languageMappings;
    const targetMappings = payload.targetLanguages
      ? mappings.filter((m) => payload.targetLanguages!.includes(m.languageCode))
      : mappings;

    const results = await translationService.translateToAllLanguages(
      payload.text,
      payload.key,
      targetMappings,
      configManager.sourceLanguage
    );

    for (const result of results) {
      if (result.success && result.text) {
        const mapping = targetMappings.find((m) => m.languageCode === result.languageCode);
        if (mapping) {
          const filePath = path.isAbsolute(mapping.filePath)
            ? mapping.filePath
            : path.join(rootPath, mapping.filePath);
          await localeFileIO!.saveTranslation(filePath, payload.key, result.text);
        }
      }
    }

    this.postMessage({ command: 'translateResult', payload: { key: payload.key, results } });
    this.deps.refreshCallback();
    this.handleGetLocaleData();
    this.handleGetLanguageStatus();
  }

  private async handleAddTranslation(payload: {
    key: string;
    value: string;
    languageCode?: string;
  }): Promise<void> {
    const rootPath = this.deps.getRootPath();
    if (!rootPath) return;

    const { localeFileIO, configManager } = this.deps;
    const langCode = payload.languageCode || configManager.sourceLanguage;
    const mapping = configManager.languageMappings.find(
      (m) => m.languageCode === langCode || m.languageCode.startsWith(langCode + '-')
    );

    if (!mapping) {
      this.postMessage({ command: 'error', payload: { message: `未找到 ${langCode} 的语言文件映射` } });
      return;
    }

    const filePath = path.isAbsolute(mapping.filePath)
      ? mapping.filePath
      : path.join(rootPath, mapping.filePath);

    const success = await localeFileIO!.saveTranslation(filePath, payload.key, payload.value);
    if (success) {
      this.deps.refreshCallback();
      this.handleGetLocaleData();
      this.handleGetLanguageStatus();
      this.postMessage({ command: 'info', payload: { message: `已添加: ${payload.key}` } });
    }
  }

  private async handleEditTranslation(payload: {
    key: string;
    value: string;
    languageCode: string;
    filePath: string;
  }): Promise<void> {
    const rootPath = this.deps.getRootPath();
    if (!rootPath) return;

    const { localeFileIO } = this.deps;
    const absolutePath = path.isAbsolute(payload.filePath)
      ? payload.filePath
      : path.join(rootPath, payload.filePath);

    const success = await localeFileIO!.saveTranslation(absolutePath, payload.key, payload.value);
    if (success) {
      this.deps.refreshCallback();
      this.handleGetLocaleData();
      this.handleGetLanguageStatus();
      this.postMessage({ command: 'info', payload: { message: `已更新: [${payload.languageCode}] ${payload.key}` } });
    }
  }

  private handleSearchKeys(payload: { query: string; searchIn: 'key' | 'value' | 'both' }): void {
    const { localeStore } = this.deps;
    const flatData = localeStore.getFlatData();
    const query = payload.query.toLowerCase();
    const results: Array<{ key: string; value: string; translations: Record<string, string> }> = [];

    for (const [key, value] of Object.entries(flatData)) {
      const matchKey = payload.searchIn !== 'value' && key.toLowerCase().includes(query);
      const matchValue = payload.searchIn !== 'key' && value.toLowerCase().includes(query);

      if (matchKey || matchValue) {
        const translations: Record<string, string> = {};
        for (const langCode of localeStore.getAllLanguageCodes()) {
          const langValue = localeStore.getNestedValue(langCode, key);
          if (langValue) {
            translations[langCode] = langValue;
          }
        }
        results.push({ key, value, translations });
      }
    }

    this.postMessage({
      command: 'searchResult',
      payload: { results: results.slice(0, 200), total: results.length },
    });
  }

  private async handleOpenFile(payload: { filePath: string; line?: number; column?: number }): Promise<void> {
    const rootPath = this.deps.getRootPath();
    if (!rootPath) return;

    const absolutePath = path.isAbsolute(payload.filePath)
      ? payload.filePath
      : path.join(rootPath, payload.filePath);

    try {
      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(absolutePath));
      const editor = await vscode.window.showTextDocument(document, { viewColumn: vscode.ViewColumn.One });

      if (payload.line !== undefined) {
        const position = new vscode.Position(payload.line, payload.column || 0);
        editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
        editor.selection = new vscode.Selection(position, position);
      }
    } catch {
      this.postMessage({ command: 'error', payload: { message: `无法打开文件: ${payload.filePath}` } });
    }
  }

  private async handleHighlightText(payload: { filePath: string; start: number; end: number }): Promise<void> {
    const root = this.deps.getRootPath();
    const abs = !payload.filePath || path.isAbsolute(payload.filePath) || !root
      ? payload.filePath
      : path.join(root, payload.filePath);
    await vscode.commands.executeCommand('i18n-swapper.highlightText', { ...payload, filePath: abs });
  }

  private async handleUpdateConfig(payload: { key: string; value: unknown }): Promise<void> {
    await this.deps.configManager.update(payload.key, payload.value);
    this.handleGetConfig();
  }

  private async handleConfigArrayAdd(payload: { key: string; value: string }): Promise<void> {
    const trimmed = (payload.value ?? '').toString().trim();
    if (!trimmed) {
      this.postMessage({ command: 'error', payload: { message: '请输入有效内容' } });
      return;
    }
    const ok = await this.deps.configManager.pushArrayItem(payload.key, trimmed);
    if (!ok) {
      this.postMessage({ command: 'info', payload: { message: '该项已存在或不可添加' } });
    }
    this.handleGetConfig();
  }

  private async handleConfigArrayRemove(payload: { key: string; value: string }): Promise<void> {
    await this.deps.configManager.removeArrayItem(payload.key, payload.value);
    this.handleGetConfig();
  }

  private async handleSetLocalesPaths(payload: { paths: string[] }): Promise<void> {
    await this.deps.configManager.setLocalesPaths(payload.paths || []);
    this.deps.refreshCallback();
    this.handleGetConfig();
    this.handleGetLocaleData();
    this.handleGetLanguageStatus();
  }

  private async handleSetLanguageMappings(payload: {
    mappings: Array<{ languageCode: string; filePath: string }>;
  }): Promise<void> {
    await this.deps.configManager.setLanguageMappings(payload.mappings || []);
    this.deps.refreshCallback();
    this.handleGetConfig();
    this.handleGetLanguageStatus();
  }

  private async handlePickPathForConfig(payload: {
    configKey: string;
    pickType: 'file' | 'folder' | 'fileMulti';
    filters?: Record<string, string[]>;
    openLabel?: string;
  }): Promise<void> {
    const rootPath = this.deps.getRootPath();
    if (!rootPath) return;

    const isFolder = payload.pickType === 'folder';
    const files = await vscode.window.showOpenDialog({
      canSelectMany: payload.pickType === 'fileMulti',
      canSelectFiles: !isFolder,
      canSelectFolders: isFolder,
      openLabel: payload.openLabel || (isFolder ? '选择文件夹' : '选择文件'),
      filters: payload.filters,
      defaultUri: vscode.Uri.file(rootPath),
    });

    if (!files || files.length === 0) return;

    for (const file of files) {
      const rel = vscode.workspace.asRelativePath(file, false).replace(/\\/g, '/');
      await this.deps.configManager.pushArrayItem(payload.configKey, rel);
    }
    this.handleGetConfig();
  }

  private async handleTestTranslationApi(): Promise<void> {
    const { translationService, configManager } = this.deps;
    if (!translationService.isConfigured) {
      this.postMessage({
        command: 'testApiResult',
        payload: { success: false, message: '尚未配置 apiKey 与 apiSecret' },
      });
      return;
    }
    try {
      const sample = '你好';
      const target = configManager.sourceLanguage === 'en' ? 'zh' : 'en';
      const translated = await translationService.translate(sample, target, configManager.sourceLanguage);
      this.postMessage({
        command: 'testApiResult',
        payload: {
          success: true,
          message: `连接成功：${sample} → ${translated}`,
          translated,
        },
      });
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      this.postMessage({
        command: 'testApiResult',
        payload: { success: false, message: `连接失败：${errMsg}` },
      });
    }
  }

  private async handleSelectLocaleFiles(): Promise<void> {
    const rootPath = this.deps.getRootPath();
    if (!rootPath) return;

    const files = await vscode.window.showOpenDialog({
      canSelectMany: true,
      openLabel: '选择源语言文件',
      filters: { '语言文件': ['json', 'js', 'xml', 'strings'] },
      defaultUri: vscode.Uri.file(rootPath),
    });

    if (files && files.length > 0) {
      const relativePaths = files.map((f) => {
        const rel = vscode.workspace.asRelativePath(f, false);
        return rel.replace(/\\/g, '/');
      });
      await this.deps.configManager.setLocalesPaths(relativePaths);
      this.deps.refreshCallback();
      this.handleGetConfig();
      this.handleGetLocaleData();
      this.handleGetLanguageStatus();
    }
  }

  private async handleOpenSettings(payload?: { section?: string }): Promise<void> {
    const section = payload?.section || 'i18n-swapper';
    await vscode.commands.executeCommand('workbench.action.openSettings', section);
  }

  private async handleCopyToClipboard(payload: { text: string }): Promise<void> {
    await vscode.env.clipboard.writeText(payload.text);
    this.postMessage({ command: 'info', payload: { message: '已复制到剪贴板' } });
  }

  private handleSetScanMode(payload: { mode: ScanMode }): void {
    if (payload?.mode !== 'all' && payload?.mode !== 'current') return;
    this.scanMode = payload.mode;
    this.postScanModeState();
    // 切换到「当前文件」模式时，立即扫一次当前文件
    if (this.scanMode === 'current' && this.platformReady) {
      void this.handleScanCurrentFile();
    }
  }

  private handleSetFollowActiveEditor(payload: { enabled: boolean }): void {
    this.followActiveEditor = !!payload?.enabled;
    this.postScanModeState();
  }

  private async handleTranslateScanItem(payload: { key: string; text: string }): Promise<void> {
    if (!payload?.key || !payload?.text) {
      this.postMessage({ command: 'error', payload: { message: '缺少 key 或文本' } });
      return;
    }
    await this.handleTranslateKey({ key: payload.key, text: payload.text });
  }

  /**
   * 由 PanelBridge 调用：活动编辑器切换时通知前端，并按需自动重扫
   * @param editor 当前活动编辑器
   * @param opts.rescan 是否在满足条件时触发重扫（默认 true）
   */
  notifyActiveEditorChanged(
    editor: vscode.TextEditor | undefined,
    opts: { rescan?: boolean } = {}
  ): void {
    const rescan = opts.rescan !== false;
    const filePath = editor?.document.uri.scheme === 'file' ? editor.document.uri.fsPath : null;
    const isLang = filePath ? this.isLanguageFile(filePath) : false;
    const relPath = filePath ? vscode.workspace.asRelativePath(filePath, false).replace(/\\/g, '/') : null;

    this.postMessage({
      command: 'activeEditorChanged',
      payload: { filePath: relPath, isLanguageFile: isLang },
    });

    if (!rescan) {
      this.lastActiveFilePath = filePath;
      return;
    }
    if (!this.followActiveEditor) return;
    if (this.scanMode !== 'current') return;
    if (!filePath || isLang) return;
    if (filePath === this.lastActiveFilePath) return;
    if (!this.platformReady) return;

    this.lastActiveFilePath = filePath;
    void this.handleScanCurrentFile();
  }

  private postScanModeState(): void {
    this.postMessage({
      command: 'scanModeState',
      payload: {
        mode: this.scanMode,
        followActiveEditor: this.followActiveEditor,
        currentFilePath: this.lastActiveFilePath
          ? vscode.workspace.asRelativePath(this.lastActiveFilePath, false).replace(/\\/g, '/')
          : null,
      },
    });
  }

  /** 判断给定绝对路径是否为已配置的语言资源文件（避免切到 zh-CN.json 时触发扫描） */
  private isLanguageFile(absPath: string): boolean {
    const { configManager } = this.deps;
    const rootPath = this.deps.getRootPath();
    const norm = absPath.replace(/\\/g, '/').toLowerCase();

    const candidates: string[] = [];
    for (const p of configManager.localesPaths) candidates.push(p);
    for (const m of configManager.languageMappings) candidates.push(m.filePath);
    for (const f of configManager.keyMappingFiles ?? []) candidates.push(f);

    for (const rel of candidates) {
      if (!rel) continue;
      const abs = path.isAbsolute(rel) ? rel : (rootPath ? path.join(rootPath, rel) : rel);
      if (abs.replace(/\\/g, '/').toLowerCase() === norm) return true;
    }
    return false;
  }

  private async handleRefreshData(): Promise<void> {
    this.deps.refreshCallback();
    this.handleGetPlatformStatus();
    this.handleGetConfig();
    if (this.platformReady) {
      this.handleGetLocaleData();
      this.handleGetLanguageStatus();
    }
    this.postMessage({ command: 'dataRefreshed' });
  }

  private buildReplaceContext(rootPath: string) {
    const { configManager, adapter } = this.deps;
    const userFunctionName = configManager.functionName;
    const effectiveFunctionName =
      adapter && (!userFunctionName || userFunctionName === 't')
        ? adapter.defaultFunctionName
        : userFunctionName;
    return {
      functionName: effectiveFunctionName,
      quoteChar: configManager.quoteChar,
      autoGenerateKeyFromText: configManager.autoGenerateKeyFromText,
      autoGenerateKeyPrefix: configManager.autoGenerateKeyPrefix,
      autoTranslateAllLanguages: configManager.autoTranslateAllLanguages,
      languageMappings: configManager.languageMappings,
      sourceLanguage: configManager.sourceLanguage,
      rootPath,
    };
  }

  /**
   * 给 scanResult.existing 中每个 I18nMatch 补充 existingValue（默认语言文件中的当前译文）
   */
  private enrichExistingValues<T extends { existing: Array<{ key: string; existingValue?: string }> }>(
    result: T
  ): T {
    const { localeStore, configManager } = this.deps;
    const defaultLocale = configManager.defaultLocale;
    const sourceLanguage = configManager.sourceLanguage;
    const allCodes = localeStore.getAllLanguageCodes();
    const lookup = (key: string): string => {
      const flat = localeStore.getValue(key);
      if (flat) return flat;
      const byDefault = localeStore.getNestedValue(defaultLocale, key);
      if (byDefault) return byDefault;
      const bySource = sourceLanguage ? localeStore.getNestedValue(sourceLanguage, key) : undefined;
      if (bySource) return bySource;
      for (const c of allCodes) {
        const v = localeStore.getNestedValue(c, key);
        if (v) return v;
      }
      return '';
    };
    return {
      ...result,
      existing: result.existing.map((m) => ({
        ...m,
        existingValue: lookup(m.key),
      })),
    };
  }
}
