/**
 * 多语言状态 composable
 * 提供语言完成度、缺失键分析等计算属性
 */
import { computed } from 'vue';
import { useScanStore } from '../stores/scanStore';
import { LANGUAGE_NAMES } from '../types/shared';

export function useI18nStatus() {
  const scanStore = useScanStore();

  const overallProgress = computed(() => {
    const langs = scanStore.languages;
    if (langs.length === 0) return 0;
    const totalTranslated = langs.reduce((s, l) => s + l.translatedKeys, 0);
    const totalKeys = langs.reduce((s, l) => s + l.totalKeys, 0);
    return totalKeys > 0 ? Math.round((totalTranslated / totalKeys) * 100) : 0;
  });

  const languageProgress = computed(() =>
    scanStore.languages.map((lang) => ({
      ...lang,
      displayName: LANGUAGE_NAMES[lang.code] || LANGUAGE_NAMES[lang.code.split('-')[0]] || lang.code,
      progress: lang.totalKeys > 0 ? Math.round((lang.translatedKeys / lang.totalKeys) * 100) : 0,
      missingCount: lang.missingKeys.length,
    }))
  );

  const allMissingKeys = computed(() => {
    const missing = new Map<string, string[]>();
    for (const lang of scanStore.languages) {
      for (const key of lang.missingKeys) {
        const langs = missing.get(key) || [];
        langs.push(lang.code);
        missing.set(key, langs);
      }
    }
    return Array.from(missing.entries()).map(([key, langs]) => ({
      key,
      value: scanStore.flatData[key] || '',
      missingIn: langs,
    }));
  });

  return {
    overallProgress,
    languageProgress,
    allMissingKeys,
  };
}
