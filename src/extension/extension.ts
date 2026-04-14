/**
 * i18n-swapper 扩展入口
 * 负责激活、初始化各模块、注册命令和生命周期管理
 */
import * as vscode from 'vscode';
import { ConfigManager } from './core/config/ConfigManager';
import { MESSAGES } from './core/config/defaults';
import { PlatformRegistry } from './platforms/PlatformRegistry';
import type { IPlatformAdapter } from './platforms/types';
import { LocaleStore } from './core/locale/LocaleStore';
import { LocaleFileIO } from './core/locale/LocaleFileIO';
import { KeyResolver } from './core/locale/KeyResolver';
import { TextScanner } from './core/scanner/TextScanner';
import { DecorationManager } from './editor/DecorationManager';
import { I18nHoverProvider } from './editor/I18nHoverProvider';
import { EditModeController } from './editor/EditModeController';

let configManager: ConfigManager;
let platformRegistry: PlatformRegistry;
let currentAdapter: IPlatformAdapter | null = null;
let localeStore: LocaleStore;
let localeFileIO: LocaleFileIO;
let keyResolver: KeyResolver;
let textScanner: TextScanner;
let decorationManager: DecorationManager;
let editModeController: EditModeController;

export function getConfigManager(): ConfigManager { return configManager; }
export function getPlatformRegistry(): PlatformRegistry { return platformRegistry; }
export function getCurrentAdapter(): IPlatformAdapter | null { return currentAdapter; }
export function getLocaleStore(): LocaleStore { return localeStore; }
export function getKeyResolver(): KeyResolver { return keyResolver; }
export function getTextScanner(): TextScanner { return textScanner; }

export async function activate(context: vscode.ExtensionContext) {
  console.log('[i18n-swapper] 插件激活中...');

  // 1. 初始化配置管理器
  configManager = new ConfigManager();
  context.subscriptions.push({ dispose: () => configManager.dispose() });

  // 2. 初始化平台注册中心并解析平台
  platformRegistry = new PlatformRegistry();
  const rootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

  if (rootPath) {
    try {
      currentAdapter = await platformRegistry.resolve(configManager.platform, rootPath);
      console.log(`[i18n-swapper] 当前平台: ${currentAdapter.displayName}`);
    } catch (e) {
      console.error('[i18n-swapper] 平台解析失败:', e);
    }
  }

  if (!currentAdapter) {
    console.error('[i18n-swapper] 无可用平台适配器');
    return;
  }

  // 3. 初始化语言数据层
  localeStore = new LocaleStore();
  localeFileIO = new LocaleFileIO(currentAdapter.parser, localeStore);
  keyResolver = new KeyResolver(localeStore);

  // 4. 初始化扫描器
  textScanner = new TextScanner(
    currentAdapter.matcher,
    keyResolver,
    configManager.identifyFunctionNames
  );

  // 5. 初始化编辑器交互层
  decorationManager = new DecorationManager(
    localeStore,
    currentAdapter.matcher,
    configManager.identifyFunctionNames
  );
  context.subscriptions.push(decorationManager);

  editModeController = new EditModeController(
    currentAdapter.matcher,
    configManager.identifyFunctionNames,
    decorationManager,
    () => refreshActiveEditor()
  );
  context.subscriptions.push(editModeController);

  // 6. 注册 HoverProvider
  const hoverProvider = new I18nHoverProvider(
    localeStore,
    currentAdapter.matcher,
    configManager.identifyFunctionNames
  );
  const supportedLanguages = currentAdapter.activationLanguages;
  const hoverDisposable = vscode.languages.registerHoverProvider(
    supportedLanguages.map((lang) => ({ language: lang })),
    hoverProvider
  );
  context.subscriptions.push(hoverDisposable);

  // 7. 注册命令
  registerCommands(context);

  // 8. 注册编辑器事件
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => refreshActiveEditor()),
    vscode.workspace.onDidChangeTextDocument((e) => {
      const editor = vscode.window.activeTextEditor;
      if (editor && e.document === editor.document) {
        refreshActiveEditor();
      }
    })
  );

  // 9. 监听配置变化
  configManager.onDidChange(() => {
    console.log('[i18n-swapper] 配置已变更，重新加载...');
    decorationManager.setFunctionNames(configManager.identifyFunctionNames);
    hoverProvider.setFunctionNames(configManager.identifyFunctionNames);
    editModeController.setFunctionNames(configManager.identifyFunctionNames);
    textScanner.setFunctionNames(configManager.identifyFunctionNames);
    loadLocalesAndRefresh(rootPath!);
  });

  // 10. 首次加载语言文件
  if (rootPath) {
    await initializeLocales(rootPath);
  }

  console.log('[i18n-swapper] 插件激活完成');
}

/**
 * 初始化语言文件：检查配置路径 → 加载 → 刷新装饰
 */
async function initializeLocales(rootPath: string): Promise<void> {
  const paths = configManager.localesPaths;

  if (paths.length === 0) {
    const shouldSkip = configManager.skipPrompt.includes('noLocaleConfigured');
    if (!shouldSkip) {
      const result = await vscode.window.showWarningMessage(
        MESSAGES.noLocaleConfigured,
        MESSAGES.selectFile,
        MESSAGES.ignoreTemporarily
      );
      if (result === MESSAGES.selectFile) {
        await selectAndSetLocaleFiles(rootPath);
      }
    }
  }

  loadLocalesAndRefresh(rootPath);
}

/**
 * 让用户选择语言文件并写入配置
 */
async function selectAndSetLocaleFiles(rootPath: string): Promise<void> {
  const files = await vscode.window.showOpenDialog({
    canSelectMany: true,
    openLabel: '选择源语言文件',
    filters: { '语言文件': ['json', 'js', 'xml', 'strings'] },
    defaultUri: vscode.Uri.file(rootPath),
  });

  if (files && files.length > 0) {
    const relativePaths = files.map((f) => {
      const rel = vscode.workspace.asRelativePath(f, false);
      return rel.replace(/\\/g, '/');
    });
    await configManager.setLocalesPaths(relativePaths);
    vscode.window.showInformationMessage(MESSAGES.filesAdded(relativePaths.length));
  }
}

/**
 * 加载语言文件 + 重建索引 + 刷新装饰
 */
function loadLocalesAndRefresh(rootPath: string): void {
  const paths = configManager.localesPaths;
  if (paths.length > 0) {
    localeFileIO.loadSourceLocales(paths, rootPath);
    localeFileIO.loadAllLanguages(configManager.languageMappings, rootPath);
    keyResolver.rebuildIndex();
  }
  refreshActiveEditor();
}

/**
 * 刷新当前活动编辑器的装饰
 */
function refreshActiveEditor(): void {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  decorationManager.updateDecorations(
    editor,
    configManager.decorationStyle,
    configManager.suffixStyle,
    configManager.inlineStyle,
    configManager.missingKeyStyle,
    configManager.showFullFormInEditMode
  );
}

function registerCommands(context: vscode.ExtensionContext): void {
  // 替换为 i18n 调用（Phase 3 实现完整逻辑）
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

  // 刷新装饰
  context.subscriptions.push(
    vscode.commands.registerCommand('i18n-swapper.refreshDecorations', () => {
      const rootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (rootPath) loadLocalesAndRefresh(rootPath);
    })
  );

  // 设置语言文件路径
  context.subscriptions.push(
    vscode.commands.registerCommand('i18n-swapper.setLocalesPaths', async () => {
      const rootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (rootPath) {
        await selectAndSetLocaleFiles(rootPath);
        loadLocalesAndRefresh(rootPath);
      }
    })
  );

  // 复制键名（HoverProvider 中的链接调用）
  context.subscriptions.push(
    vscode.commands.registerCommand('i18n-swapper.copyKey', (key: string) => {
      vscode.env.clipboard.writeText(key);
      vscode.window.showInformationMessage(`已复制: ${key}`);
    })
  );

  // 编辑键（HoverProvider 中的链接调用，Phase 3 扩展）
  context.subscriptions.push(
    vscode.commands.registerCommand('i18n-swapper.editKey', (key: string) => {
      vscode.window.showInformationMessage(`编辑键: ${key} (开发中)`);
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
