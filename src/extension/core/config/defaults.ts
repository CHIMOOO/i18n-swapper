/**
 * 默认配置常量
 * 集中管理所有配置项的默认值
 */
import type { I18nSwapperConfig } from './types';

export const DEFAULT_CONFIG: I18nSwapperConfig = {
  platform: 'auto',

  localesPaths: [],
  functionName: 't',
  quoteType: 'single',
  defaultLocale: 'zh-CN',

  identifyFunctionNames: ['t', '$t'],
  matchPatterns: [],

  scanPatterns: ['label', 'value', 'placeholder', 'title', 'message', 'text'],
  excludeFiles: ['node_modules', 'dist', 'build', '.git', 'vendor', '.history'],
  includeFiles: [],

  decorationStyle: 'inline',
  showFullFormInEditMode: true,
  suffixStyle: {
    color: '#6A9955',
    fontSize: '14px',
    fontWeight: '400',
    fontStyle: 'italic',
    margin: '0 0 0 3px',
  },
  inlineStyle: {
    color: '#ffdd00',
    fontSize: '14px',
    fontWeight: '400',
    fontStyle: 'normal',
    margin: '0',
  },
  missingKeyStyle: {
    borderWidth: '0 0 2px 0',
    borderStyle: 'solid',
    borderColor: '#ff6900',
    borderSpacing: '2px',
  },

  tencentTranslation: {
    apiKey: '',
    apiSecret: '',
    region: 'ap-guangzhou',
    sourceLanguage: 'zh',
    languageMappings: [],
  },

  autoGenerateKeyFromText: true,
  autoGenerateKeyPrefix: '_iw',
  autoTranslateAllLanguages: true,

  defaultRepositories: {
    web: '',
    ios: '',
    android: '',
  },

  skipPrompt: [],
};

/** 提示消息文本 */
export const MESSAGES = {
  noLocaleConfigured: '未配置源语言文件国际化词库路径（将用于国际化函数预览）',
  selectFile: '选择文件',
  ignoreTemporarily: '暂时忽略',
  workspaceNotFound: '未找到工作区文件夹',
  filesAdded: (count: number) => `已添加 ${count} 个国际化文件`,
} as const;
