/**
 * Web 平台代码匹配器
 * 匹配 t('key')、$t('key')、t("key") 等 i18n 函数调用
 */
import type { ICodeMatcher } from '../types';
import type { I18nMatch, MatchPattern } from '../../core/types';

export class WebMatcher implements ICodeMatcher {
  getPatterns(functionNames: string[], customPatterns?: MatchPattern[]): MatchPattern[] {
    // 将所有函数名合并为一个正则：(?:\$t|t)\s*\(\s*(['"])([^'"]+)\1\s*\)
    // 按长度降序排列，避免 t 优先匹配到 $t 中的 t
    const sorted = [...functionNames].sort((a, b) => b.length - a.length);
    const fnAlternation = sorted.map((fn) => this.escapeRegex(fn)).join('|');

    const defaultPatterns: MatchPattern[] = [{
      source: `(${fnAlternation})\\s*\\(\\s*(['"])([^'"]+)\\2\\s*\\)`,
      flags: 'g',
      keyGroup: 3,
      fileTypes: ['js', 'ts', 'jsx', 'tsx', 'vue', 'html'],
    }];

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

        const quoteChar = match[2] || "'";
        const fnName = match[1] || functionNames[0];

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
