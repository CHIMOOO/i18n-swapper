/**
 * iOS 平台代码匹配器
 * 匹配 NSLocalizedString("key", ...)、String(localized: "key")、
 * LocalizedStringKey("key")、Text("key") 等 Swift 本地化调用
 */
import type { ICodeMatcher } from '../types';
import type { I18nMatch, MatchPattern } from '../../core/types';

export class iOSMatcher implements ICodeMatcher {
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
        const key = match[pattern.keyGroup];
        if (!key) continue;

        const dedupKey = `${match.index}:${key}`;
        if (seen.has(dedupKey)) continue;
        seen.add(dedupKey);

        const keyInFull = fullMatch.indexOf(`"${key}"`);
        const keyStartInFull = keyInFull + 1;

        results.push({
          fullMatch,
          key,
          startOffset: match.index,
          endOffset: match.index + fullMatch.length,
          keyStartOffset: match.index + keyStartInFull,
          keyEndOffset: match.index + keyStartInFull + key.length,
          quoteChar: '"',
          functionName: this.inferFunctionName(fullMatch),
        });
      }
    }

    return results;
  }

  private inferFunctionName(fullMatch: string): string {
    if (fullMatch.startsWith('NSLocalizedString')) return 'NSLocalizedString';
    if (fullMatch.startsWith('String')) return 'String(localized:)';
    if (fullMatch.startsWith('LocalizedStringKey')) return 'LocalizedStringKey';
    if (fullMatch.startsWith('Text')) return 'Text';
    return 'NSLocalizedString';
  }
}
