/**
 * 扫描数据状态管理
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useVscodeApi } from '../composables/useVscodeApi';
import type {
  ScanResultPayload,
  ScanProgressPayload,
  LocaleDataPayload,
  LanguageStatusPayload,
  SearchResultPayload,
} from '../types/messages';
import type { FlatLocaleData } from '../types/shared';

export interface FileScanResult {
  filePath: string;
  fileName: string;
  existing: Array<{ key: string; fullMatch: string; startOffset: number; endOffset: number }>;
  pending: Array<{
    text: string;
    i18nKey: string;
    start: number;
    end: number;
    filePath?: string;
    selected: boolean;
  }>;
}

export interface LanguageInfo {
  code: string;
  name: string;
  filePath: string;
  totalKeys: number;
  translatedKeys: number;
  missingKeys: string[];
}

export const useScanStore = defineStore('scan', () => {
  const { postMessage, onMessage } = useVscodeApi();

  // locale data
  const flatData = ref<FlatLocaleData>({});
  const keyCount = ref(0);
  const languageCodes = ref<string[]>([]);

  // language status
  const languages = ref<LanguageInfo[]>([]);
  const sourceKeys = ref<string[]>([]);

  // scan state
  const scanResults = ref<FileScanResult[]>([]);
  const scanning = ref(false);
  const scanProgress = ref<ScanProgressPayload | null>(null);
  const scanMode = ref<'current' | 'all'>('current');
  const followActiveEditor = ref(true);
  const currentFilePath = ref<string | null>(null);
  const currentFileIsLanguageFile = ref(false);

  // search
  const searchResults = ref<Array<{ key: string; value: string; translations: Record<string, string> }>>([]);
  const searchTotal = ref(0);

  // filters
  const filterText = ref('');
  const showPendingOnly = ref(false);

  const totalPending = computed(() =>
    scanResults.value.reduce((sum, f) => sum + f.pending.length, 0)
  );

  const totalExisting = computed(() =>
    scanResults.value.reduce((sum, f) => sum + f.existing.length, 0)
  );

  const filteredResults = computed(() => {
    let results = scanResults.value;
    if (showPendingOnly.value) {
      results = results.filter((f) => f.pending.length > 0);
    }
    if (filterText.value) {
      const q = filterText.value.toLowerCase();
      results = results.filter(
        (f) =>
          f.fileName.toLowerCase().includes(q) ||
          f.filePath.toLowerCase().includes(q) ||
          f.pending.some((p) => p.text.includes(q) || p.i18nKey.toLowerCase().includes(q))
      );
    }
    return results;
  });

  function applyLocaleData(payload: LocaleDataPayload) {
    flatData.value = payload.flatData;
    keyCount.value = payload.keyCount;
    languageCodes.value = payload.languageCodes;
  }

  function applyLanguageStatus(payload: LanguageStatusPayload) {
    languages.value = payload.languages;
    sourceKeys.value = payload.sourceKeys;
  }

  function addScanResult(payload: ScanResultPayload) {
    const existing = scanResults.value.findIndex((r) => r.filePath === payload.filePath);
    const entry: FileScanResult = {
      filePath: payload.filePath,
      fileName: payload.fileName,
      existing: payload.existing.map((e) => ({
        key: e.key,
        fullMatch: e.fullMatch,
        startOffset: e.startOffset,
        endOffset: e.endOffset,
      })),
      pending: payload.pending.map((p) => ({
        text: p.text,
        i18nKey: p.i18nKey,
        start: p.start,
        end: p.end,
        filePath: p.filePath,
        selected: false,
      })),
    };

    if (existing >= 0) {
      scanResults.value[existing] = entry;
    } else {
      scanResults.value.push(entry);
    }
  }

  function scanWorkspace() {
    scanResults.value = [];
    scanning.value = true;
    scanProgress.value = null;
    postMessage({ command: 'scanWorkspace' });
  }

  function scanCurrentFile() {
    scanning.value = true;
    postMessage({ command: 'scanCurrentFile' });
  }

  function setScanMode(mode: 'current' | 'all') {
    if (scanMode.value === mode) return;
    scanMode.value = mode;
    if (mode === 'all') {
      scanResults.value = [];
    }
    postMessage({ command: 'setScanMode', payload: { mode } });
  }

  function setFollowActiveEditor(enabled: boolean) {
    followActiveEditor.value = enabled;
    postMessage({ command: 'setFollowActiveEditor', payload: { enabled } });
  }

  function updateItemKey(fileIndex: number, itemIndex: number, key: string) {
    const file = scanResults.value[fileIndex];
    if (file && file.pending[itemIndex]) {
      file.pending[itemIndex].i18nKey = key;
    }
  }

  function translateScanItem(item: FileScanResult['pending'][0]) {
    if (!item.i18nKey || !item.text) return;
    postMessage({
      command: 'translateScanItem',
      payload: { key: item.i18nKey, text: item.text },
    });
  }

  function replaceItem(filePath: string, item: FileScanResult['pending'][0]) {
    if (!item.i18nKey) return;
    postMessage({
      command: 'replaceItem',
      payload: {
        filePath,
        start: item.start,
        end: item.end,
        text: item.text,
        i18nKey: item.i18nKey,
      },
    });
  }

  function batchReplace(filePath: string, items: FileScanResult['pending']) {
    const validItems = items.filter((i) => i.i18nKey && i.selected);
    if (validItems.length === 0) return;

    postMessage({
      command: 'batchReplace',
      payload: {
        filePath,
        items: validItems.map((i) => ({
          start: i.start,
          end: i.end,
          text: i.text,
          key: i.i18nKey,
        })),
      },
    });
  }

  function searchKeys(query: string, searchIn: 'key' | 'value' | 'both' = 'both') {
    postMessage({ command: 'searchKeys', payload: { query, searchIn } });
  }

  function translateKey(key: string, text: string, targetLanguages?: string[]) {
    postMessage({ command: 'translateKey', payload: { key, text, targetLanguages } });
  }

  function openFile(filePath: string, line?: number) {
    postMessage({ command: 'openFile', payload: { filePath, line } });
  }

  function highlightText(filePath: string, start: number, end: number) {
    postMessage({ command: 'highlightText', payload: { filePath, start, end } });
  }

  function copyToClipboard(text: string) {
    postMessage({ command: 'copyToClipboard', payload: { text } });
  }

  function refreshData() {
    postMessage({ command: 'refreshData' });
  }

  function fetchLocaleData() {
    postMessage({ command: 'getLocaleData' });
  }

  function fetchLanguageStatus() {
    postMessage({ command: 'getLanguageStatus' });
  }

  function toggleItemSelection(fileIndex: number, itemIndex: number) {
    const file = scanResults.value[fileIndex];
    if (file) {
      file.pending[itemIndex].selected = !file.pending[itemIndex].selected;
    }
  }

  function selectAllInFile(fileIndex: number, selected: boolean) {
    const file = scanResults.value[fileIndex];
    if (file) {
      file.pending.forEach((item) => { item.selected = selected; });
    }
  }

  onMessage((msg) => {
    switch (msg.command) {
      case 'localeData':
        applyLocaleData(msg.payload);
        break;
      case 'languageStatus':
        applyLanguageStatus(msg.payload);
        break;
      case 'scanResult':
        addScanResult(msg.payload);
        break;
      case 'scanProgress':
        scanProgress.value = msg.payload;
        if (msg.payload.phase === 'complete') {
          scanning.value = false;
        }
        break;
      case 'searchResult':
        searchResults.value = msg.payload.results;
        searchTotal.value = msg.payload.total;
        break;
      case 'replaceResult':
        if (msg.payload.success) {
          refreshData();
        }
        break;
      case 'activeEditorChanged':
        currentFilePath.value = msg.payload.filePath;
        currentFileIsLanguageFile.value = msg.payload.isLanguageFile;
        break;
      case 'scanModeState':
        scanMode.value = msg.payload.mode;
        followActiveEditor.value = msg.payload.followActiveEditor;
        if (msg.payload.currentFilePath !== undefined) {
          currentFilePath.value = msg.payload.currentFilePath;
        }
        break;
      case 'dataRefreshed':
        break;
    }
  });

  return {
    flatData,
    keyCount,
    languageCodes,
    languages,
    sourceKeys,
    scanResults,
    scanning,
    scanProgress,
    scanMode,
    followActiveEditor,
    currentFilePath,
    currentFileIsLanguageFile,
    searchResults,
    searchTotal,
    filterText,
    showPendingOnly,
    totalPending,
    totalExisting,
    filteredResults,
    scanWorkspace,
    scanCurrentFile,
    setScanMode,
    setFollowActiveEditor,
    updateItemKey,
    translateScanItem,
    replaceItem,
    batchReplace,
    searchKeys,
    translateKey,
    openFile,
    highlightText,
    copyToClipboard,
    refreshData,
    fetchLocaleData,
    fetchLanguageStatus,
    toggleItemSelection,
    selectAllInFile,
  };
});
