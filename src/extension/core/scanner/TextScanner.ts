/**
 * 文本扫描引擎
 * 扫描代码中的中文文本和已有 i18n 调用
 */
import * as fs from 'fs';
import * as path from 'path';
import type { ICodeMatcher } from '../../platforms/types';
import type { I18nMatch, ScanResultItem } from '../types';
import { KeyResolver } from '../locale/KeyResolver';

/** 匹配中文文本（含标点、混合英数） */
const CHINESE_REGEX_SOURCE =
  /[\u4e00-\u9fa5]+[\u4e00-\u9fa5\w\d\s.,;:!?，。；：！？、""''()（）\-—…]*[\u4e00-\u9fa5\w\d.,;:!?，。；：！？、""''()（）\-—…]*/g;

export class TextScanner {
  constructor(
    private matcher: ICodeMatcher,
    private keyResolver: KeyResolver,
    private identifyFunctionNames: string[]
  ) {}

  setMatcher(matcher: ICodeMatcher): void {
    this.matcher = matcher;
  }

  setFunctionNames(names: string[]): void {
    this.identifyFunctionNames = names;
  }

  /** 扫描单个文本，返回已有i18n调用和待处理中文 */
  scanText(text: string, filePath: string): { existing: I18nMatch[]; pending: ScanResultItem[] } {
    const existing = this.matcher.findAllMatches(text, this.identifyFunctionNames);
    const existingRanges = existing.map((m) => [m.startOffset, m.endOffset] as [number, number]);

    const chineseMatches = this.findChineseText(text);
    const pending: ScanResultItem[] = [];

    for (const match of chineseMatches) {
      const isInsideI18n = existingRanges.some(
        ([start, end]) => match.start >= start && match.end <= end
      );
      if (isInsideI18n) continue;

      const existingKeys = this.keyResolver.findKeyByValue(match.text);
      pending.push({
        text: match.text,
        i18nKey: existingKeys.length > 0 ? existingKeys[0] : '',
        start: match.start,
        end: match.end,
        filePath,
        selected: false,
      });
    }

    return { existing, pending };
  }

  /** 全工作区扫描 */
  async scanWorkspace(
    rootPath: string,
    fileExtensions: string[],
    excludeFiles: string[]
  ): Promise<{ filePath: string; existing: I18nMatch[]; pending: ScanResultItem[] }[]> {
    const files = await this.collectFiles(rootPath, fileExtensions, excludeFiles);
    const results: { filePath: string; existing: I18nMatch[]; pending: ScanResultItem[] }[] = [];

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        const result = this.scanText(content, file);
        if (result.existing.length > 0 || result.pending.length > 0) {
          results.push({ filePath: file, ...result });
        }
      } catch {
        // 读取失败跳过
      }
    }

    return results;
  }

  private findChineseText(text: string): Array<{ text: string; start: number; end: number }> {
    const results: Array<{ text: string; start: number; end: number }> = [];
    const regex = new RegExp(CHINESE_REGEX_SOURCE.source, 'g');
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      const matchedText = match[0].trim();
      if (matchedText.length > 0) {
        results.push({ text: matchedText, start: match.index, end: match.index + match[0].length });
      }
    }

    return results;
  }

  private async collectFiles(
    dirPath: string,
    extensions: string[],
    excludes: string[],
    maxDepth = 10,
    depth = 0
  ): Promise<string[]> {
    if (depth > maxDepth) return [];
    const files: string[] = [];

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (excludes.includes(entry.name)) continue;
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          const sub = await this.collectFiles(fullPath, extensions, excludes, maxDepth, depth + 1);
          files.push(...sub);
        } else if (entry.isFile() && extensions.includes(path.extname(entry.name))) {
          files.push(fullPath);
        }
      }
    } catch {
      // 无权限等场景静默跳过
    }

    return files;
  }
}
