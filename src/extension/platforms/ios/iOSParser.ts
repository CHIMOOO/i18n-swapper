/**
 * iOS 平台语言文件解析器
 * 支持 .strings 格式（Apple 标准本地化文件）
 *
 * 格式示例：
 * "app_name" = "My App";
 * "hello_world" = "Hello World";
 */
import type { ILocaleParser } from '../types';
import type { FlatLocaleData, NestedLocaleData } from '../../core/types';

export class iOSParser implements ILocaleParser {
  readonly supportedExtensions = ['.strings'];
  readonly useFlatKeys = true;

  parse(content: string, _filePath: string): FlatLocaleData {
    return this.parseStringsFile(content);
  }

  parseNested(content: string, _filePath: string): NestedLocaleData {
    return this.parseStringsFile(content) as unknown as NestedLocaleData;
  }

  serialize(data: NestedLocaleData, _filePath: string): string {
    const flat = data as unknown as FlatLocaleData;
    const lines: string[] = [];

    for (const [key, value] of Object.entries(flat)) {
      if (typeof value === 'string') {
        lines.push(`"${this.escapeString(key)}" = "${this.escapeString(value)}";`);
      }
    }

    lines.push('');
    return lines.join('\n');
  }

  /**
   * 解析 .strings 文件
   * 格式: "key" = "value";
   * 支持多行值、转义字符、C 风格注释
   */
  private parseStringsFile(content: string): FlatLocaleData {
    const result: FlatLocaleData = {};
    if (!content.trim()) return result;

    const cleaned = content
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');

    const entryRegex = /"((?:[^"\\]|\\.)*)"\s*=\s*"((?:[^"\\]|\\.)*)"\s*;/g;
    let match: RegExpExecArray | null;

    while ((match = entryRegex.exec(cleaned)) !== null) {
      const key = this.unescapeString(match[1]);
      const value = this.unescapeString(match[2]);
      result[key] = value;
    }

    return result;
  }

  private escapeString(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\t/g, '\\t');
  }

  private unescapeString(text: string): string {
    return text
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }
}
