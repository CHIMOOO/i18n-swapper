/**
 * 悬浮面板
 * 鼠标悬停在 i18n 调用上时，显示多语言翻译值面板
 * 支持：查看多语言值、跳转文件、编辑翻译、单语言翻译、一键全部翻译
 */
import * as vscode from 'vscode';
import type { ICodeMatcher } from '../platforms/types';
import { LocaleStore } from '../core/locale/LocaleStore';
import { ConfigManager } from '../core/config/ConfigManager';
import { LANGUAGE_NAMES } from '../core/types';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export class I18nHoverProvider implements vscode.HoverProvider {
  constructor(
    private store: LocaleStore,
    private matcher: ICodeMatcher,
    private identifyFunctionNames: string[],
    private configManager: ConfigManager
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

    const languageMappings = this.configManager.languageMappings;
    const sourceLanguageCode = this.configManager.sourceLanguage;
    const sourceText = this.getSourceText(key, sourceLanguageCode);

    let html = '<div>';

    // 键名显示
    html += `<div>国际化键: <code>${escapeHtml(key)}</code></div>`;

    // 多语言表格
    html += `<table><thead><tr>
      <th align="right"></th><th></th><th></th><th></th>
    </tr></thead><tbody>`;

    let hasRows = false;

    for (const langCode of langCodes) {
      hasRows = true;
      const langName = LANGUAGE_NAMES[langCode]
        || LANGUAGE_NAMES[langCode.toLowerCase()]
        || langCode;
      const displayLabel = `${langName}[${langCode}]`;

      const value = this.store.getNestedValue(langCode, key);
      const valueDisplay = value
        ? escapeHtml(value)
        : '<em>缺失</em>';

      const mapping = languageMappings.find((m) => m.languageCode === langCode);

      // 语言名称列（可点击跳转到文件）
      let langNameCell: string;
      if (mapping?.filePath) {
        const openFileParams = encodeURIComponent(JSON.stringify({
          filePath: mapping.filePath,
          i18nKey: key,
        }));
        langNameCell = `<td align="right">
          <a href="command:i18n-swapper.openLanguageFile?${openFileParams}">
            <strong>${escapeHtml(displayLabel)}</strong>
          </a>
        </td><td></td>`;
      } else {
        langNameCell = `<td align="right">${escapeHtml(displayLabel)}</td><td></td>`;
      }

      // 翻译值列
      const langValueCell = `<td>${valueDisplay}</td>`;

      // 操作按钮列
      let actionCell = '<td>';

      if (mapping?.filePath) {
        const editParams = encodeURIComponent(JSON.stringify({
          langCode,
          i18nKey: key,
          filePath: mapping.filePath,
          currentValue: typeof value === 'string' ? value : '',
        }));

        // 非源语言 → 显示翻译按钮
        if (sourceText && langCode !== sourceLanguageCode) {
          const translateParams = encodeURIComponent(JSON.stringify({
            text: sourceText,
            targetLang: langCode,
            i18nKey: key,
            filePath: mapping.filePath,
          }));
          actionCell += `<a href="command:i18n-swapper.translateText?${translateParams}" title="翻译">🌏</a>`;
        }

        // 所有语言都可编辑
        actionCell += `<a href="command:i18n-swapper.editLanguageEntry?${editParams}" title="编辑此翻译">✏️</a>`;
      }

      actionCell += '</td>';
      html += `<tr>${langNameCell}${langValueCell}${actionCell}</tr>`;
    }

    if (!hasRows) {
      html += '<tr><td colspan="4"><em>未配置语言映射</em></td></tr>';
    }

    // 底部操作行
    const translateHoverParams = encodeURIComponent(JSON.stringify({
      text: sourceText || '',
      key,
    }));
    html += `<tr>
      <td><a title="翻译到所有语言" href="command:i18n-swapper.translateHover?${translateHoverParams}">✨翻译</a></td>
      <td></td>
      <td>
        <a href="command:i18n-swapper.copyKey?${encodeURIComponent(JSON.stringify(key))}">📋复制键名</a>
      </td>
      <td><a href="command:i18n-swapper.openApiConfig">配置翻译API</a></td>
    </tr>`;

    html += '</tbody></table></div>';

    const md = new vscode.MarkdownString(html);
    md.isTrusted = true;
    md.supportHtml = true;

    return md;
  }

  private getSourceText(key: string, sourceLanguageCode: string): string {
    const value = this.store.getNestedValue(sourceLanguageCode, key);
    return value || '';
  }
}
