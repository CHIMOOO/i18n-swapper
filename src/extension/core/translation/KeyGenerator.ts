/**
 * 键名自动生成器
 * 通过翻译 API 将中文翻译为英文，转换为 camelCase 键名
 */
import { TranslationService } from './TranslationService';

export class KeyGenerator {
  constructor(private translationService: TranslationService) {}

  /**
   * 根据文本内容自动生成有意义的键名
   * 1. 翻译为英文
   * 2. 转为 camelCase
   * 3. 拼接前缀
   */
  async generateFromText(text: string, prefix: string): Promise<string> {
    try {
      if (!this.translationService.isConfigured) {
        return this.generateFallback(text, prefix);
      }

      const english = await this.translationService.translateToEnglish(text.trim());
      if (!english) {
        return this.generateFallback(text, prefix);
      }

      const camelKey = this.toCamelCase(english);
      if (!camelKey) {
        return this.generateFallback(text, prefix);
      }

      return prefix ? `${prefix}.${camelKey}` : camelKey;
    } catch {
      return this.generateFallback(text, prefix);
    }
  }

  /**
   * 后备方案：前缀 + 中文缩写 + 短时间戳
   */
  generateFallback(text: string, prefix: string): string {
    const cleanText = text.trim();
    const semanticSuffix = /[\u4e00-\u9fa5]/.test(cleanText)
      ? cleanText.substring(0, 4)
      : cleanText.substring(0, 8).replace(/\s+/g, '_').toLowerCase();
    const timestamp = Date.now().toString(36).slice(-4);
    return prefix ? `${prefix}.${semanticSuffix}_${timestamp}` : `${semanticSuffix}_${timestamp}`;
  }

  /**
   * 英文文本转 camelCase
   * "Hello World Example" → "helloWorldExample"
   */
  private toCamelCase(text: string): string {
    const cleaned = text
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .trim();

    if (!cleaned) return '';

    const words = cleaned.split(/\s+/).filter(Boolean);
    if (words.length === 0) return '';

    // 限制长度：最多取前 5 个单词
    const limited = words.slice(0, 5);
    return limited
      .map((word, index) => {
        const lower = word.toLowerCase();
        if (index === 0) return lower;
        return lower.charAt(0).toUpperCase() + lower.slice(1);
      })
      .join('');
  }
}
