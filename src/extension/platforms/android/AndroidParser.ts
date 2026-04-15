/**
 * Android 平台语言文件解析器
 * 支持 strings.xml 格式（Android 标准资源文件）
 *
 * 格式示例：
 * <resources>
 *   <string name="app_name">My App</string>
 *   <string name="hello_world">Hello World</string>
 * </resources>
 */
import type { ILocaleParser } from '../types';
import type { FlatLocaleData, NestedLocaleData } from '../../core/types';

export class AndroidParser implements ILocaleParser {
  readonly supportedExtensions = ['.xml'];

  parse(content: string, _filePath: string): FlatLocaleData {
    return this.parseStringResources(content);
  }

  parseNested(content: string, _filePath: string): NestedLocaleData {
    return this.parseStringResources(content) as unknown as NestedLocaleData;
  }

  serialize(data: NestedLocaleData, _filePath: string): string {
    const flat = data as unknown as FlatLocaleData;
    const lines: string[] = [
      '<?xml version="1.0" encoding="utf-8"?>',
      '<resources>',
    ];

    for (const [key, value] of Object.entries(flat)) {
      if (typeof value === 'string') {
        lines.push(`    <string name="${this.escapeXmlAttr(key)}">${this.escapeXmlText(value)}</string>`);
      }
    }

    lines.push('</resources>');
    lines.push('');
    return lines.join('\n');
  }

  /**
   * 解析 strings.xml 中的 <string name="key">value</string> 条目
   * 使用正则而非 DOM 解析，兼容 VSCode 扩展环境
   */
  private parseStringResources(content: string): FlatLocaleData {
    const result: FlatLocaleData = {};
    if (!content.trim()) return result;

    const stringTagRegex = /<string\s+name\s*=\s*"([^"]+)"\s*>([\s\S]*?)<\/string>/g;
    let match: RegExpExecArray | null;

    while ((match = stringTagRegex.exec(content)) !== null) {
      const key = match[1];
      const rawValue = match[2];
      result[key] = this.unescapeXmlText(rawValue);
    }

    return result;
  }

  private escapeXmlText(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/'/g, "\\'");
  }

  private escapeXmlAttr(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  private unescapeXmlText(text: string): string {
    return text
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/\\'/g, "'");
  }
}
