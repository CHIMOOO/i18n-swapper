/**
 * 悬浮面板
 * 鼠标悬停在 i18n 调用上时，显示多语言翻译值面板
 */
import * as vscode from 'vscode';
import type { ICodeMatcher } from '../platforms/types';
import { LocaleStore } from '../core/locale/LocaleStore';
import { LANGUAGE_NAMES } from '../core/types';

export class I18nHoverProvider implements vscode.HoverProvider {
  constructor(
    private store: LocaleStore,
    private matcher: ICodeMatcher,
    private identifyFunctionNames: string[]
  ) {}

  setMatcher(matcher: ICodeMatcher): void {
    this.matcher = matcher;
  }

  setFunctionNames(names: string[]): void {
    this.identifyFunctionNames = names;
  }

  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): vscode.Hover | null {
    const text = document.getText();
    const offset = document.offsetAt(position);
    const matches = this.matcher.findAllMatches(text, this.identifyFunctionNames);

    const hit = matches.find((m) => offset >= m.startOffset && offset <= m.endOffset);
    if (!hit) return null;

    const markdown = this.buildHoverContent(hit.key);
    if (!markdown) return null;

    const range = new vscode.Range(
      document.positionAt(hit.startOffset),
      document.positionAt(hit.endOffset)
    );

    return new vscode.Hover(markdown, range);
  }

  private buildHoverContent(key: string): vscode.MarkdownString | null {
    const sourceValue = this.store.getValue(key);
    const langCodes = this.store.getAllLanguageCodes();

    if (!sourceValue && langCodes.length === 0) return null;

    const md = new vscode.MarkdownString();
    md.isTrusted = true;
    md.supportHtml = true;

    md.appendMarkdown(`### 🌐 ${key}\n\n`);

    if (sourceValue) {
      md.appendMarkdown(`**源语言**: ${sourceValue}\n\n`);
    }

    md.appendMarkdown('---\n\n');

    if (langCodes.length > 0) {
      md.appendMarkdown('| 语言 | 翻译 |\n|------|------|\n');
      for (const langCode of langCodes) {
        const langName = LANGUAGE_NAMES[langCode] || LANGUAGE_NAMES[langCode.toLowerCase()] || langCode;
        const value = this.store.getNestedValue(langCode, key);
        const display = value || '❌ 缺失';
        md.appendMarkdown(`| ${langName} (${langCode}) | ${display} |\n`);
      }
    }

    md.appendMarkdown('\n---\n\n');
    md.appendMarkdown(`[📋 复制键名](command:i18n-swapper.copyKey?${encodeURIComponent(JSON.stringify(key))})`);
    md.appendMarkdown(` | [✏️ 编辑](command:i18n-swapper.editKey?${encodeURIComponent(JSON.stringify(key))})`);

    return md;
  }
}
