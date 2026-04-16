/**
 * WebView ↔ Extension 消息类型定义
 * 双方共享的通信契约
 */

import type { ScanResultItem, I18nMatch, FlatLocaleData, PlatformId, LANGUAGE_NAMES } from './shared';

// ─── WebView → Extension（请求） ────────────────────────

export type WebviewMessage =
  | { command: 'ready' }
  | { command: 'getConfig' }
  | { command: 'getLocaleData' }
  | { command: 'getLanguageStatus' }
  | { command: 'scanWorkspace' }
  | { command: 'scanCurrentFile' }
  | { command: 'replaceItem'; payload: ReplaceItemPayload }
  | { command: 'batchReplace'; payload: BatchReplacePayload }
  | { command: 'translateKey'; payload: TranslateKeyPayload }
  | { command: 'addTranslation'; payload: AddTranslationPayload }
  | { command: 'editTranslation'; payload: EditTranslationPayload }
  | { command: 'deleteKey'; payload: DeleteKeyPayload }
  | { command: 'searchKeys'; payload: SearchKeysPayload }
  | { command: 'openFile'; payload: OpenFilePayload }
  | { command: 'highlightText'; payload: HighlightTextPayload }
  | { command: 'updateConfig'; payload: UpdateConfigPayload }
  | { command: 'setLocalesPaths'; payload: SetLocalesPathsPayload }
  | { command: 'openSettings'; payload?: OpenSettingsPayload }
  | { command: 'selectLocaleFiles' }
  | { command: 'copyToClipboard'; payload: CopyPayload }
  | { command: 'refreshData' }
  | { command: 'switchPlatform' }
  | { command: 'discoverLocaleFiles' }
  | { command: 'initializeLocales' };

// ─── Extension → WebView（响应/推送） ───────────────────

export type ExtensionMessage =
  | { command: 'configData'; payload: ConfigDataPayload }
  | { command: 'platformStatus'; payload: PlatformStatusPayload }
  | { command: 'localeData'; payload: LocaleDataPayload }
  | { command: 'languageStatus'; payload: LanguageStatusPayload }
  | { command: 'scanResult'; payload: ScanResultPayload }
  | { command: 'scanProgress'; payload: ScanProgressPayload }
  | { command: 'replaceResult'; payload: ReplaceResultPayload }
  | { command: 'translateResult'; payload: TranslateResultPayload }
  | { command: 'searchResult'; payload: SearchResultPayload }
  | { command: 'error'; payload: ErrorPayload }
  | { command: 'info'; payload: InfoPayload }
  | { command: 'dataRefreshed' };

// ─── 消息负载类型 ───────────────────────────────────────

export interface ReplaceItemPayload {
  filePath: string;
  start: number;
  end: number;
  text: string;
  i18nKey: string;
}

export interface BatchReplacePayload {
  filePath: string;
  items: Array<{
    start: number;
    end: number;
    text: string;
    key: string;
  }>;
}

export interface TranslateKeyPayload {
  key: string;
  text: string;
  targetLanguages?: string[];
}

export interface AddTranslationPayload {
  key: string;
  value: string;
  languageCode?: string;
}

export interface EditTranslationPayload {
  key: string;
  value: string;
  languageCode: string;
  filePath: string;
}

export interface DeleteKeyPayload {
  key: string;
}

export interface SearchKeysPayload {
  query: string;
  searchIn: 'key' | 'value' | 'both';
}

export interface OpenFilePayload {
  filePath: string;
  line?: number;
  column?: number;
}

export interface HighlightTextPayload {
  filePath: string;
  start: number;
  end: number;
}

export interface UpdateConfigPayload {
  key: string;
  value: unknown;
}

export interface SetLocalesPathsPayload {
  paths: string[];
}

export interface OpenSettingsPayload {
  section?: string;
}

export interface CopyPayload {
  text: string;
}

// ─── 响应负载类型 ───────────────────────────────────────

export interface ConfigDataPayload {
  platform: PlatformId | 'auto';
  localesPaths: string[];
  functionName: string;
  quoteType: 'single' | 'double';
  defaultLocale: string;
  identifyFunctionNames: string[];
  scanPatterns: string[];
  excludeFiles: string[];
  decorationStyle: 'suffix' | 'inline';
  autoGenerateKeyFromText: boolean;
  autoTranslateAllLanguages: boolean;
  languageMappings: Array<{ languageCode: string; filePath: string }>;
  translationConfigured: boolean;
}

export interface LocaleDataPayload {
  flatData: FlatLocaleData;
  keyCount: number;
  languageCodes: string[];
}

export interface LanguageStatusPayload {
  languages: Array<{
    code: string;
    name: string;
    filePath: string;
    totalKeys: number;
    translatedKeys: number;
    missingKeys: string[];
  }>;
  sourceKeys: string[];
}

export interface ScanResultPayload {
  filePath: string;
  fileName: string;
  existing: I18nMatch[];
  pending: ScanResultItem[];
}

export interface ScanProgressPayload {
  current: number;
  total: number;
  currentFile: string;
  phase: 'scanning' | 'complete';
}

export interface ReplaceResultPayload {
  success: boolean;
  count: number;
  message: string;
}

export interface TranslateResultPayload {
  key: string;
  results: Array<{
    languageCode: string;
    success: boolean;
    text?: string;
    error?: string;
  }>;
}

export interface SearchResultPayload {
  results: Array<{
    key: string;
    value: string;
    translations: Record<string, string>;
  }>;
  total: number;
}

export interface ErrorPayload {
  message: string;
  details?: string;
}

export interface InfoPayload {
  message: string;
}

export interface PlatformStatusPayload {
  platformReady: boolean;
  hasLocalesPaths: boolean;
  platformName?: string;
}
