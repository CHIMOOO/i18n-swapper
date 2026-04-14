/**
 * 键名解析器
 * 按翻译值反查键路径 + 键名自动生成
 */
import { LocaleStore } from './LocaleStore';

export class KeyResolver {
  private reverseIndex = new Map<string, string[]>();

  constructor(private store: LocaleStore) {}

  /** 重建反向索引（在语言文件加载后调用） */
  rebuildIndex(): void {
    this.reverseIndex.clear();
    const flatData = this.store.getFlatData();
    for (const [key, value] of Object.entries(flatData)) {
      const existing = this.reverseIndex.get(value);
      if (existing) {
        existing.push(key);
      } else {
        this.reverseIndex.set(value, [key]);
      }
    }
  }

  /** 根据翻译值查找对应的键（可能多对一） */
  findKeyByValue(value: string): string[] {
    return this.reverseIndex.get(value) ?? [];
  }

  hasKey(key: string): boolean {
    return this.store.getValue(key) !== undefined;
  }

  /** 自动生成键名：前缀 + 语义缩写 + 短时间戳 */
  generateKey(text: string, prefix: string): string {
    const cleanText = text.trim();
    const semanticSuffix = /[\u4e00-\u9fa5]/.test(cleanText)
      ? cleanText.substring(0, 4)
      : cleanText.substring(0, 8).replace(/\s+/g, '_').toLowerCase();
    const timestamp = Date.now().toString(36).slice(-4);
    return `${prefix}.${semanticSuffix}_${timestamp}`;
  }
}
