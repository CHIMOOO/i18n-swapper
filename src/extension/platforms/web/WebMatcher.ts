/**
 * Web 平台代码匹配器
 * 匹配 t('key')、$t('key')、t("key") 等 i18n 函数调用
 */
import type { ICodeMatcher } from '../types';
import type { I18nMatch, MatchPattern } from '../../core/types';

export class WebMatcher implements ICodeMatcher {
  getPatterns(functionNames: string[], customPatterns?: MatchPattern[]): MatchPattern[] {
    const defaultPatterns: MatchPattern[] = functionNames.map((fn) => ({
      source: `(\\$?\\b${this.escapeRegex(fn)}\\b)\\s*\\(\\s*(['"])([^'"]+)\\2\\s*\\)`,
      flags: 'g',
      keyGroup: 3,
      fileTypes: ['js', 'ts', 'jsx', 'tsx', 'vue', 'html'],
    }));

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

        // 去重：同一位置同一键名只保留一次
        const dedupKey = `${match.index}:${key}`;
        if (seen.has(dedupKey)) continue;
        seen.add(dedupKey);

        const quoteChar = match[2] || "'";
        const fnName = match[1] || functionNames[0];

        // 计算引号内键名的精确位置
        const quoteStartIndex = fullMatch.indexOf(quoteChar, fullMatch.indexOf('('));
        const quoteEndIndex = fullMatch.lastIndexOf(quoteChar);

        results.push({
          fullMatch,
          key,
          startOffset: match.index,
          endOffset: match.index + fullMatch.length,
          keyStartOffset: match.index + quoteStartIndex + 1,
          keyEndOffset: match.index + quoteEndIndex,
          quoteChar,
          functionName: fnName,
        });
      }
    }

    return results;
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
