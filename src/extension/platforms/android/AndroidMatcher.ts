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
    const candidates: I18nMatch[] = [];
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

        // Android 内联模式希望整段调用（如 getString(R.string.key)）
        // 直接显示为翻译文本，因此把 keyRange 设为整段范围。
        candidates.push({
          fullMatch,
          key,
          startOffset: match.index,
          endOffset: match.index + fullMatch.length,
          keyStartOffset: match.index,
          keyEndOffset: match.index + fullMatch.length,
          quoteChar: '',
          functionName: this.inferFunctionName(fullMatch),
        });
      }
    }

    // 范围互斥：外层匹配（如 getString(...R.string.x)）优先，
    // 丢弃完全落在已接受范围内的内层裸匹配（如 R.string.x）。
    candidates.sort((a, b) => {
      if (a.startOffset !== b.startOffset) return a.startOffset - b.startOffset;
      return b.endOffset - a.endOffset;
    });

    const accepted: I18nMatch[] = [];
    for (const cur of candidates) {
      const containedByAccepted = accepted.some(
        (m) => m.startOffset <= cur.startOffset && cur.endOffset <= m.endOffset
      );
      if (containedByAccepted) continue;
      accepted.push(cur);
    }

    return accepted;
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
