/**
 * 配置类型定义
 * 对应 package.json contributes.configuration 中的所有配置项
 */
import type { PlatformId, MatchPattern } from '../types';

/** 装饰器显示模式 */
export type DecorationStyle = 'suffix' | 'inline';

/** 引号类型 */
export type QuoteType = 'single' | 'double';

/** 装饰器文本样式 */
export interface TextStyle {
  color: string;
  fontSize: string;
  fontWeight: string;
  fontStyle: string;
  margin: string;
}

/** 缺失键下划线样式 */
export interface MissingKeyStyle {
  borderWidth: string;
  borderStyle: 'solid' | 'dashed' | 'dotted' | 'double';
  borderColor: string;
  borderSpacing: string;
}

/** 翻译 API 配置 */
export interface TranslationApiConfig {
  apiKey: string;
  apiSecret: string;
  region: string;
  sourceLanguage: string;
  languageMappings: LanguageMapping[];
}

/** 语言代码与文件路径映射 */
export interface LanguageMapping {
  languageCode: string;
  filePath: string;
}

/** 默认代码仓库路径配置 */
export interface DefaultRepositories {
  web: string;
  ios: string;
  android: string;
}

/** 完整的插件配置 */
export interface I18nSwapperConfig {
  // 平台
  platform: PlatformId | 'auto';

  // 基础配置
  localesPaths: string[];
  functionName: string;
  quoteType: QuoteType;
  defaultLocale: string;

  // 识别配置
  identifyFunctionNames: string[];
  matchPatterns: MatchPattern[];

  // 扫描配置
  scanPatterns: string[];
  excludeFiles: string[];
  includeFiles: string[];

  // 显示配置
  decorationStyle: DecorationStyle;
  showFullFormInEditMode: boolean;
  suffixStyle: TextStyle;
  inlineStyle: TextStyle;
  missingKeyStyle: MissingKeyStyle;

  // 翻译配置
  tencentTranslation: TranslationApiConfig;

  // 自动化配置
  autoGenerateKeyFromText: boolean;
  autoGenerateKeyPrefix: string;
  autoTranslateAllLanguages: boolean;

  // 默认仓库
  defaultRepositories: DefaultRepositories;

  // Android 多模块扫描子路径（可选，缩小扫描范围）
  localeResSubPaths: string[];

  // iOS key mapping 文件相对路径
  keyMappingFiles: string[];

  // 行为配置
  skipPrompt: string[];
}
