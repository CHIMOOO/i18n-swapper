/**
 * 配置状态管理
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useVscodeApi } from '../composables/useVscodeApi';
import type { ConfigDataPayload, PlatformStatusPayload } from '../types/messages';

export const useConfigStore = defineStore('config', () => {
  const { postMessage, onMessage } = useVscodeApi();

  const platform = ref<string>('auto');
  const localesPaths = ref<string[]>([]);
  const functionName = ref('t');
  const quoteType = ref<'single' | 'double'>('single');
  const defaultLocale = ref('zh-CN');
  const identifyFunctionNames = ref<string[]>(['t', '$t']);
  const scanPatterns = ref<string[]>([]);
  const excludeFiles = ref<string[]>([]);
  const decorationStyle = ref<'suffix' | 'inline'>('inline');
  const autoGenerateKeyFromText = ref(true);
  const autoTranslateAllLanguages = ref(true);
  const languageMappings = ref<Array<{ languageCode: string; filePath: string }>>([]);
  const translationConfigured = ref(false);
  const loaded = ref(false);

  const platformReady = ref(false);
  const platformName = ref<string>();

  const hasLocalesPaths = computed(() => localesPaths.value.length > 0);
  const hasLanguageMappings = computed(() => languageMappings.value.length > 0);

  function applyConfig(payload: ConfigDataPayload) {
    platform.value = payload.platform;
    localesPaths.value = payload.localesPaths;
    functionName.value = payload.functionName;
    quoteType.value = payload.quoteType;
    defaultLocale.value = payload.defaultLocale;
    identifyFunctionNames.value = payload.identifyFunctionNames;
    scanPatterns.value = payload.scanPatterns;
    excludeFiles.value = payload.excludeFiles;
    decorationStyle.value = payload.decorationStyle;
    autoGenerateKeyFromText.value = payload.autoGenerateKeyFromText;
    autoTranslateAllLanguages.value = payload.autoTranslateAllLanguages;
    languageMappings.value = payload.languageMappings;
    translationConfigured.value = payload.translationConfigured;
    loaded.value = true;
  }

  function applyPlatformStatus(payload: PlatformStatusPayload) {
    platformReady.value = payload.platformReady;
    platformName.value = payload.platformName;
  }

  function fetchConfig() {
    postMessage({ command: 'getConfig' });
  }

  function updateConfig(key: string, value: unknown) {
    postMessage({ command: 'updateConfig', payload: { key, value } });
  }

  function selectLocaleFiles() {
    postMessage({ command: 'selectLocaleFiles' });
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
    }
  });

  return {
    platform,
    localesPaths,
    functionName,
    quoteType,
    defaultLocale,
    identifyFunctionNames,
    scanPatterns,
    excludeFiles,
    decorationStyle,
    autoGenerateKeyFromText,
    autoTranslateAllLanguages,
    languageMappings,
    translationConfigured,
    loaded,
    platformReady,
    platformName,
    hasLocalesPaths,
    hasLanguageMappings,
    fetchConfig,
    updateConfig,
    selectLocaleFiles,
    openSettings,
    switchPlatform,
    discoverLocaleFiles,
    initializeLocales,
  };
});
