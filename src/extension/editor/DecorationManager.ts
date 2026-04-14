/**
 * 装饰器管理器
 * 在编辑器中显示 i18n 翻译预览（suffix 后缀 / inline 内联）
 */
import * as vscode from 'vscode';
import type { ICodeMatcher } from '../platforms/types';
import type { DecorationStyle, TextStyle, MissingKeyStyle } from '../core/config/types';
import { LocaleStore } from '../core/locale/LocaleStore';

export class DecorationManager implements vscode.Disposable {
  private suffixType: vscode.TextEditorDecorationType | null = null;
  private inlineType: vscode.TextEditorDecorationType | null = null;
  private missingType: vscode.TextEditorDecorationType | null = null;

  /** 当前编辑模式激活的键+行号 */
  private editingKey: string | null = null;
  private editingLine = -1;

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

  /** 由 EditModeController 调用，设置当前编辑的键 */
  setEditingKey(key: string | null, line: number): void {
    this.editingKey = key;
    this.editingLine = line;
  }

  /**
   * 刷新编辑器装饰
   */
  updateDecorations(
    editor: vscode.TextEditor,
    style: DecorationStyle,
    suffixStyle: TextStyle,
    inlineStyle: TextStyle,
    missingKeyStyleCfg: MissingKeyStyle,
    showFullFormInEditMode: boolean
  ): void {
    this.disposeTypes();
    this.createTypes(suffixStyle, inlineStyle, missingKeyStyleCfg);

    const text = editor.document.getText();
    const matches = this.matcher.findAllMatches(text, this.identifyFunctionNames);

    const suffixDecs: vscode.DecorationOptions[] = [];
    const inlineDecs: vscode.DecorationOptions[] = [];
    const missingDecs: vscode.DecorationOptions[] = [];

    for (const m of matches) {
      const translation = this.store.getValue(m.key);
      const startPos = editor.document.positionAt(m.startOffset);
      const endPos = editor.document.positionAt(m.endOffset);
      const keyStartPos = editor.document.positionAt(m.keyStartOffset);
      const keyEndPos = editor.document.positionAt(m.keyEndOffset);
      const fullRange = new vscode.Range(startPos, endPos);
      const keyRange = new vscode.Range(keyStartPos, keyEndPos);

      const isEditing = this.editingKey === m.key && startPos.line === this.editingLine;

      if (!translation) {
        missingDecs.push({ range: keyRange });
        continue;
      }

      if (style === 'inline') {
        if (isEditing && showFullFormInEditMode) {
          suffixDecs.push({
            range: fullRange,
            renderOptions: {
              after: { contentText: ` → ${translation}`, color: suffixStyle.color, fontStyle: 'italic' },
            },
          });
        } else {
          inlineDecs.push({
            range: keyRange,
            renderOptions: {
              after: {
                contentText: translation,
                color: inlineStyle.color,
                fontStyle: inlineStyle.fontStyle,
                margin: inlineStyle.margin,
              },
            },
          });
        }
      } else {
        suffixDecs.push({
          range: fullRange,
          renderOptions: {
            after: {
              contentText: ` ${translation}`,
              color: suffixStyle.color,
              fontStyle: suffixStyle.fontStyle,
              margin: suffixStyle.margin,
            },
          },
        });
      }
    }

    if (this.suffixType) editor.setDecorations(this.suffixType, suffixDecs);
    if (this.inlineType) editor.setDecorations(this.inlineType, inlineDecs);
    if (this.missingType) editor.setDecorations(this.missingType, missingDecs);
  }

  clearDecorations(editor: vscode.TextEditor): void {
    if (this.suffixType) editor.setDecorations(this.suffixType, []);
    if (this.inlineType) editor.setDecorations(this.inlineType, []);
    if (this.missingType) editor.setDecorations(this.missingType, []);
  }

  private createTypes(suffix: TextStyle, inline: TextStyle, missing: MissingKeyStyle): void {
    this.suffixType = vscode.window.createTextEditorDecorationType({ isWholeLine: false });

    this.inlineType = vscode.window.createTextEditorDecorationType({
      letterSpacing: '-100em',
      opacity: '0',
    });

    this.missingType = vscode.window.createTextEditorDecorationType({
      borderWidth: missing.borderWidth,
      borderStyle: missing.borderStyle,
      borderColor: missing.borderColor,
      borderSpacing: missing.borderSpacing,
    });
  }

  private disposeTypes(): void {
    this.suffixType?.dispose();
    this.inlineType?.dispose();
    this.missingType?.dispose();
    this.suffixType = null;
    this.inlineType = null;
    this.missingType = null;
  }

  dispose(): void {
    this.disposeTypes();
  }
}
