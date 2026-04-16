/**
 * iOS 平台代码匹配器
 * 匹配 NSLocalizedString("key", ...)、String(localized: "key")、
 * LocalizedStringKey("key")、Text("key") 等 Swift 本地化调用
 * 以及 .curLocalized 系列模式
 */
import type { ICodeMatcher, KeyResolutionContext } from '../types';
import type { I18nMatch, MatchPattern } from '../../core/types';
import { iOSKeyMappingResolver } from './iOSKeyMappingResolver';

/** 需要间接解析的命名空间 */
const INDIRECT_NAMESPACES = ['UGLocalizableKey', 'UGStringMapping'] as const;

export class iOSMatcher implements ICodeMatcher {
  private keyMappingResolver = new iOSKeyMappingResolver();

  getPatterns(_functionNames: string[], customPatterns?: MatchPattern[]): MatchPattern[] {
    const defaultPatterns: MatchPattern[] = [
      {
        source: 'NSLocalizedString\\s*\\(\\s*"((?:[^"\\\\]|\\\\.)*)"',
        flags: 'g',
        keyGroup: 1,
        fileTypes: ['swift', 'm'],
      },
      {
        source: 'String\\s*\\(\\s*localized\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"',
        flags: 'g',
        keyGroup: 1,
        fileTypes: ['swift'],
      },
      {
        source: 'LocalizedStringKey\\s*\\(\\s*"((?:[^"\\\\]|\\\\.)*)"',
        flags: 'g',
        keyGroup: 1,
        fileTypes: ['swift'],
      },
      {
        source: 'Text\\s*\\(\\s*"((?:[^"\\\\]|\\\\.)*)"',
        flags: 'g',
        keyGroup: 1,
        fileTypes: ['swift'],
      },
      // "key".curLocalized — 直接字符串字面量
      {
        source: '"((?:[^"\\\\]|\\\\.)*)"\\s*\\.\\s*curLocalized',
        flags: 'g',
        keyGroup: 1,
        fileTypes: ['swift'],
      },
      // UGLocalizableKey.propName.curLocalized — 枚举间接引用
      {
        source: 'UGLocalizableKey\\.(\\w+)\\s*\\.\\s*curLocalized',
        flags: 'g',
        keyGroup: 1,
        fileTypes: ['swift'],
      },
      // UGStringMapping.propName.curLocalized — 映射间接引用
      {
        source: 'UGStringMapping\\.(\\w+)\\s*\\.\\s*curLocalized',
        flags: 'g',
        keyGroup: 1,
        fileTypes: ['swift'],
      },
    ];

    if (customPatterns && customPatterns.length > 0) {
      return [...defaultPatterns, ...customPatterns];
    }
    return defaultPatterns;
  }

  findAllMatches(text: string, functionNames: string[], customPatterns?: MatchPattern[]): I18nMatch[] {
    const patterns = this.getPatterns(functionNames, customPatterns);
    const results: I18nMatch[] = [];
    const seen = new Set<string>();

    for (const pattern of patterns) {
      const regex = new RegExp(pattern.source, pattern.flags);
      let match: RegExpExecArray | null;

      while ((match = regex.exec(text)) !== null) {
        const fullMatch = match[0];
        let key = match[pattern.keyGroup];
        if (!key) continue;

        const namespace = this.detectNamespace(fullMatch);
        if (namespace) {
          const resolved = this.resolveKey(key, { namespace });
          if (resolved) {
            key = resolved;
          }
        }

        const dedupKey = `${match.index}:${key}`;
        if (seen.has(dedupKey)) continue;
        seen.add(dedupKey);

        const keyInFull = fullMatch.indexOf(`"${key}"`);
        const hasDirect = keyInFull >= 0;
        const keyStartInFull = hasDirect ? keyInFull + 1 : fullMatch.indexOf(`.${match[pattern.keyGroup]}`) + 1;

        results.push({
          fullMatch,
          key,
          startOffset: match.index,
          endOffset: match.index + fullMatch.length,
          keyStartOffset: match.index + keyStartInFull,
          keyEndOffset: match.index + keyStartInFull + (hasDirect ? key.length : match[pattern.keyGroup].length),
          quoteChar: hasDirect ? '"' : '',
          functionName: this.inferFunctionName(fullMatch),
        });
      }
    }

    return results;
  }

  resolveKey(rawKey: string, context?: KeyResolutionContext): string | undefined {
    if (!context?.namespace) return undefined;
    return this.keyMappingResolver.resolve(context.namespace, rawKey);
  }

  async loadKeyMappings(_rootPath: string, mappingFiles?: string[]): Promise<void> {
    if (!mappingFiles) return;
    for (const filePath of mappingFiles) {
      const namespace = this.inferNamespaceFromPath(filePath);
      if (namespace) {
        this.keyMappingResolver.loadFromFile(filePath, namespace);
      }
    }
  }

  getKeyMappingResolver(): iOSKeyMappingResolver {
    return this.keyMappingResolver;
  }

  private detectNamespace(fullMatch: string): string | undefined {
    for (const ns of INDIRECT_NAMESPACES) {
      if (fullMatch.startsWith(ns + '.')) return ns;
    }
    return undefined;
  }

  private inferNamespaceFromPath(filePath: string): string | undefined {
    for (const ns of INDIRECT_NAMESPACES) {
      if (filePath.includes(ns)) return ns;
    }
    return undefined;
  }

  private inferFunctionName(fullMatch: string): string {
    if (fullMatch.startsWith('NSLocalizedString')) return 'NSLocalizedString';
    if (fullMatch.startsWith('String')) return 'String(localized:)';
    if (fullMatch.startsWith('LocalizedStringKey')) return 'LocalizedStringKey';
    if (fullMatch.startsWith('Text')) return 'Text';
    if (fullMatch.startsWith('UGLocalizableKey')) return 'UGLocalizableKey.curLocalized';
    if (fullMatch.startsWith('UGStringMapping')) return 'UGStringMapping.curLocalized';
    if (fullMatch.startsWith('"') && fullMatch.includes('.curLocalized')) return '.curLocalized';
    return 'NSLocalizedString';
  }
}
