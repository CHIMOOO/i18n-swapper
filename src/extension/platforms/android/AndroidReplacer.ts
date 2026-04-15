/**
 * Android 平台代码替换器
 * 根据文件类型生成不同的替换文本：
 * - Kotlin Compose: stringResource(R.string.key)
 * - Kotlin/Java: getString(R.string.key) 或 R.string.key
 * - XML 布局: @string/key
 */
import type { ICodeReplacer } from '../types';
import type { SpecialSyntaxResult } from '../../core/types';

export class AndroidReplacer implements ICodeReplacer {
  /**
   * 生成替换文本
   * functionName 的含义在 Android 上下文中：
   * - 'stringResource': stringResource(R.string.key)  (Compose)
   * - 'getString': getString(R.string.key)  (Activity/Fragment)
   * - 'R.string': R.string.key  (直接引用)
   * - '@string': @string/key  (XML 布局)
   */
  generateReplacement(key: string, functionName: string, _quoteChar: string): string {
    const safeKey = this.toResourceName(key);

    switch (functionName) {
      case 'stringResource':
        return `stringResource(R.string.${safeKey})`;
      case 'getString':
        return `getString(R.string.${safeKey})`;
      case '@string':
        return `@string/${safeKey}`;
      default:
        return `R.string.${safeKey}`;
    }
  }

  handleSpecialSyntax(
    _originalText: string,
    lineText: string,
    charOffset: number,
    key: string,
    functionName: string,
    quoteChar: string
  ): SpecialSyntaxResult | null {
    const xmlAttrInfo = this.detectXmlAttribute(lineText, charOffset, _originalText);
    if (!xmlAttrInfo) return null;

    const safeKey = this.toResourceName(key);
    return {
      replacementText: `${xmlAttrInfo.attrName}="@string/${safeKey}"`,
      expandRange: true,
      range: {
        start: xmlAttrInfo.attrStart,
        end: xmlAttrInfo.attrEnd,
      },
    };
  }

  /**
   * 将 i18n 键名转换为 Android 资源名（只允许小写字母、数字、下划线）
   * common.button.save → common_button_save
   */
  private toResourceName(key: string): string {
    return key.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
  }

  /** 检测是否在 XML 属性值中（如 android:text="文字"） */
  private detectXmlAttribute(
    lineText: string,
    charOffset: number,
    originalText: string
  ): XmlAttrInfo | null {
    const beforeText = lineText.substring(0, charOffset);
    const attrValueMatch = beforeText.match(/([\w:]+)="$/);
    if (!attrValueMatch) return null;

    const attrName = attrValueMatch[1];
    const afterText = lineText.substring(charOffset + originalText.length);
    const closingIndex = afterText.indexOf('"');
    if (closingIndex === -1) return null;

    return {
      attrName,
      attrStart: attrValueMatch.index!,
      attrEnd: charOffset + originalText.length + closingIndex + 1,
    };
  }
}

interface XmlAttrInfo {
  attrName: string;
  attrStart: number;
  attrEnd: number;
}
