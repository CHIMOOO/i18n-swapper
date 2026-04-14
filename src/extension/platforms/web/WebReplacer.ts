/**
 * Web 平台代码替换器
 * 生成 t('key') 格式的替换文本，处理 Vue 属性绑定等特殊语法
 */
import type { ICodeReplacer } from '../types';
import type { SpecialSyntaxResult } from '../../core/types';

export class WebReplacer implements ICodeReplacer {
  generateReplacement(key: string, functionName: string, quoteChar: string): string {
    return `${functionName}(${quoteChar}${key}${quoteChar})`;
  }

  /**
   * 处理 Vue 模板中的属性绑定语法
   * label="文字" → :label="t('key')"
   */
  handleSpecialSyntax(
    originalText: string,
    lineText: string,
    charOffset: number,
    key: string,
    functionName: string,
    quoteChar: string
  ): SpecialSyntaxResult | null {
    const vueAttrInfo = this.detectVueAttribute(lineText, charOffset, originalText);
    if (!vueAttrInfo) return null;

    const replacement = this.generateReplacement(key, functionName, quoteChar);

    return {
      replacementText: `:${vueAttrInfo.attrName}="${replacement}"`,
      expandRange: true,
      range: {
        start: vueAttrInfo.attrStart,
        end: vueAttrInfo.attrEnd,
      },
    };
  }

  /**
   * 检测光标位置是否在 Vue 模板属性值中
   * 例如 label="文字" 中的 "文字"
   */
  private detectVueAttribute(
    lineText: string,
    charOffset: number,
    originalText: string
  ): VueAttrInfo | null {
    // 向前搜索 =" 或 =' 模式
    const beforeText = lineText.substring(0, charOffset);
    const attrValueMatch = beforeText.match(/(\w[\w-]*)=(['"])\s*$/);

    if (!attrValueMatch) return null;

    const attrName = attrValueMatch[1];
    const attrQuote = attrValueMatch[2];

    // 已经有冒号绑定的不处理
    if (beforeText.trimEnd().endsWith(`:${attrName}=${attrQuote}`)) {
      return null;
    }

    // 向后查找配对的引号
    const afterText = lineText.substring(charOffset + originalText.length);
    const closingIndex = afterText.indexOf(attrQuote);
    if (closingIndex === -1) return null;

    // 计算完整属性的范围（从属性名开始到闭合引号）
    const attrStart = charOffset - attrValueMatch[0].length + attrValueMatch.index!;
    const attrEnd = charOffset + originalText.length + closingIndex + 1;

    return { attrName, attrStart, attrEnd };
  }
}

interface VueAttrInfo {
  attrName: string;
  attrStart: number;
  attrEnd: number;
}
