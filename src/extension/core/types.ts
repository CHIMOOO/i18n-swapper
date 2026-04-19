/**
 * 核心类型定义
 * 所有模块共享的基础类型
 */

/** 扁平化的键值映射 { 'common.button.save': '保存' } */
export type FlatLocaleData = Record<string, string>;

/** 嵌套结构的语言数据 { common: { button: { save: '保存' } } } */
export type NestedLocaleData = Record<string, unknown>;

/** 语言文件信息 */
export interface LocaleFileInfo {
  /** 语言代码，如 'zh', 'en', 'ja' */
  languageCode: string;
  /** 文件相对路径 */
  filePath: string;
  /** 文件格式 */
  format: LocaleFileFormat;
}

/** 支持的语言文件格式 */
export type LocaleFileFormat = 'json' | 'js' | 'xml' | 'strings';

/** 代码中匹配到的 i18n 调用 */
export interface I18nMatch {
  /** 完整匹配文本，如 t('common.submit') */
  fullMatch: string;
  /** 国际化键名，如 common.submit */
  key: string;
  /** 匹配起始偏移量 */
  startOffset: number;
  /** 匹配结束偏移量 */
  endOffset: number;
  /** 引号内键名的起始偏移量（用于 inline 装饰） */
  keyStartOffset: number;
  /** 引号内键名的结束偏移量 */
  keyEndOffset: number;
  /** 使用的引号类型 */
  quoteChar: string;
  /** 函数名，如 t、$t */
  functionName: string;
  /** 该 key 在默认语言文件中的当前译文（PanelMessageHandler 推送前 enrich，扫描器本身不填） */
  existingValue?: string;
}

/** 匹配模式定义（支持用户自定义正则） */
export interface MatchPattern {
  /** 正则表达式字符串（序列化用，因为 RegExp 不能存 JSON） */
  source: string;
  /** 正则标志 */
  flags: string;
  /** 键名所在的捕获组索引 */
  keyGroup: number;
  /** 适用的文件类型 */
  fileTypes: string[];
}

/** 扫描到的待替换文本 */
export interface ScanResultItem {
  /** 原始中文文本 */
  text: string;
  /** 匹配到的国际化键（可能为空） */
  i18nKey: string;
  /** 文本起始偏移量 */
  start: number;
  /** 文本结束偏移量 */
  end: number;
  /** 来源文件路径 */
  filePath?: string;
  /** 是否已选中 */
  selected: boolean;
  /** 翻译值 */
  translationValue?: string;
  /** 语言文件路径 */
  i18nFile?: string;
}

/** 替换结果 */
export interface ReplacementResult {
  /** 替换后的文本 */
  replacementText: string;
  /** 是否为 Vue 属性绑定替换 */
  isVueAttr: boolean;
  /** 替换范围（可能扩展了选区） */
  range?: { start: number; end: number };
}

/** 特殊语法处理结果 */
export interface SpecialSyntaxResult {
  /** 替换文本 */
  replacementText: string;
  /** 是否需要扩展替换范围 */
  expandRange: boolean;
  /** 扩展后的范围 */
  range?: { start: number; end: number };
}

/** 翻译任务结果 */
export interface TranslationResult {
  languageCode: string;
  success: boolean;
  text?: string;
  error?: string;
}

/** 支持的平台 ID */
export type PlatformId = 'web' | 'android' | 'ios';

/** 语言名称映射 */
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
