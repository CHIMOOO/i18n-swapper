/**
 * Android 平台代码匹配器
 * 匹配 R.string.xxx、@string/xxx、stringResource(R.string.xxx)、getString(R.string.xxx)
 */
import type { ICodeMatcher } from '../types';
import type { I18nMatch, MatchPattern } from '../../core/types';

export class AndroidMatcher implements ICodeMatcher {
  getPatterns(_functionNames: string[], customPatterns?: MatchPattern[]): MatchPattern[] {
    const defaultPatterns: MatchPattern[] = [
      {
        source: 'stringResource\\s*\\(\\s*(?:[\\w.]+\\.)?R\\.string\\.(\\w+)\\s*\\)',
        flags: 'g',
        keyGroup: 1,
        fileTypes: ['kt'],
      },
      {
        source: 'getString\\s*\\(\\s*(?:[\\w.]+\\.)?R\\.string\\.(\\w+)\\s*\\)',
        flags: 'g',
        keyGroup: 1,
        fileTypes: ['kt', 'java'],
      },
      {
        source: '(?:[\\w.]+\\.)?R\\.string\\.(\\w+)',
        flags: 'g',
        keyGroup: 1,
        fileTypes: ['kt', 'java'],
      },
      {
        source: '@string/(\\w+)',
        flags: 'g',
        keyGroup: 1,
        fileTypes: ['xml'],
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

        const keyStartInFull = fullMatch.lastIndexOf(key);

        results.push({
          fullMatch,
          key,
          startOffset: match.index,
          endOffset: match.index + fullMatch.length,
          keyStartOffset: match.index + keyStartInFull,
          keyEndOffset: match.index + keyStartInFull + key.length,
          quoteChar: '',
          functionName: this.inferFunctionName(fullMatch),
        });
      }
    }

    return results;
  }

  /**
   * 从完整匹配中推断函数调用形式
   * stringResource(R.string.xxx) → stringResource
   * getString(R.string.xxx) → getString
   * R.string.xxx → R.string
   * @string/xxx → @string
   */
  private inferFunctionName(fullMatch: string): string {
    if (fullMatch.startsWith('stringResource')) return 'stringResource';
    if (fullMatch.startsWith('getString')) return 'getString';
    if (fullMatch.startsWith('@string/')) return '@string';
    return 'R.string';
  }
}
