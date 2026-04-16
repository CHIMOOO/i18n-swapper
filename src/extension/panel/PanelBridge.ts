/**
 * WebView 面板桥接
 * 管理 WebView 面板的创建、销毁和消息路由
 */
import * as vscode from 'vscode';
import { PanelMessageHandler, type PanelDependencies } from './PanelMessageHandler';

export class PanelBridge implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;
  private messageHandler: PanelMessageHandler | undefined;
  private disposables: vscode.Disposable[] = [];

  constructor(
    private extensionUri: vscode.Uri,
    private deps: PanelDependencies
  ) {}

  updateDeps(deps: Partial<PanelDependencies>): void {
    Object.assign(this.deps, deps);
    this.messageHandler?.updateDeps(deps);
    if (this.panel) {
      this.messageHandler?.handleMessage({ command: 'getPlatformStatus' });
      this.messageHandler?.handleMessage({ command: 'getConfig' });
      this.messageHandler?.handleMessage({ command: 'getLocaleData' });
      this.messageHandler?.handleMessage({ command: 'getLanguageStatus' });
    }
  }

  openPanel(): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Beside);
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'i18nSwapperPanel',
      'i18n Swapper',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview'),
        ],
      }
    );

    this.messageHandler = new PanelMessageHandler(this.deps, (msg) => {
      this.panel?.webview.postMessage(msg);
    });

    this.panel.webview.html = this.getWebviewContent();

    this.panel.webview.onDidReceiveMessage(
      (message) => this.messageHandler?.handleMessage(message),
      undefined,
      this.disposables
    );

    this.panel.onDidDispose(() => {
      this.panel = undefined;
      this.messageHandler = undefined;
      this.disposables.forEach((d) => d.dispose());
      this.disposables = [];
    });

    const configDisposable = this.deps.configManager.onDidChange(() => {
      this.sendMessage({ command: 'dataRefreshed' });
      this.messageHandler?.handleMessage({ command: 'getPlatformStatus' });
      this.messageHandler?.handleMessage({ command: 'getConfig' });
      this.messageHandler?.handleMessage({ command: 'getLocaleData' });
      this.messageHandler?.handleMessage({ command: 'getLanguageStatus' });
    });
    this.disposables.push(configDisposable);
  }

  sendMessage(message: unknown): void {
    this.panel?.webview.postMessage(message);
  }

  get isVisible(): boolean {
    return this.panel?.visible ?? false;
  }

  dispose(): void {
    this.panel?.dispose();
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }

  private getWebviewContent(): string {
    const webview = this.panel!.webview;
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'index.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'index.css')
    );
    const nonce = this.getNonce();

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <link href="${styleUri}" rel="stylesheet">
  <title>i18n Swapper</title>
</head>
<body>
  <div id="app"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}
