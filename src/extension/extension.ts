/**
 * i18n-swapper 扩展入口
 * 负责激活、初始化各模块、注册命令和生命周期管理
 */
import * as vscode from 'vscode';
import { ConfigManager } from './core/config/ConfigManager';
import { PlatformRegistry } from './platforms/PlatformRegistry';
import type { IPlatformAdapter } from './platforms/types';

/** 全局单例，供各模块引用 */
let configManager: ConfigManager;
let platformRegistry: PlatformRegistry;
let currentAdapter: IPlatformAdapter | null = null;

export function getConfigManager(): ConfigManager {
  return configManager;
}

export function getPlatformRegistry(): PlatformRegistry {
  return platformRegistry;
}

export function getCurrentAdapter(): IPlatformAdapter | null {
  return currentAdapter;
}

export async function activate(context: vscode.ExtensionContext) {
  console.log('[i18n-swapper] 插件激活中...');

  // 1. 初始化配置管理器
  configManager = new ConfigManager();
  context.subscriptions.push({ dispose: () => configManager.dispose() });

  // 2. 初始化平台注册中心
  platformRegistry = new PlatformRegistry();

  // 3. 解析当前平台
  const rootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (rootPath) {
    try {
      currentAdapter = await platformRegistry.resolve(configManager.platform, rootPath);
      console.log(`[i18n-swapper] 当前平台: ${currentAdapter.displayName}`);
    } catch (e) {
      console.error('[i18n-swapper] 平台解析失败:', e);
    }
  }

  // 4. 注册命令
  registerCommands(context);

  // 5. 监听配置变化
  configManager.onDidChange(() => {
    console.log('[i18n-swapper] 配置已变更');
    // Phase 2 将在这里触发装饰器刷新等
  });

  console.log('[i18n-swapper] 插件激活完成');
}

function registerCommands(context: vscode.ExtensionContext): void {
  // 替换为 i18n 调用（Phase 3 实现）
  context.subscriptions.push(
    vscode.commands.registerCommand('i18n-swapper.replaceWithI18n', () => {
      vscode.window.showInformationMessage('i18n Swapper: 替换功能开发中...');
    })
  );

  // 打开管理面板
  context.subscriptions.push(
    vscode.commands.registerCommand('i18n-swapper.openPanel', () => {
      const panel = vscode.window.createWebviewPanel(
        'i18nSwapperPanel',
        'i18n Swapper',
        vscode.ViewColumn.Beside,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [
            vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview'),
          ],
        }
      );

      panel.webview.html = getWebviewContent(panel.webview, context.extensionUri);

      panel.webview.onDidReceiveMessage(
        (message) => {
          switch (message.command) {
            case 'ready':
              console.log('[i18n-swapper] WebView 面板就绪');
              break;
          }
        },
        undefined,
        context.subscriptions
      );
    })
  );

  // 刷新装饰（Phase 2 实现）
  context.subscriptions.push(
    vscode.commands.registerCommand('i18n-swapper.refreshDecorations', () => {
      vscode.window.showInformationMessage('i18n Swapper: 刷新装饰...');
    })
  );

  // 设置语言文件路径（Phase 2 实现）
  context.subscriptions.push(
    vscode.commands.registerCommand('i18n-swapper.setLocalesPaths', () => {
      vscode.window.showInformationMessage('i18n Swapper: 设置路径开发中...');
    })
  );
}

function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'index.js')
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'index.css')
  );
  const nonce = getNonce();

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

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

export function deactivate() {
  console.log('[i18n-swapper] 插件已停用');
}
