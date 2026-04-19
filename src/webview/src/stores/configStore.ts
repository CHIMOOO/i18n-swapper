/**
 * 配置状态管理
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useVscodeApi } from '../composables/useVscodeApi';
import type {
  ConfigDataPayload,
  PlatformStatusPayload,
  TextStylePayload,
  MissingKeyStylePayload,
  MatchPatternPayload,
  DefaultRepositoriesPayload,
  PickPathPayload,
  TestApiResultPayload,
} from '../types/messages';

const DEFAULT_TEXT_STYLE: TextStylePayload = {
  color: '#999999',
  fontSize: '1em',
  fontWeight: 'normal',
  fontStyle: 'normal',
  margin: '0 0 0 4px',
};

const DEFAULT_MISSING_KEY_STYLE: MissingKeyStylePayload = {
  borderWidth: '1px',
  borderStyle: 'dashed',
  borderColor: '#ff6b6b',
  borderSpacing: '2px',
};

const DEFAULT_REPOS: DefaultRepositoriesPayload = { web: '', ios: '', android: '' };

export const useConfigStore = defineStore('config', () => {
  const { postMessage, onMessage } = useVscodeApi();

  // ── 平台 ──────────────────────────────────────
  const platform = ref<string>('auto');
  const platformReady = ref(false);
  const platformName = ref<string>();

  // ── 基础 ──────────────────────────────────────
  const localesPaths = ref<string[]>([]);
  const functionName = ref('t');
  const quoteType = ref<'single' | 'double'>('single');
  const defaultLocale = ref('zh-CN');

  // ── 识别 ──────────────────────────────────────
  const identifyFunctionNames = ref<string[]>(['t', '$t']);
  const matchPatterns = ref<MatchPatternPayload[]>([]);

  // ── 扫描 ──────────────────────────────────────
  const scanPatterns = ref<string[]>([]);
  const excludeFiles = ref<string[]>([]);
  const includeFiles = ref<string[]>([]);

  // ── 装饰 ──────────────────────────────────────
  const decorationStyle = ref<'suffix' | 'inline'>('inline');
  const showFullFormInEditMode = ref(true);
  const suffixStyle = ref<TextStylePayload>({ ...DEFAULT_TEXT_STYLE });
  const inlineStyle = ref<TextStylePayload>({ ...DEFAULT_TEXT_STYLE });
  const missingKeyStyle = ref<MissingKeyStylePayload>({ ...DEFAULT_MISSING_KEY_STYLE });

  // ── 翻译 API ──────────────────────────────────
  const apiKey = ref('');
  const apiSecret = ref('');
  const apiRegion = ref('ap-guangzhou');
  const sourceLanguage = ref('zh');
  const languageMappings = ref<Array<{ languageCode: string; filePath: string }>>([]);
  const translationConfigured = ref(false);

  // ── 自动化 ────────────────────────────────────
  const autoGenerateKeyFromText = ref(true);
  const autoGenerateKeyPrefix = ref('');
  const autoTranslateAllLanguages = ref(true);

  // ── 平台扩展 ──────────────────────────────────
  const defaultRepositories = ref<DefaultRepositoriesPayload>({ ...DEFAULT_REPOS });
  const localeResSubPaths = ref<string[]>([]);
  const keyMappingFiles = ref<string[]>([]);

  // ── 高级 ──────────────────────────────────────
  const skipPrompt = ref<string[]>([]);

  // ── 状态 ──────────────────────────────────────
  const loaded = ref(false);
  const lastTestResult = ref<TestApiResultPayload | null>(null);

  const hasLocalesPaths = computed(() => localesPaths.value.length > 0);
  const hasLanguageMappings = computed(() => languageMappings.value.length > 0);

  function applyConfig(payload: ConfigDataPayload) {
    platform.value = payload.platform;
    localesPaths.value = payload.localesPaths ?? [];
    functionName.value = payload.functionName ?? 't';
    quoteType.value = payload.quoteType ?? 'single';
    defaultLocale.value = payload.defaultLocale ?? 'zh-CN';

    identifyFunctionNames.value = payload.identifyFunctionNames ?? [];
    matchPatterns.value = payload.matchPatterns ?? [];

    scanPatterns.value = payload.scanPatterns ?? [];
    excludeFiles.value = payload.excludeFiles ?? [];
    includeFiles.value = payload.includeFiles ?? [];

    decorationStyle.value = payload.decorationStyle ?? 'inline';
    showFullFormInEditMode.value = payload.showFullFormInEditMode ?? true;
    suffixStyle.value = payload.suffixStyle ?? { ...DEFAULT_TEXT_STYLE };
    inlineStyle.value = payload.inlineStyle ?? { ...DEFAULT_TEXT_STYLE };
    missingKeyStyle.value = payload.missingKeyStyle ?? { ...DEFAULT_MISSING_KEY_STYLE };

    apiKey.value = payload.apiKey ?? '';
    apiSecret.value = payload.apiSecret ?? '';
    apiRegion.value = payload.apiRegion ?? 'ap-guangzhou';
    sourceLanguage.value = payload.sourceLanguage ?? 'zh';
    languageMappings.value = payload.languageMappings ?? [];
    translationConfigured.value = payload.translationConfigured ?? false;

    autoGenerateKeyFromText.value = payload.autoGenerateKeyFromText ?? true;
    autoGenerateKeyPrefix.value = payload.autoGenerateKeyPrefix ?? '';
    autoTranslateAllLanguages.value = payload.autoTranslateAllLanguages ?? true;

    defaultRepositories.value = payload.defaultRepositories ?? { ...DEFAULT_REPOS };
    localeResSubPaths.value = payload.localeResSubPaths ?? [];
    keyMappingFiles.value = payload.keyMappingFiles ?? [];

    skipPrompt.value = payload.skipPrompt ?? [];

    loaded.value = true;
  }

  function applyPlatformStatus(payload: PlatformStatusPayload) {
    platformReady.value = payload.platformReady;
    platformName.value = payload.platformName;
  }

  // ── 通用动作 ──────────────────────────────────
  function fetchConfig() {
    postMessage({ command: 'getConfig' });
  }

  function updateConfig(key: string, value: unknown) {
    postMessage({ command: 'updateConfig', payload: { key, value } });
  }

  function addArrayItem(key: string, value: string) {
    postMessage({ command: 'configArrayAdd', payload: { key, value } });
  }

  function removeArrayItem(key: string, value: string) {
    postMessage({ command: 'configArrayRemove', payload: { key, value } });
  }

  function setLocalesPaths(paths: string[]) {
    postMessage({ command: 'setLocalesPaths', payload: { paths } });
  }

  function selectLocaleFiles() {
    postMessage({ command: 'selectLocaleFiles' });
  }

  function pickPathForConfig(payload: PickPathPayload) {
    postMessage({ command: 'pickPathForConfig', payload });
  }

  function setLanguageMappings(mappings: Array<{ languageCode: string; filePath: string }>) {
    postMessage({ command: 'setLanguageMappings', payload: { mappings } });
  }

  function testTranslationApi() {
    lastTestResult.value = null;
    postMessage({ command: 'testTranslationApi' });
  }

  function openSettings(section?: string) {
    postMessage({ command: 'openSettings', payload: section ? { section } : undefined });
  }

  function switchPlatform() {
    postMessage({ command: 'switchPlatform' });
  }

  function discoverLocaleFiles() {
    postMessage({ command: 'discoverLocaleFiles' });
  }

  function initializeLocales() {
    postMessage({ command: 'initializeLocales' });
  }

  onMessage((msg) => {
    if (msg.command === 'configData') {
      applyConfig(msg.payload);
    } else if (msg.command === 'platformStatus') {
      applyPlatformStatus(msg.payload);
    } else if (msg.command === 'testApiResult') {
      lastTestResult.value = msg.payload;
    }
  });

  return {
    // state
    platform,
    platformReady,
    platformName,
    localesPaths,
    functionName,
    quoteType,
    defaultLocale,
    identifyFunctionNames,
    matchPatterns,
    scanPatterns,
    excludeFiles,
    includeFiles,
    decorationStyle,
    showFullFormInEditMode,
    suffixStyle,
    inlineStyle,
    missingKeyStyle,
    apiKey,
    apiSecret,
    apiRegion,
    sourceLanguage,
    languageMappings,
    translationConfigured,
    autoGenerateKeyFromText,
    autoGenerateKeyPrefix,
    autoTranslateAllLanguages,
    defaultRepositories,
    localeResSubPaths,
    keyMappingFiles,
    skipPrompt,
    loaded,
    lastTestResult,
    // computed
    hasLocalesPaths,
    hasLanguageMappings,
    // actions
    fetchConfig,
    updateConfig,
    addArrayItem,
    removeArrayItem,
    setLocalesPaths,
    selectLocaleFiles,
    pickPathForConfig,
    setLanguageMappings,
    testTranslationApi,
    openSettings,
    switchPlatform,
    discoverLocaleFiles,
    initializeLocales,
  };
});
