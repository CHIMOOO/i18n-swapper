/**
 * CodeLens 管理器
 * 为批量替换提供行内 "接受 / 取消" 按钮
 */
import * as vscode from 'vscode';
import type { ScanResultItem } from '../core/types';

export class CodeLensManager implements vscode.Disposable {
  private disposable: vscode.Disposable | null = null;

  constructor(
    private document: vscode.TextDocument,
    private items: ScanResultItem[]
  ) {}

  register(): void {
    this.disposable?.dispose();

    const provider: vscode.CodeLensProvider = {
      provideCodeLenses: () => this.provideCodeLenses(),
    };

    this.disposable = vscode.languages.registerCodeLensProvider(
      { pattern: this.document.uri.fsPath },
      provider
    );
  }

  private provideCodeLenses(): vscode.CodeLens[] {
    const lenses: vscode.CodeLens[] = [];

    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      if (!item.i18nKey) continue;

      const startPos = this.document.positionAt(item.start);
      const endPos = this.document.positionAt(item.end);
      const range = new vscode.Range(startPos, endPos);

      lenses.push(
        new vscode.CodeLens(range, {
          title: '✅ 接受',
          command: 'i18n-swapper.confirmReplacement',
          arguments: [{ index: i }],
        }),
        new vscode.CodeLens(range, {
          title: '❌ 取消',
          command: 'i18n-swapper.cancelReplacement',
          arguments: [{ index: i }],
        })
      );
    }

    return lenses;
  }

  dispose(): void {
    this.disposable?.dispose();
    this.disposable = null;
  }
}
