/**
 * 统一配置管理器
 * 从 VSCode settings.json 读写配置，区分用户级和项目级
 */
import * as vscode from 'vscode';
import type {
  I18nSwapperConfig,
  DecorationStyle,
  QuoteType,
  TextStyle,
  MissingKeyStyle,
  TranslationApiConfig,
  LanguageMapping,
  DefaultRepositories,
} from './types';
import type { MatchPattern, PlatformId } from '../types';
import { DEFAULT_CONFIG } from './defaults';

const SECTION = 'i18n-swapper';

export class ConfigManager {
  private _onDidChange = new vscode.EventEmitter<void>();
  /** 配置变更事件 */
  readonly onDidChange = this._onDidChange.event;

  private disposable: vscode.Disposable;

  constructor() {
    this.disposable = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(SECTION)) {
        this._onDidChange.fire();
      }
    });
  }

  private get config(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration(SECTION);
  }

  // ── 平台 ──────────────────────────────────────────

  get platform(): PlatformId | 'auto' {
    return this.config.get('platform', DEFAULT_CONFIG.platform);
  }

  // ── 基础配置 ──────────────────────────────────────

  get localesPaths(): string[] {
    return this.config.get('localesPaths', DEFAULT_CONFIG.localesPaths);
  }

  async setLocalesPaths(paths: string[]): Promise<void> {
    await this.config.update('localesPaths', paths, vscode.ConfigurationTarget.Workspace);
  }

  get functionName(): string {
    return this.config.get('functionName', DEFAULT_CONFIG.functionName);
  }

  get quoteType(): QuoteType {
    return this.config.get('quoteType', DEFAULT_CONFIG.quoteType);
  }

  get quoteChar(): string {
    return this.quoteType === 'single' ? "'" : '"';
  }

  get defaultLocale(): string {
    return this.config.get('defaultLocale', DEFAULT_CONFIG.defaultLocale);
  }

  // ── 识别配置 ──────────────────────────────────────

  get identifyFunctionNames(): string[] {
    return this.config.get('identifyFunctionNames', DEFAULT_CONFIG.identifyFunctionNames);
  }

  get matchPatterns(): MatchPattern[] {
    return this.config.get('matchPatterns', DEFAULT_CONFIG.matchPatterns);
  }

  // ── 扫描配置 ──────────────────────────────────────

  get scanPatterns(): string[] {
    return this.config.get('scanPatterns', DEFAULT_CONFIG.scanPatterns);
  }

  get excludeFiles(): string[] {
    return this.config.get('excludeFiles', DEFAULT_CONFIG.excludeFiles);
  }

  get includeFiles(): string[] {
    return this.config.get('includeFiles', DEFAULT_CONFIG.includeFiles);
  }

  // ── 显示配置 ──────────────────────────────────────

  get decorationStyle(): DecorationStyle {
    return this.config.get('decorationStyle', DEFAULT_CONFIG.decorationStyle);
  }

  get showFullFormInEditMode(): boolean {
    return this.config.get('showFullFormInEditMode', DEFAULT_CONFIG.showFullFormInEditMode);
  }

  get suffixStyle(): TextStyle {
    return this.config.get('suffixStyle', DEFAULT_CONFIG.suffixStyle);
  }

  get inlineStyle(): TextStyle {
    return this.config.get('inlineStyle', DEFAULT_CONFIG.inlineStyle);
  }

  get missingKeyStyle(): MissingKeyStyle {
    return this.config.get('missingKeyStyle', DEFAULT_CONFIG.missingKeyStyle);
  }

  // ── 翻译配置 ──────────────────────────────────────

  get tencentTranslation(): TranslationApiConfig {
    return {
      apiKey: this.config.get('tencentTranslation.apiKey', DEFAULT_CONFIG.tencentTranslation.apiKey),
      apiSecret: this.config.get('tencentTranslation.apiSecret', DEFAULT_CONFIG.tencentTranslation.apiSecret),
      region: this.config.get('tencentTranslation.region', DEFAULT_CONFIG.tencentTranslation.region),
      sourceLanguage: this.config.get('tencentTranslation.sourceLanguage', DEFAULT_CONFIG.tencentTranslation.sourceLanguage),
      languageMappings: this.config.get('tencentTranslation.languageMappings', DEFAULT_CONFIG.tencentTranslation.languageMappings),
    };
  }

  get languageMappings(): LanguageMapping[] {
    return this.tencentTranslation.languageMappings;
  }

  get sourceLanguage(): string {
    return this.tencentTranslation.sourceLanguage;
  }

  // ── 自动化配置 ────────────────────────────────────

  get autoGenerateKeyFromText(): boolean {
    return this.config.get('autoGenerateKeyFromText', DEFAULT_CONFIG.autoGenerateKeyFromText);
  }

  get autoGenerateKeyPrefix(): string {
    return this.config.get('autoGenerateKeyPrefix', DEFAULT_CONFIG.autoGenerateKeyPrefix);
  }

  get autoTranslateAllLanguages(): boolean {
    return this.config.get('autoTranslateAllLanguages', DEFAULT_CONFIG.autoTranslateAllLanguages);
  }

  // ── 默认仓库 ──────────────────────────────────────

  get defaultRepositories(): DefaultRepositories {
    return this.config.get('defaultRepositories', DEFAULT_CONFIG.defaultRepositories);
  }

  get localeResSubPaths(): string[] {
    return this.config.get('localeResSubPaths', DEFAULT_CONFIG.localeResSubPaths);
  }

  get keyMappingFiles(): string[] {
    return this.config.get('keyMappingFiles', DEFAULT_CONFIG.keyMappingFiles);
  }

  // ── 行为配置 ──────────────────────────────────────

  get skipPrompt(): string[] {
    return this.config.get('skipPrompt', DEFAULT_CONFIG.skipPrompt);
  }

  // ── 快照方法 ──────────────────────────────────────

  /** 获取当前完整配置快照 */
  getSnapshot(): I18nSwapperConfig {
    return {
      platform: this.platform,
      localesPaths: this.localesPaths,
      functionName: this.functionName,
      quoteType: this.quoteType,
      defaultLocale: this.defaultLocale,
      identifyFunctionNames: this.identifyFunctionNames,
      matchPatterns: this.matchPatterns,
      scanPatterns: this.scanPatterns,
      excludeFiles: this.excludeFiles,
      includeFiles: this.includeFiles,
      decorationStyle: this.decorationStyle,
      showFullFormInEditMode: this.showFullFormInEditMode,
      suffixStyle: this.suffixStyle,
      inlineStyle: this.inlineStyle,
      missingKeyStyle: this.missingKeyStyle,
      tencentTranslation: this.tencentTranslation,
      autoGenerateKeyFromText: this.autoGenerateKeyFromText,
      autoGenerateKeyPrefix: this.autoGenerateKeyPrefix,
      autoTranslateAllLanguages: this.autoTranslateAllLanguages,
      defaultRepositories: this.defaultRepositories,
      localeResSubPaths: this.localeResSubPaths,
      keyMappingFiles: this.keyMappingFiles,
      skipPrompt: this.skipPrompt,
    };
  }

  /** 通用的配置更新方法 */
  async update(key: string, value: unknown, target = vscode.ConfigurationTarget.Workspace): Promise<void> {
    await this.config.update(key, value, target);
  }

  /** 数组追加（去重） */
  async pushArrayItem(key: string, value: string): Promise<boolean> {
    const current = this.config.get<string[]>(key, []);
    if (!Array.isArray(current)) return false;
    if (current.includes(value)) return false;
    await this.update(key, [...current, value]);
    return true;
  }

  /** 数组移除 */
  async removeArrayItem(key: string, value: string): Promise<boolean> {
    const current = this.config.get<string[]>(key, []);
    if (!Array.isArray(current)) return false;
    const next = current.filter((v) => v !== value);
    if (next.length === current.length) return false;
    await this.update(key, next);
    return true;
  }

  /** 设置语言映射数组 */
  async setLanguageMappings(mappings: LanguageMapping[]): Promise<void> {
    await this.update('tencentTranslation.languageMappings', mappings);
  }

  dispose(): void {
    this.disposable.dispose();
    this._onDidChange.dispose();
  }
}
