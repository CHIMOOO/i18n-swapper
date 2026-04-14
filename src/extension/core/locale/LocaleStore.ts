/**
 * 语言数据缓存
 * 维护扁平化键值映射和原始嵌套数据的双缓存
 */
import type { FlatLocaleData, NestedLocaleData } from '../types';

export class LocaleStore {
  /** 源语言的扁平化数据 { 'common.button.save': '保存' } */
  private flatData: FlatLocaleData = {};
  /** 所有语言的原始嵌套数据 */
  private allLanguageData = new Map<string, NestedLocaleData>();

  getFlatData(): FlatLocaleData {
    return this.flatData;
  }

  setFlatData(data: FlatLocaleData): void {
    this.flatData = data;
  }

  mergeFlatData(data: FlatLocaleData): void {
    Object.assign(this.flatData, data);
  }

  getValue(key: string): string | undefined {
    return this.flatData[key];
  }

  get keyCount(): number {
    return Object.keys(this.flatData).length;
  }

  setLanguageData(langCode: string, data: NestedLocaleData): void {
    this.allLanguageData.set(langCode, data);
  }

  getLanguageData(langCode: string): NestedLocaleData | undefined {
    return this.allLanguageData.get(langCode);
  }

  getAllLanguageCodes(): string[] {
    return Array.from(this.allLanguageData.keys());
  }

  /** 从嵌套结构中按 key 路径取值 */
  getNestedValue(langCode: string, key: string): string | undefined {
    const data = this.allLanguageData.get(langCode);
    if (!data) return undefined;

    const parts = key.split('.');
    let current: unknown = data;
    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[part];
    }
    return typeof current === 'string' ? current : undefined;
  }

  clear(): void {
    this.flatData = {};
    this.allLanguageData.clear();
  }
}
