/**
 * Web 平台语言文件解析器
 * 支持 JSON 和 JS (module.exports) 格式
 */
import type { ILocaleParser } from '../types';
import type { FlatLocaleData, NestedLocaleData } from '../../core/types';

export class WebParser implements ILocaleParser {
  readonly supportedExtensions = ['.json', '.js'];

  parse(content: string, filePath: string): FlatLocaleData {
    const nested = this.parseNested(content, filePath);
    return this.flattenObject(nested);
  }

  parseNested(content: string, filePath: string): NestedLocaleData {
    if (filePath.endsWith('.json')) {
      return this.parseJson(content);
    }
    if (filePath.endsWith('.js')) {
      return this.parseJs(content);
    }
    return {};
  }

  serialize(data: NestedLocaleData, _filePath: string): string {
    return JSON.stringify(data, null, 2);
  }

  private parseJson(content: string): NestedLocaleData {
    try {
      if (!content.trim()) return {};
      return JSON.parse(content) as NestedLocaleData;
    } catch (e) {
      console.error('解析 JSON 语言文件失败:', e);
      return {};
    }
  }

  /**
   * 解析 JS 格式的语言文件
   * 支持 module.exports = { ... } 和 export default { ... }
   */
  private parseJs(content: string): NestedLocaleData {
    try {
      // 移除注释
      const cleaned = content
        .replace(/\/\/.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '');

      // 提取对象字面量：匹配 module.exports = {...} 或 export default {...}
      const exportMatch = cleaned.match(
        /(?:module\.exports\s*=|export\s+default)\s*(\{[\s\S]*\})\s*;?\s*$/
      );

      if (exportMatch) {
        // 使用 Function 构造器安全解析对象字面量
        const fn = new Function(`return ${exportMatch[1]}`);
        return fn() as NestedLocaleData;
      }
      return {};
    } catch (e) {
      console.error('解析 JS 语言文件失败:', e);
      return {};
    }
  }

  /**
   * 将嵌套对象扁平化
   * { common: { button: { save: '保存' } } } → { 'common.button.save': '保存' }
   */
  private flattenObject(obj: NestedLocaleData, prefix = ''): FlatLocaleData {
    const result: FlatLocaleData = {};

    for (const key of Object.keys(obj)) {
      const value = obj[key];
      const newKey = prefix ? `${prefix}.${key}` : key;

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        Object.assign(result, this.flattenObject(value as NestedLocaleData, newKey));
      } else if (typeof value === 'string') {
        result[newKey] = value;
      }
    }

    return result;
  }
}
