/**
 * iOS 平台代码替换器
 * 根据调用方式生成不同的替换文本：
 * - NSLocalizedString("key", comment: "")
 * - String(localized: "key")
 * - LocalizedStringKey("key")
 * - Text("key")  (SwiftUI，Text 自动支持本地化)
 */
import type { ICodeReplacer } from '../types';
import type { SpecialSyntaxResult } from '../../core/types';

export class iOSReplacer implements ICodeReplacer {
  /**
   * 生成替换文本
   * functionName 的含义在 iOS 上下文中：
   * - 'NSLocalizedString': NSLocalizedString("key", comment: "")
   * - 'String(localized:)': String(localized: "key")
   * - 'LocalizedStringKey': LocalizedStringKey("key")
   * - 'Text': Text("key")
   */
  generateReplacement(key: string, functionName: string, _quoteChar: string): string {
    switch (functionName) {
      case 'NSLocalizedString':
        return `NSLocalizedString("${key}", comment: "")`;
      case 'String(localized:)':
        return `String(localized: "${key}")`;
      case 'LocalizedStringKey':
        return `LocalizedStringKey("${key}")`;
      case 'Text':
        return `Text("${key}")`;
      default:
        return `NSLocalizedString("${key}", comment: "")`;
    }
  }

  handleSpecialSyntax?(
    _originalText: string,
    _lineText: string,
    _charOffset: number,
    _key: string,
    _functionName: string,
    _quoteChar: string
  ): SpecialSyntaxResult | null {
    return null;
  }
}
