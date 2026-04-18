/**
 * WebView 视图桥接（Activity Bar 侧边栏）
 * 通过 WebviewViewProvider 把面板挂载到自定义 Activity Bar 容器内，
 * 与"资源管理器""搜索"等共用同一侧边栏区域，不再占用编辑器 ViewColumn。
 */
import * as vscode from 'vscode';
import { PanelMessageHandler, type PanelDependencies } from './PanelMessageHandler';

export const I18N_SWAPPER_VIEW_ID = 'i18nSwapperView';

export class PanelBridge implements vscode.WebviewViewProvider, vscode.Disposable {
  private view: vscode.WebviewView | undefined;
  private messageHandler: PanelMessageHandler | undefined;
  private viewDisposables: vscode.Disposable[] = [];
  private rootDisposables: vscode.Disposable[] = [];

  constructor(
    private extensionUri: vscode.Uri,
    private deps: PanelDependencies
  ) {}

  /** 注册到 vscode（在 extension activate 中调用） */
  register(context: vscode.ExtensionContext): void {
    const reg = vscode.window.registerWebviewViewProvider(I18N_SWAPPER_VIEW_ID, this, {
      webviewOptions: { retainContextWhenHidden: true },
    });
    context.subscriptions.push(reg);
    this.rootDisposables.push(reg);
  }

  updateDeps(deps: Partial<PanelDependencies>): void {
    Object.assign(this.deps, deps);
    this.messageHandler?.updateDeps(deps);
    if (this.view) {
      this.messageHandler?.handleMessage({ command: 'getPlatformStatus' });
      this.messageHandler?.handleMessage({ command: 'getConfig' });
      this.messageHandler?.handleMessage({ command: 'getLocaleData' });
      this.messageHandler?.handleMessage({ command: 'getLanguageStatus' });
    }
  }

  /** 兼容旧 API：聚焦/展开面板 */
  openPanel(): void {
    void vscode.commands.executeCommand(`${I18N_SWAPPER_VIEW_ID}.focus`);
  }

  sendMessage(message: unknown): void {
    this.view?.webview.postMessage(message);
  }

  get isVisible(): boolean {
    return this.view?.visible ?? false;
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;
    this.viewDisposables.forEach((d) => d.dispose());
    this.viewDisposables = [];

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview')],
    };

    this.messageHandler = new PanelMessageHandler(this.deps, (msg) => {
      this.view?.webview.postMessage(msg);
    });

    webviewView.webview.html = this.getWebviewContent(webviewView.webview);

    this.viewDisposables.push(
      webviewView.webview.onDidReceiveMessage((message) =>
        this.messageHandler?.handleMessage(message)
      )
    );

    this.viewDisposables.push(
      this.deps.configManager.onDidChange(() => {
        this.sendMessage({ command: 'dataRefreshed' });
        this.messageHandler?.handleMessage({ command: 'getPlatformStatus' });
        this.messageHandler?.handleMessage({ command: 'getConfig' });
        this.messageHandler?.handleMessage({ command: 'getLocaleData' });
        this.messageHandler?.handleMessage({ command: 'getLanguageStatus' });
      })
    );

    webviewView.onDidDispose(() => {
      this.view = undefined;
      this.messageHandler = undefined;
      this.viewDisposables.forEach((d) => d.dispose());
      this.viewDisposables = [];
    });
  }

  dispose(): void {
    this.viewDisposables.forEach((d) => d.dispose());
    this.viewDisposables = [];
    this.rootDisposables.forEach((d) => d.dispose());
    this.rootDisposables = [];
  }

  private getWebviewContent(webview: vscode.Webview): string {
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
