/**
 * 代码高亮定位服务
 * 在编辑器中高亮标记指定文本区域
 */
import * as vscode from 'vscode';

export class HighlightService implements vscode.Disposable {
  private highlightType: vscode.TextEditorDecorationType;
  private clearTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.highlightType = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      backgroundColor: 'rgba(255, 235, 59, 0.28)',
      overviewRulerColor: '#FFC107',
      overviewRulerLane: vscode.OverviewRulerLane.Center,
      border: '1px solid #FFC107',
      borderRadius: '2px',
    });
  }

  /**
   * 高亮指定文本范围，并自动跳转到该位置
   */
  async highlightRange(
    document: vscode.TextDocument,
    start: number,
    end: number,
    preserveFocus = true
  ): Promise<void> {
    const editor = await vscode.window.showTextDocument(document, {
      viewColumn: vscode.ViewColumn.One,
      preserveFocus,
    });

    const startPos = document.positionAt(start);
    const endPos = document.positionAt(end);
    const range = new vscode.Range(startPos, endPos);

    editor.setDecorations(this.highlightType, [{ range }]);
    editor.revealRange(range, vscode.TextEditorRevealType.InCenter);

    if (this.clearTimer) clearTimeout(this.clearTimer);
    this.clearTimer = setTimeout(() => {
      editor.setDecorations(this.highlightType, []);
      this.clearTimer = null;
    }, 3000);
  }

  /**
   * 打开文件并高亮指定范围
   */
  async highlightInFile(
    filePath: string,
    start: number,
    end: number
  ): Promise<void> {
    try {
      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
      await this.highlightRange(document, start, end, true);
    } catch (e) {
      console.error('[i18n-swapper] 打开文件失败:', e);
    }
  }

  clearHighlight(editor: vscode.TextEditor): void {
    editor.setDecorations(this.highlightType, []);
    if (this.clearTimer) {
      clearTimeout(this.clearTimer);
      this.clearTimer = null;
    }
  }

  dispose(): void {
    this.highlightType.dispose();
    if (this.clearTimer) clearTimeout(this.clearTimer);
  }
}
