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
  localeFileIO: LocaleFileIO;
  keyResolver: KeyResolver;
  textReplacer: TextReplacer;
  translationService: TranslationService;
  workspaceScanner: WorkspaceScanner;
  adapter: IPlatformAdapter;
  getRootPath: () => string | undefined;
  refreshCallback: () => void;
}

type PostMessage = (message: unknown) => void;

export class PanelMessageHandler {
  constructor(
    private deps: PanelDependencies,
    private postMessage: PostMessage
  ) {}

  updatePostMessage(fn: PostMessage): void {
    this.postMessage = fn;
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
        case 'scanWorkspace':
          await this.handleScanWorkspace();
          break;
        case 'scanCurrentFile':
          await this.handleScanCurrentFile();
          break;
        case 'replaceItem':
          await this.handleReplaceItem(message.payload as any);
          break;
        case 'batchReplace':
          await this.handleBatchReplace(message.payload as any);
          break;
        case 'translateKey':
          await this.handleTranslateKey(message.payload as any);
          break;
        case 'addTranslation':
          await this.handleAddTranslation(message.payload as any);
          break;
        case 'editTranslation':
          await this.handleEditTranslation(message.payload as any);
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
        case 'selectLocaleFiles':
          await this.handleSelectLocaleFiles();
          break;
        case 'openSettings':
          await this.handleOpenSettings(message.payload as any);
          break;
        case 'copyToClipboard':
          await this.handleCopyToClipboard(message.payload as any);
          break;
        case 'refreshData':
          await this.handleRefreshData();
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
    this.handleGetConfig();
    this.handleGetLocaleData();
    this.handleGetLanguageStatus();
  }

  private handleGetConfig(): void {
    const { configManager, translationService } = this.deps;
    this.postMessage({
      command: 'configData',
      payload: {
        platform: configManager.platform,
        localesPaths: configManager.localesPaths,
        functionName: configManager.functionName,
        quoteType: configManager.quoteType,
        defaultLocale: configManager.defaultLocale,
        identifyFunctionNames: configManager.identifyFunctionNames,
        scanPatterns: configManager.scanPatterns,
        excludeFiles: configManager.excludeFiles,
        decorationStyle: configManager.decorationStyle,
        autoGenerateKeyFromText: configManager.autoGenerateKeyFromText,
        autoTranslateAllLanguages: configManager.autoTranslateAllLanguages,
        languageMappings: configManager.languageMappings,
        translationConfigured: translationService.isConfigured,
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
      this.postMessage({ command: 'error', payload: { message: '未找到工作区' } });
      return;
    }

    const { configManager, adapter, workspaceScanner } = this.deps;
    const extensions = adapter.supportedExtensions.map((ext) => `.${ext}`);

    const results = await workspaceScanner.scanWorkspace(
      rootPath,
      extensions,
      configManager.excludeFiles,
      configManager.includeFiles,
      (progress) => {
        this.postMessage({ command: 'scanProgress', payload: progress });
      }
    );

    for (const result of results) {
      this.postMessage({ command: 'scanResult', payload: result });
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
    const result = await workspaceScanner.scanSingleFile(editor.document.uri.fsPath);

    if (result) {
      this.postMessage({ command: 'scanResult', payload: result });
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

    const count = await textReplacer.batchReplace(document, [
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
    const count = await textReplacer.batchReplace(document, payload.items, ctx);

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
          await localeFileIO.saveTranslation(filePath, payload.key, result.text);
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

    const success = await localeFileIO.saveTranslation(filePath, payload.key, payload.value);
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

    const success = await localeFileIO.saveTranslation(absolutePath, payload.key, payload.value);
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
    await vscode.commands.executeCommand('i18n-swapper.highlightText', payload);
  }

  private async handleUpdateConfig(payload: { key: string; value: unknown }): Promise<void> {
    await this.deps.configManager.update(payload.key, payload.value);
    this.handleGetConfig();
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

  private async handleRefreshData(): Promise<void> {
    this.deps.refreshCallback();
    this.handleGetConfig();
    this.handleGetLocaleData();
    this.handleGetLanguageStatus();
    this.postMessage({ command: 'dataRefreshed' });
  }

  private buildReplaceContext(rootPath: string) {
    const { configManager } = this.deps;
    return {
      functionName: configManager.functionName,
      quoteChar: configManager.quoteChar,
      autoGenerateKeyFromText: configManager.autoGenerateKeyFromText,
      autoGenerateKeyPrefix: configManager.autoGenerateKeyPrefix,
      autoTranslateAllLanguages: configManager.autoTranslateAllLanguages,
      languageMappings: configManager.languageMappings,
      sourceLanguage: configManager.sourceLanguage,
      rootPath,
    };
  }
}
