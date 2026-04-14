/**
 * 编辑模式控制器
 * inline 模式下点击 i18n 调用时，切换为显示完整函数形式以便编辑
 */
import * as vscode from 'vscode';
import type { ICodeMatcher } from '../platforms/types';
import type { I18nMatch } from '../core/types';
import { DecorationManager } from './DecorationManager';

export class EditModeController implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];
  private lastEditingLine = -1;

  constructor(
    private matcher: ICodeMatcher,
    private identifyFunctionNames: string[],
    private decorationManager: DecorationManager,
    private refreshCallback: () => void
  ) {
    this.disposables.push(
      vscode.window.onDidChangeTextEditorSelection((e) => this.onSelectionChange(e))
    );
  }

  setMatcher(matcher: ICodeMatcher): void {
    this.matcher = matcher;
  }

  setFunctionNames(names: string[]): void {
    this.identifyFunctionNames = names;
  }

  private onSelectionChange(e: vscode.TextEditorSelectionChangeEvent): void {
    const editor = e.textEditor;
    const position = e.selections[0]?.active;
    if (!position) return;

    const currentLine = position.line;

    // 行未变化时不刷新
    if (currentLine === this.lastEditingLine) return;
    this.lastEditingLine = currentLine;

    const text = editor.document.getText();
    const offset = editor.document.offsetAt(position);
    const matches = this.matcher.findAllMatches(text, this.identifyFunctionNames);

    const hit = this.findMatchAtOffset(matches, offset);

    if (hit) {
      this.decorationManager.setEditingKey(hit.key, currentLine);
    } else {
      this.decorationManager.setEditingKey(null, -1);
    }

    this.refreshCallback();
  }

  private findMatchAtOffset(matches: I18nMatch[], offset: number): I18nMatch | null {
    return matches.find((m) => offset >= m.startOffset && offset <= m.endOffset) ?? null;
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }
}
