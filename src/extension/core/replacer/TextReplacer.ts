/**
 * 文本替换引擎
 * 协调键查找、翻译、文件写入和代码替换的核心流程
 */
import * as vscode from 'vscode';
import * as path from 'path';
import type { ICodeReplacer } from '../../platforms/types';
import type { LanguageMapping } from '../config/types';
import type { ReplacementResult } from '../types';
import { KeyResolver } from '../locale/KeyResolver';
import { LocaleFileIO } from '../locale/LocaleFileIO';
import { TranslationService } from '../translation/TranslationService';
import { KeyGenerator } from '../translation/KeyGenerator';

export interface ReplaceContext {
  functionName: string;
  quoteChar: string;
  autoGenerateKeyFromText: boolean;
  autoGenerateKeyPrefix: string;
  autoTranslateAllLanguages: boolean;
  languageMappings: LanguageMapping[];
  sourceLanguage: string;
  rootPath: string;
}

export class TextReplacer {
  constructor(
    private replacer: ICodeReplacer,
    private keyResolver: KeyResolver,
    private localeFileIO: LocaleFileIO,
    private translationService: TranslationService,
    private keyGenerator: KeyGenerator
  ) {}

  setReplacer(replacer: ICodeReplacer): void {
    this.replacer = replacer;
  }

  /**
   * 执行单体替换的完整流程
   * 1. 查找/生成键名
   * 2. 处理特殊语法
   * 3. 写入语言文件
   * 4. 替换代码
   */
  async replaceText(
    editor: vscode.TextEditor,
    selection: vscode.Selection,
    ctx: ReplaceContext
  ): Promise<boolean> {
    const document = editor.document;
    const originalText = document.getText(selection);

    if (!originalText.trim()) {
      vscode.window.showWarningMessage('请先选中需要替换的文本');
      return false;
    }

    // 1. 扩展选区（处理引号包裹的情况）
    const expandedSelection = this.expandSelectionIfNeeded(document, selection, originalText);
    const selectedText = document.getText(expandedSelection);
    const pureText = this.extractPureText(selectedText);

    // 2. 查找已有键或生成新键
    const keyResult = await this.resolveKey(pureText, ctx);
    if (!keyResult) return false;

    const { key, isNew } = keyResult;

    // 3. 检查特殊语法（如 Vue 属性绑定）
    const lineText = document.lineAt(expandedSelection.start.line).text;
    const charOffset = expandedSelection.start.character;
    const specialResult = this.replacer.handleSpecialSyntax?.(
      pureText, lineText, charOffset, key, ctx.functionName, ctx.quoteChar
    );

    let replacementText: string;
    let replaceRange: vscode.Range = expandedSelection;

    if (specialResult) {
      replacementText = specialResult.replacementText;
      if (specialResult.expandRange && specialResult.range) {
        const lineStart = document.lineAt(expandedSelection.start.line).range.start;
        replaceRange = new vscode.Range(
          lineStart.translate(0, specialResult.range.start),
          lineStart.translate(0, specialResult.range.end)
        );
      }
    } else {
      replacementText = this.replacer.generateReplacement(key, ctx.functionName, ctx.quoteChar);
    }

    // 4. 如果是新键，写入语言文件 + 翻译
    if (isNew) {
      await this.writeTranslations(key, pureText, ctx);
    }

    // 5. 执行代码替换
    const success = await editor.edit((editBuilder) => {
      editBuilder.replace(replaceRange, replacementText);
    });

    if (success) {
      vscode.window.showInformationMessage(`已替换为 ${replacementText}`);
    }

    return success;
  }

  /**
   * 批量执行替换（从后往前避免位置偏移）
   */
  async batchReplace(
    document: vscode.TextDocument,
    items: Array<{ start: number; end: number; key: string; text: string }>,
    ctx: ReplaceContext
  ): Promise<number> {
    const sorted = [...items].sort((a, b) => b.start - a.start);
    const edit = new vscode.WorkspaceEdit();
    let count = 0;

    for (const item of sorted) {
      if (!item.key) continue;

      const startPos = document.positionAt(item.start);
      const endPos = document.positionAt(item.end);
      const range = new vscode.Range(startPos, endPos);
      const lineText = document.lineAt(startPos.line).text;

      const specialResult = this.replacer.handleSpecialSyntax?.(
        item.text, lineText, startPos.character, item.key, ctx.functionName, ctx.quoteChar
      );

      let replacementText: string;
      let replaceRange = range;

      if (specialResult) {
        replacementText = specialResult.replacementText;
        if (specialResult.expandRange && specialResult.range) {
          const lineStart = document.lineAt(startPos.line).range.start;
          replaceRange = new vscode.Range(
            lineStart.translate(0, specialResult.range.start),
            lineStart.translate(0, specialResult.range.end)
          );
        }
      } else {
        replacementText = this.replacer.generateReplacement(item.key, ctx.functionName, ctx.quoteChar);
      }

      edit.replace(document.uri, replaceRange, replacementText);
      count++;
    }

    if (count > 0) {
      await vscode.workspace.applyEdit(edit);
    }

    return count;
  }

  /**
   * 查找已有键或让用户选择/生成新键
   */
  private async resolveKey(
    text: string,
    ctx: ReplaceContext
  ): Promise<{ key: string; isNew: boolean } | null> {
    const existingKeys = this.keyResolver.findKeyByValue(text);

    if (existingKeys.length === 1) {
      return { key: existingKeys[0], isNew: false };
    }

    if (existingKeys.length > 1) {
      const picked = await vscode.window.showQuickPick(
        existingKeys.map((k) => ({ label: k, description: text })),
        { placeHolder: '找到多个匹配的键，请选择一个' }
      );
      if (!picked) return null;
      return { key: picked.label, isNew: false };
    }

    // 没有已有键 → 生成新键
    let suggestedKey: string;
    if (ctx.autoGenerateKeyFromText && this.translationService.isConfigured) {
      suggestedKey = await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: '正在生成键名...' },
        () => this.keyGenerator.generateFromText(text, ctx.autoGenerateKeyPrefix)
      );
    } else {
      suggestedKey = this.keyGenerator.generateFallback(text, ctx.autoGenerateKeyPrefix);
    }

    const userKey = await vscode.window.showInputBox({
      prompt: `为 "${text}" 输入国际化键名`,
      value: suggestedKey,
      validateInput: (v) => {
        if (!v.trim()) return '键名不能为空';
        if (!/^[\w.-]+$/.test(v)) return '键名只能包含字母、数字、下划线、点和横线';
        return null;
      },
    });

    if (!userKey) return null;
    return { key: userKey, isNew: true };
  }

  /**
   * 写入翻译到语言文件
   */
  private async writeTranslations(key: string, text: string, ctx: ReplaceContext): Promise<void> {
    if (ctx.languageMappings.length === 0) return;

    if (ctx.autoTranslateAllLanguages && this.translationService.isConfigured) {
      const results = await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: '正在翻译到所有语言...' },
        () => this.translationService.translateToAllLanguages(text, key, ctx.languageMappings, ctx.sourceLanguage)
      );

      for (const result of results) {
        const mapping = ctx.languageMappings.find((m) => m.languageCode === result.languageCode);
        if (!mapping) continue;

        const filePath = path.isAbsolute(mapping.filePath)
          ? mapping.filePath
          : path.join(ctx.rootPath, mapping.filePath);

        if (result.success && result.text) {
          await this.localeFileIO.saveTranslation(filePath, key, result.text);
        }
      }
    } else {
      // 仅写入源语言
      const sourceMapping = ctx.languageMappings.find(
        (m) => m.languageCode === ctx.sourceLanguage || m.languageCode.startsWith(ctx.sourceLanguage + '-')
      );

      if (sourceMapping) {
        const filePath = path.isAbsolute(sourceMapping.filePath)
          ? sourceMapping.filePath
          : path.join(ctx.rootPath, sourceMapping.filePath);
        await this.localeFileIO.saveTranslation(filePath, key, text);
      }
    }
  }

  /**
   * 智能扩展选区
   * 如果选中文本前后有引号且未被选中，自动扩展选区以包含引号
   */
  private expandSelectionIfNeeded(
    document: vscode.TextDocument,
    selection: vscode.Selection,
    selectedText: string
  ): vscode.Selection {
    const startOffset = document.offsetAt(selection.start);
    const endOffset = document.offsetAt(selection.end);
    const fullText = document.getText();

    const charBefore = startOffset > 0 ? fullText[startOffset - 1] : '';
    const charAfter = endOffset < fullText.length ? fullText[endOffset] : '';

    const isQuote = (ch: string) => ch === "'" || ch === '"' || ch === '`';

    if (isQuote(charBefore) && charBefore === charAfter) {
      return new vscode.Selection(
        document.positionAt(startOffset - 1),
        document.positionAt(endOffset + 1)
      );
    }

    return selection;
  }

  /**
   * 从可能包含引号的文本中提取纯文本
   */
  private extractPureText(text: string): string {
    const trimmed = text.trim();
    if (
      (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith('`') && trimmed.endsWith('`'))
    ) {
      return trimmed.slice(1, -1);
    }
    return trimmed;
  }
}
