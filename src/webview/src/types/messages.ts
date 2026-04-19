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
  | { command: 'configArrayAdd'; payload: ConfigArrayOpPayload }
  | { command: 'configArrayRemove'; payload: ConfigArrayOpPayload }
  | { command: 'setLocalesPaths'; payload: SetLocalesPathsPayload }
  | { command: 'setLanguageMappings'; payload: SetLanguageMappingsPayload }
  | { command: 'openSettings'; payload?: OpenSettingsPayload }
  | { command: 'selectLocaleFiles' }
  | { command: 'pickPathForConfig'; payload: PickPathPayload }
  | { command: 'testTranslationApi' }
  | { command: 'copyToClipboard'; payload: CopyPayload }
  | { command: 'refreshData' }
  | { command: 'switchPlatform' }
  | { command: 'discoverLocaleFiles' }
  | { command: 'initializeLocales' }
  | { command: 'setScanMode'; payload: ScanModePayload }
  | { command: 'setFollowActiveEditor'; payload: FollowActiveEditorPayload }
  | { command: 'translateScanItem'; payload: TranslateScanItemPayload };

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
  | { command: 'testApiResult'; payload: TestApiResultPayload }
  | { command: 'activeEditorChanged'; payload: ActiveEditorChangedPayload }
  | { command: 'scanModeState'; payload: ScanModeStatePayload }
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

export interface ConfigArrayOpPayload {
  /** 配置项 key（如 'scanPatterns'、'excludeFiles'、'identifyFunctionNames'） */
  key: string;
  /** 数组元素值 */
  value: string;
}

export interface SetLocalesPathsPayload {
  paths: string[];
}

export interface SetLanguageMappingsPayload {
  mappings: Array<{ languageCode: string; filePath: string }>;
}

export interface OpenSettingsPayload {
  section?: string;
}

export interface CopyPayload {
  text: string;
}

/** 扫描模式：current=当前文件 / all=全工作区 */
export type ScanMode = 'current' | 'all';

export interface ScanModePayload {
  mode: ScanMode;
}

export interface FollowActiveEditorPayload {
  enabled: boolean;
}

export interface TranslateScanItemPayload {
  key: string;
  text: string;
}

export interface ActiveEditorChangedPayload {
  /** 工作区相对路径；无活动编辑器或非 file 协议时为 null */
  filePath: string | null;
  /** 是否被识别为语言资源文件（true 时面板不会自动重扫） */
  isLanguageFile: boolean;
}

export interface ScanModeStatePayload {
  mode: ScanMode;
  followActiveEditor: boolean;
  currentFilePath: string | null;
}

/** 让扩展端弹出文件/文件夹选择器，结果直接 push 到指定数组配置 */
export interface PickPathPayload {
  /** 目标配置 key */
  configKey: string;
  /** 选择类型：file 文件 / folder 文件夹 / fileMulti 多文件 */
  pickType: 'file' | 'folder' | 'fileMulti';
  /** 文件过滤器（pickType=file/fileMulti 时使用） */
  filters?: Record<string, string[]>;
  /** 选择按钮文案 */
  openLabel?: string;
}

// ─── 响应负载类型 ───────────────────────────────────────

export interface TextStylePayload {
  color: string;
  fontSize: string;
  fontWeight: string;
  fontStyle: string;
  margin: string;
}

export interface MissingKeyStylePayload {
  borderWidth: string;
  borderStyle: 'solid' | 'dashed' | 'dotted' | 'double';
  borderColor: string;
  borderSpacing: string;
}

export interface MatchPatternPayload {
  source: string;
  flags: string;
  keyGroup: number;
  fileTypes: string[];
}

export interface DefaultRepositoriesPayload {
  web: string;
  ios: string;
  android: string;
}

export interface ConfigDataPayload {
  // 平台
  platform: PlatformId | 'auto';

  // 基础
  localesPaths: string[];
  functionName: string;
  quoteType: 'single' | 'double';
  defaultLocale: string;

  // 识别
  identifyFunctionNames: string[];
  matchPatterns: MatchPatternPayload[];

  // 扫描
  scanPatterns: string[];
  excludeFiles: string[];
  includeFiles: string[];

  // 显示/装饰
  decorationStyle: 'suffix' | 'inline';
  showFullFormInEditMode: boolean;
  suffixStyle: TextStylePayload;
  inlineStyle: TextStylePayload;
  missingKeyStyle: MissingKeyStylePayload;

  // 翻译
  apiKey: string;
  apiSecret: string;
  apiRegion: string;
  sourceLanguage: string;
  languageMappings: Array<{ languageCode: string; filePath: string }>;
  translationConfigured: boolean;

  // 自动化
  autoGenerateKeyFromText: boolean;
  autoGenerateKeyPrefix: string;
  autoTranslateAllLanguages: boolean;

  // 平台扩展
  defaultRepositories: DefaultRepositoriesPayload;
  localeResSubPaths: string[];
  keyMappingFiles: string[];

  // 高级
  skipPrompt: string[];
}

export interface TestApiResultPayload {
  success: boolean;
  message: string;
  /** 测试翻译产物（成功时） */
  translated?: string;
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
