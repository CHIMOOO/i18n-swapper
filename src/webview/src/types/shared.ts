/**
 * WebView 侧的共享类型定义
 * 与扩展侧 core/types.ts 保持对齐但独立定义（避免 WebView 引用 Node 类型）
 */

export type FlatLocaleData = Record<string, string>;

export type PlatformId = 'web' | 'android' | 'ios';

export interface I18nMatch {
  fullMatch: string;
  key: string;
  startOffset: number;
  endOffset: number;
  keyStartOffset: number;
  keyEndOffset: number;
  quoteChar: string;
  functionName: string;
  /** 该 key 在默认语言文件中的当前译文（由扩展端在推送前 enrich） */
  existingValue?: string;
}

export interface ScanResultItem {
  text: string;
  i18nKey: string;
  start: number;
  end: number;
  filePath?: string;
  selected: boolean;
  translationValue?: string;
  i18nFile?: string;
}

export const LANGUAGE_NAMES: Record<string, string> = {
  'zh': '中文',
  'zh-hans': '简体中文',
  'zh-hant': '繁体中文',
  'en': '英文',
  'ja': '日文',
  'ko': '韩文',
  'fr': '法文',
  'de': '德文',
  'es': '西班牙文',
  'pt': '葡萄牙文',
  'pt-BR': '巴西葡萄牙文',
  'ru': '俄文',
  'ar': '阿拉伯文',
  'th': '泰文',
  'vi': '越南文',
  'id': '印尼文',
  'tr': '土耳其文',
  'it': '意大利文',
  'ms': '马来文',
  'fil': '菲律宾文',
};
