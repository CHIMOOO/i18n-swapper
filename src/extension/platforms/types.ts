/**
 * 平台适配器接口定义
 * 每个平台（Web/Android/iOS）需实现这些接口
 */
import type {
  FlatLocaleData,
  NestedLocaleData,
  I18nMatch,
  MatchPattern,
  LocaleFileInfo,
  SpecialSyntaxResult,
  PlatformId,
} from '../core/types';

/** 语言文件解析器 */
export interface ILocaleParser {
  /** 将文件内容解析为扁平键值映射 */
  parse(content: string, filePath: string): FlatLocaleData;

  /** 将文件内容解析为原始嵌套结构 */
  parseNested(content: string, filePath: string): NestedLocaleData;

  /** 将嵌套数据序列化为文件内容字符串 */
  serialize(data: NestedLocaleData, filePath: string): string;

  /** 支持的文件扩展名 */
  readonly supportedExtensions: string[];

  /**
   * 是否使用扁平键（key 中的 `.` 不表示嵌套层级）
   * iOS (.strings) 和 Android (strings.xml) 等平台的 key 是扁平的，
   * 保存时不应按 `.` 拆分为嵌套对象。
   */
  readonly useFlatKeys?: boolean;
}

/** key 解析上下文（用于间接引用的 key 解析） */
export interface KeyResolutionContext {
  namespace?: string;
}

/** 代码中 i18n 调用的匹配器 */
export interface ICodeMatcher {
  /**
   * 获取匹配模式列表
   * @param functionNames 用户配置的函数名列表
   * @param customPatterns 用户自定义的额外模式
   */
  getPatterns(functionNames: string[], customPatterns?: MatchPattern[]): MatchPattern[];

  /**
   * 在文本中查找所有 i18n 调用
   * @param text 文档文本内容
   * @param functionNames 函数名列表
   * @param customPatterns 用户自定义模式
   */
  findAllMatches(text: string, functionNames: string[], customPatterns?: MatchPattern[]): I18nMatch[];

  /**
   * 解析间接引用的 key（如枚举属性名 → 实际 i18n key）
   * 仅在匹配到需要间接解析的模式时调用
   */
  resolveKey?(rawKey: string, context?: KeyResolutionContext): string | undefined;

  /**
   * 加载 key 映射表（如从 Swift 枚举文件加载属性名到实际 key 的映射）
   * 在语言文件发现阶段由 adapter 触发调用
   */
  loadKeyMappings?(rootPath: string, mappingFiles?: string[]): Promise<void>;
}

/** 代码替换器 */
export interface ICodeReplacer {
  /**
   * 生成替换文本
   * @param key 国际化键名
   * @param functionName 输出函数名
   * @param quoteChar 引号字符
   */
  generateReplacement(key: string, functionName: string, quoteChar: string): string;

  /**
   * 处理特殊语法（如 Vue 属性绑定）
   * 返回 null 表示不需要特殊处理
   */
  handleSpecialSyntax?(
    originalText: string,
    lineText: string,
    charOffset: number,
    key: string,
    functionName: string,
    quoteChar: string
  ): SpecialSyntaxResult | null;
}

/** 语言文件发现选项 */
export interface DiscoverOptions {
  /** Android: 优先扫描的 res 子路径 */
  localeResSubPaths?: string[];
  /** iOS: 额外的 key mapping 文件路径 */
  keyMappingFiles?: string[];
}

/** 平台适配器 */
export interface IPlatformAdapter {
  /** 平台标识 */
  readonly id: PlatformId;
  /** 平台显示名称 */
  readonly displayName: string;

  /** 语言文件解析器 */
  readonly parser: ILocaleParser;
  /** 代码匹配器 */
  readonly matcher: ICodeMatcher;
  /** 代码替换器 */
  readonly replacer: ICodeReplacer;

  /** 支持的代码文件扩展名 */
  readonly supportedExtensions: string[];
  /** 激活事件的 VSCode 语言 ID */
  readonly activationLanguages: string[];

  /**
   * 检测当前工作区是否为该平台项目
   * @param rootPath 工作区根路径
   */
  detect(rootPath: string): Promise<boolean>;

  /**
   * 自动发现语言文件
   * @param rootPath 工作区根路径
   * @param options 可选的发现配置
   */
  discoverLocaleFiles(rootPath: string, options?: DiscoverOptions): Promise<LocaleFileInfo[]>;
}
