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

    // 把注释字符以等长空格替换，保留原始偏移；中文正则在 stripped 文本上跑
    const stripped = this._stripComments(text, path.extname(filePath).toLowerCase());
    const chineseMatches = this.findChineseText(stripped);
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

  /**
   * 把注释字符替换为等长空格，保留偏移
   * 按文件扩展名选择注释规则；同时也会跳过 ` 包裹的代码字面量内的注释字符（不需要更细粒度处理，
   * 中文匹配在 stripped 文本上跑，注释里的中文会变成空白被跳过）。
   *
   * 支持：
   *   //  — JS/TS/Vue/Java/Kotlin/Swift/Dart/C/C++/Go/Rust/Scss
   *   /* *\/ — 同上块注释
   *   #   — Python/Shell/YAML/Ruby/Toml
   *   <!-- --> — HTML/XML/Vue template
   *   --  — Lua/SQL
   *   /// — Swift 文档注释（属于 // 的子集，自然覆盖）
   */
  private _stripComments(text: string, ext: string): string {
    const rules = TextScanner.commentRulesFor(ext);
    if (!rules) return text;

    const chars = text.split('');
    const len = chars.length;
    let i = 0;
    // 0: 普通；1: 单行注释；2: 块注释；3: 字符串字面量
    let state: 0 | 1 | 2 | 3 = 0;
    let blockEnd = '';
    let lineStart = '';
    let stringQuote = '';

    const replaceRange = (from: number, to: number) => {
      for (let k = from; k < to && k < len; k++) {
        if (chars[k] !== '\n' && chars[k] !== '\r') chars[k] = ' ';
      }
    };

    while (i < len) {
      if (state === 0) {
        // 字符串
        if (rules.stringQuotes && rules.stringQuotes.includes(chars[i])) {
          stringQuote = chars[i];
          state = 3;
          i++;
          continue;
        }
        // 块注释
        if (rules.blockStarts) {
          const matched = rules.blockStarts.find((b) => text.startsWith(b.start, i));
          if (matched) {
            blockEnd = matched.end;
            const startIdx = i;
            const endIdx = text.indexOf(blockEnd, i + matched.start.length);
            const finalEnd = endIdx === -1 ? len : endIdx + blockEnd.length;
            replaceRange(startIdx, finalEnd);
            i = finalEnd;
            state = 0;
            continue;
          }
        }
        // 单行注释
        if (rules.lineStarts) {
          const matched = rules.lineStarts.find((s) => text.startsWith(s, i));
          if (matched) {
            lineStart = matched;
            const startIdx = i;
            let endIdx = text.indexOf('\n', i + lineStart.length);
            if (endIdx === -1) endIdx = len;
            replaceRange(startIdx, endIdx);
            i = endIdx;
            state = 0;
            continue;
          }
        }
        i++;
      } else if (state === 3) {
        // 字符串内：处理转义；遇到匹配的引号退出
        if (chars[i] === '\\' && i + 1 < len) {
          i += 2;
          continue;
        }
        if (chars[i] === stringQuote) {
          state = 0;
        }
        i++;
      } else {
        i++;
      }
    }

    return chars.join('');
  }

  private static commentRulesFor(ext: string): {
    lineStarts?: string[];
    blockStarts?: { start: string; end: string }[];
    stringQuotes?: string[];
  } | null {
    // C 系语言（含 Swift/Kotlin/Java/Dart/Go/Rust/Scss/Less）
    const cFamily = new Set([
      '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
      '.vue', '.svelte',
      '.java', '.kt', '.kts', '.scala', '.groovy',
      '.swift', '.m', '.mm', '.h', '.hpp', '.cpp', '.c', '.cc', '.cxx',
      '.dart', '.go', '.rs', '.scss', '.less', '.css',
    ]);
    if (cFamily.has(ext)) {
      return {
        lineStarts: ['//'],
        blockStarts: [{ start: '/*', end: '*/' }],
        // 字符串引号：避免把字符串里的 // 错认作注释
        stringQuotes: ["'", '"', '`'],
      };
    }
    // Python / Shell / YAML / Ruby / Toml
    if (['.py', '.sh', '.bash', '.zsh', '.yaml', '.yml', '.rb', '.toml'].includes(ext)) {
      return {
        lineStarts: ['#'],
        stringQuotes: ["'", '"'],
      };
    }
    // HTML / XML
    if (['.html', '.htm', '.xml', '.svg'].includes(ext)) {
      return {
        blockStarts: [{ start: '<!--', end: '-->' }],
        stringQuotes: ['"', "'"],
      };
    }
    // Lua / SQL
    if (['.lua', '.sql'].includes(ext)) {
      return {
        lineStarts: ['--'],
        blockStarts: [{ start: '--[[', end: ']]' }],
        stringQuotes: ["'", '"'],
      };
    }
    return null;
  }
}
