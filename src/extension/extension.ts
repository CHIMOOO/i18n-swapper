/**
 * i18n-swapper 扩展入口
 * 负责激活、初始化各模块、注册命令和生命周期管理
 */
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
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
import { HighlightService } from './editor/HighlightService';
import { TranslationService } from './core/translation/TranslationService';
import { KeyGenerator } from './core/translation/KeyGenerator';
import { TextReplacer } from './core/replacer/TextReplacer';
import { createReplaceWithI18nCommand } from './commands/replaceWithI18n';
import {
  createQuickBatchReplaceCommand,
  createConfirmReplacementCommand,
  createCancelReplacementCommand,
  setConfigManagerRef,
} from './commands/quickBatchReplace';
import { PanelBridge } from './panel/PanelBridge';
import { WorkspaceScanner } from './panel/WorkspaceScanner';
import type { LocaleFileInfo } from './core/types';

let configManager: ConfigManager;
let platformRegistry: PlatformRegistry;
let currentAdapter: IPlatformAdapter | null = null;
let localeStore: LocaleStore;
let localeFileIO: LocaleFileIO;
let keyResolver: KeyResolver;
let textScanner: TextScanner;
let decorationManager: DecorationManager;
let editModeController: EditModeController;
let highlightService: HighlightService;
let translationService: TranslationService;
let keyGenerator: KeyGenerator;
let textReplacer: TextReplacer;
let panelBridge: PanelBridge | undefined;
let workspaceScanner: WorkspaceScanner;
let hoverProvider: I18nHoverProvider | undefined;

/** 平台相关模块是否已初始化 */
let platformModulesReady = false;

export function getConfigManager(): ConfigManager { return configManager; }
export function getPlatformRegistry(): PlatformRegistry { return platformRegistry; }
export function getCurrentAdapter(): IPlatformAdapter | null { return currentAdapter; }
export function getLocaleStore(): LocaleStore { return localeStore; }
export function getKeyResolver(): KeyResolver { return keyResolver; }
export function getTextScanner(): TextScanner { return textScanner; }
export function getTranslationService(): TranslationService { return translationService; }
export function getTextReplacer(): TextReplacer { return textReplacer; }

function getRootPath(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

/**
 * 检查平台模块是否就绪，未就绪时提示用户选择平台
 */
function ensurePlatformReady(actionName?: string): boolean {
  if (platformModulesReady && currentAdapter) return true;
  const prefix = actionName ? `${actionName}: ` : '';
  vscode.window.showWarningMessage(
    `${prefix}尚未检测到项目平台，请先选择平台或设置语言文件路径`,
    '选择平台',
    '设置语言文件'
  ).then((choice) => {
    if (choice === '选择平台') {
      vscode.commands.executeCommand('i18n-swapper.switchPlatform');
    } else if (choice === '设置语言文件') {
      vscode.commands.executeCommand('i18n-swapper.setLocalesPaths');
    }
  });
  return false;
}

/**
 * 初始化依赖平台适配器的全部模块（首次或平台切换时调用）
 */
function initializePlatformModules(adapter: IPlatformAdapter, context: vscode.ExtensionContext): void {
  currentAdapter = adapter;

  if (!localeFileIO) {
    localeFileIO = new LocaleFileIO(adapter.parser, localeStore);
  } else {
    localeFileIO.setParser(adapter.parser);
  }

  if (!keyResolver) {
    keyResolver = new KeyResolver(localeStore);
  }

  if (!textScanner) {
    textScanner = new TextScanner(adapter.matcher, keyResolver, configManager.identifyFunctionNames);
  } else {
    textScanner.setMatcher(adapter.matcher);
  }

  if (!textReplacer) {
    textReplacer = new TextReplacer(adapter.replacer, keyResolver, localeFileIO, translationService, keyGenerator);
  } else {
    textReplacer.setReplacer(adapter.replacer);
  }

  if (!workspaceScanner) {
    workspaceScanner = new WorkspaceScanner(textScanner);
  }

  if (!decorationManager) {
    decorationManager = new DecorationManager(localeStore, adapter.matcher, configManager.identifyFunctionNames);
    context.subscriptions.push(decorationManager);
  } else {
    decorationManager.setMatcher(adapter.matcher);
  }

  if (!editModeController) {
    editModeController = new EditModeController(
      adapter.matcher, configManager.identifyFunctionNames, decorationManager, () => refreshActiveEditor()
    );
    context.subscriptions.push(editModeController);
  } else {
    editModeController.setMatcher(adapter.matcher);
  }

  if (!hoverProvider) {
    hoverProvider = new I18nHoverProvider(localeStore, adapter.matcher, configManager.identifyFunctionNames, configManager);
    const hoverDisposable = vscode.languages.registerHoverProvider(
      adapter.activationLanguages.map((lang) => ({ language: lang })),
      hoverProvider
    );
    context.subscriptions.push(hoverDisposable);
  } else {
    hoverProvider.setMatcher(adapter.matcher);
  }

  if (!panelBridge) {
    panelBridge = new PanelBridge(context.extensionUri, {
      configManager, localeStore, localeFileIO, keyResolver, textReplacer,
      translationService, workspaceScanner, adapter, getRootPath,
      refreshCallback: () => { const rp = getRootPath(); if (rp) loadLocalesAndRefresh(rp); },
    });
    context.subscriptions.push(panelBridge);
  }

  platformModulesReady = true;
  console.log(`[i18n-swapper] 平台模块已初始化: ${adapter.displayName}`);
}

export async function activate(context: vscode.ExtensionContext) {
  console.log('[i18n-swapper] 插件激活中...');

  // 1. 初始化配置管理器（无依赖）
  configManager = new ConfigManager();
  context.subscriptions.push({ dispose: () => configManager.dispose() });

  // 2. 初始化平台注册中心（无依赖）
  platformRegistry = new PlatformRegistry();
  context.subscriptions.push(platformRegistry);

  // 3. 初始化平台无关的基础模块
  localeStore = new LocaleStore();
  translationService = new TranslationService(configManager.tencentTranslation);
  keyGenerator = new KeyGenerator(translationService);
  highlightService = new HighlightService();
  context.subscriptions.push(highlightService);

  // 4. 尝试自动检测平台
  const rootPath = getRootPath();
  if (rootPath) {
    try {
      currentAdapter = await platformRegistry.resolve(configManager.platform, rootPath);
      console.log(`[i18n-swapper] 当前平台: ${currentAdapter.displayName}`);
    } catch (e) {
      console.warn('[i18n-swapper] 平台自动检测失败，功能将受限直到用户手动选择平台:', e);
    }
  }

  // 5. 如果有适配器，初始化平台相关模块
  if (currentAdapter) {
    initializePlatformModules(currentAdapter, context);
  }

  // 6. 注册所有命令（无论平台是否就绪）
  setConfigManagerRef(configManager);
  registerCommands(context);

  // 7. 注册编辑器事件
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => refreshActiveEditor()),
    vscode.workspace.onDidChangeTextDocument((e) => {
      const editor = vscode.window.activeTextEditor;
      if (editor && e.document === editor.document) {
        refreshActiveEditor();
      }
    })
  );

  // 8. 监听配置变化
  configManager.onDidChange(() => {
    console.log('[i18n-swapper] 配置已变更，重新加载...');
    if (platformModulesReady) {
      decorationManager.setFunctionNames(configManager.identifyFunctionNames);
      hoverProvider?.setFunctionNames(configManager.identifyFunctionNames);
      editModeController.setFunctionNames(configManager.identifyFunctionNames);
      textScanner.setFunctionNames(configManager.identifyFunctionNames);
    }
    translationService.updateConfig(configManager.tencentTranslation);
    const rp = getRootPath();
    if (rp && platformModulesReady) loadLocalesAndRefresh(rp);
  });

  // 9. 监听平台切换事件 → 初始化/重新初始化平台模块
  platformRegistry.onDidChangePlatform((newAdapter) => {
    initializePlatformModules(newAdapter, context);
    const rp = getRootPath();
    if (rp) {
      localeStore.clear();
      loadLocalesAndRefresh(rp);
    }
  });

  // 10. 首次加载语言文件
  if (rootPath && platformModulesReady) {
    await initializeLocales(rootPath);
  }

  console.log('[i18n-swapper] 插件激活完成');
}

/**
 * 初始化语言文件，按优先级尝试：
 * 1. 使用已配置的 localesPaths
 * 2. 自动发现当前工作区中的语言文件
 * 3. 从 defaultRepositories 配置的外部仓库路径发现
 * 4. 提示用户手动选择
 */
async function initializeLocales(rootPath: string): Promise<void> {
  let paths = configManager.localesPaths;

  if (paths.length === 0) {
    const discovered = await autoDiscoverLocaleFiles(rootPath);
    if (discovered && discovered.length > 0) {
      paths = configManager.localesPaths;
    }
  }

  if (paths.length === 0) {
    const fromRepo = await discoverFromDefaultRepository(rootPath);
    if (fromRepo && fromRepo.length > 0) {
      paths = configManager.localesPaths;
    }
  }

  if (paths.length === 0) {
    const shouldSkip = configManager.skipPrompt.includes('noLocaleConfigured');
    if (!shouldSkip) {
      const result = await vscode.window.showWarningMessage(
        MESSAGES.noLocaleConfigured,
        MESSAGES.selectFile,
        MESSAGES.autoDiscover,
        MESSAGES.ignoreTemporarily
      );
      if (result === MESSAGES.selectFile) {
        await selectAndSetLocaleFiles(rootPath);
      } else if (result === MESSAGES.autoDiscover) {
        await autoDiscoverLocaleFiles(rootPath);
      }
    }
  }

  loadLocalesAndRefresh(rootPath);
}

async function autoDiscoverLocaleFiles(rootPath: string): Promise<LocaleFileInfo[] | null> {
  const discovered = await platformRegistry.discoverLocaleFiles(rootPath);
  if (discovered.length === 0) {
    console.log('[i18n-swapper] 自动发现未找到语言文件');
    return null;
  }

  console.log(`[i18n-swapper] 自动发现 ${discovered.length} 个语言文件`);

  const items = discovered.map((file) => ({
    label: file.filePath,
    description: `${file.languageCode} (${file.format})`,
    picked: true,
    file,
  }));

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: `发现 ${discovered.length} 个语言文件，请选择要使用的文件`,
    canPickMany: true,
  });

  if (!selected || selected.length === 0) return null;

  const selectedPaths = selected.map((item) => item.file.filePath);
  await configManager.setLocalesPaths(selectedPaths);
  vscode.window.showInformationMessage(MESSAGES.filesAdded(selectedPaths.length));

  const mappings = selected.map((item) => ({
    languageCode: item.file.languageCode,
    filePath: item.file.filePath,
  }));
  await configManager.update('tencentTranslation.languageMappings', mappings);

  return selected.map((item) => item.file);
}

async function discoverFromDefaultRepository(rootPath: string): Promise<LocaleFileInfo[] | null> {
  if (!currentAdapter) return null;

  const repos = configManager.defaultRepositories;
  const repoPath = repos[currentAdapter.id];

  if (!repoPath) return null;

  const resolvedPath = path.isAbsolute(repoPath) ? repoPath : path.join(rootPath, repoPath);
  if (!fs.existsSync(resolvedPath)) {
    console.log(`[i18n-swapper] 默认仓库路径不存在: ${resolvedPath}`);
    return null;
  }

  console.log(`[i18n-swapper] 从默认仓库发现语言文件: ${resolvedPath}`);
  const discovered = await platformRegistry.discoverLocaleFilesFromPath(resolvedPath);
  if (discovered.length === 0) return null;

  const adjustedFiles = discovered.map((file) => ({
    ...file,
    filePath: path.isAbsolute(repoPath)
      ? path.join(repoPath, file.filePath).replace(/\\/g, '/')
      : path.join(repoPath, file.filePath).replace(/\\/g, '/'),
  }));

  const items = adjustedFiles.map((file) => ({
    label: file.filePath,
    description: `${file.languageCode} (${file.format}) — 来自默认仓库`,
    picked: true,
    file,
  }));

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: `从默认仓库发现 ${adjustedFiles.length} 个语言文件，请选择要使用的文件`,
    canPickMany: true,
  });

  if (!selected || selected.length === 0) return null;

  const selectedPaths = selected.map((item) => item.file.filePath);
  await configManager.setLocalesPaths(selectedPaths);
  vscode.window.showInformationMessage(MESSAGES.filesAdded(selectedPaths.length));

  const mappings = selected.map((item) => ({
    languageCode: item.file.languageCode,
    filePath: item.file.filePath,
  }));
  await configManager.update('tencentTranslation.languageMappings', mappings);

  return selected.map((item) => item.file);
}

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

function loadLocalesAndRefresh(rootPath: string): void {
  if (!platformModulesReady) return;
  const paths = configManager.localesPaths;
  if (paths.length > 0) {
    localeFileIO.loadSourceLocales(paths, rootPath);
    localeFileIO.loadAllLanguages(configManager.languageMappings, rootPath);
    keyResolver.rebuildIndex();
  }
  refreshActiveEditor();
}

function refreshActiveEditor(): void {
  if (!platformModulesReady) return;
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
  // 单体替换：选中文本 → t('key')
  context.subscriptions.push(
    vscode.commands.registerCommand('i18n-swapper.replaceWithI18n', (...args: unknown[]) => {
      if (!ensurePlatformReady('替换为国际化函数')) return;
      return createReplaceWithI18nCommand(textReplacer, configManager, getRootPath)(...args);
    })
  );

  // 快速批量替换：扫描当前文件 → 显示替换建议
  context.subscriptions.push(
    vscode.commands.registerCommand('i18n-swapper.quickBatchReplace', (...args: unknown[]) => {
      if (!ensurePlatformReady('快速批量替换')) return;
      return createQuickBatchReplaceCommand(
        textScanner, textReplacer, configManager, highlightService, getRootPath
      )(...args);
    })
  );

  // 确认单项替换（CodeLens 按钮调用）
  context.subscriptions.push(
    vscode.commands.registerCommand('i18n-swapper.confirmReplacement', (...args: unknown[]) => {
      if (!ensurePlatformReady()) return;
      return createConfirmReplacementCommand(
        textReplacer, configManager, getRootPath, () => refreshActiveEditor()
      )(...args);
    })
  );

  // 取消单项替换（CodeLens 按钮调用）
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'i18n-swapper.cancelReplacement',
      createCancelReplacementCommand(() => refreshActiveEditor())
    )
  );

  // 手动切换平台
  context.subscriptions.push(
    vscode.commands.registerCommand('i18n-swapper.switchPlatform', async () => {
      const selected = await platformRegistry.promptUserSelect();
      if (selected && selected.id !== currentAdapter?.id) {
        await platformRegistry.switchPlatform(selected);
      }
    })
  );

  // 自动发现语言文件
  context.subscriptions.push(
    vscode.commands.registerCommand('i18n-swapper.discoverLocaleFiles', async () => {
      if (!ensurePlatformReady('自动发现语言文件')) return;
      const rootPath = getRootPath();
      if (!rootPath) {
        vscode.window.showWarningMessage(MESSAGES.workspaceNotFound);
        return;
      }
      const result = await autoDiscoverLocaleFiles(rootPath);
      if (result && result.length > 0) {
        loadLocalesAndRefresh(rootPath);
      } else {
        vscode.window.showInformationMessage(MESSAGES.noLocaleFilesFound);
      }
    })
  );

  // 配置默认仓库路径
  context.subscriptions.push(
    vscode.commands.registerCommand('i18n-swapper.configureDefaultRepository', async () => {
      if (!ensurePlatformReady('配置默认仓库')) return;
      const folder = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: `选择 ${currentAdapter!.displayName} 默认多语言仓库目录`,
      });
      if (folder && folder.length > 0) {
        const repos = { ...configManager.defaultRepositories };
        repos[currentAdapter!.id] = folder[0].fsPath;
        await configManager.update('defaultRepositories', repos, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(
          `已设置 ${currentAdapter!.displayName} 默认仓库: ${folder[0].fsPath}`
        );
      }
    })
  );

  // 打开管理面板（始终可用，未就绪时提示）
  context.subscriptions.push(
    vscode.commands.registerCommand('i18n-swapper.openPanel', () => {
      if (panelBridge) {
        panelBridge.openPanel();
      } else {
        vscode.window.showWarningMessage(
          '管理面板需要先检测项目平台。请选择平台后再试。',
          '选择平台'
        ).then((choice) => {
          if (choice === '选择平台') {
            vscode.commands.executeCommand('i18n-swapper.switchPlatform');
          }
        });
      }
    })
  );

  // 刷新装饰
  context.subscriptions.push(
    vscode.commands.registerCommand('i18n-swapper.refreshDecorations', () => {
      if (!platformModulesReady) return;
      const rootPath = getRootPath();
      if (rootPath) loadLocalesAndRefresh(rootPath);
    })
  );

  // 设置语言文件路径（始终可用）
  context.subscriptions.push(
    vscode.commands.registerCommand('i18n-swapper.setLocalesPaths', async () => {
      const rootPath = getRootPath();
      if (rootPath) {
        await selectAndSetLocaleFiles(rootPath);
        if (platformModulesReady) loadLocalesAndRefresh(rootPath);
      }
    })
  );

  // 翻译 API 配置（始终可用）
  context.subscriptions.push(
    vscode.commands.registerCommand('i18n-swapper.openApiConfig', async () => {
      await vscode.commands.executeCommand(
        'workbench.action.openSettings',
        'i18n-swapper.tencentTranslation'
      );
    })
  );

  // 切换装饰模式（始终可用）
  context.subscriptions.push(
    vscode.commands.registerCommand('i18n-swapper.toggleDecorationStyle', async () => {
      const current = configManager.decorationStyle;
      const next = current === 'suffix' ? 'inline' : 'suffix';
      await configManager.update('decorationStyle', next);
      vscode.window.showInformationMessage(`装饰模式已切换为: ${next}`);
    })
  );

  // 复制键名（HoverProvider 中的链接调用）
  context.subscriptions.push(
    vscode.commands.registerCommand('i18n-swapper.copyKey', (key: string) => {
      vscode.env.clipboard.writeText(key);
      vscode.window.showInformationMessage(`已复制: ${key}`);
    })
  );

  // 编辑键值
  context.subscriptions.push(
    vscode.commands.registerCommand('i18n-swapper.editKey', async (key: string) => {
      if (!ensurePlatformReady('编辑键值')) return;
      const currentValue = localeStore.getValue(key) || '';
      const newValue = await vscode.window.showInputBox({
        prompt: `编辑键 "${key}" 的值`,
        value: currentValue,
      });

      if (newValue !== undefined && newValue !== currentValue) {
        const mappings = configManager.languageMappings;
        const sourceLang = configManager.sourceLanguage;
        const sourceMapping = mappings.find(
          (m) => m.languageCode === sourceLang || m.languageCode.startsWith(sourceLang + '-')
        );

        if (sourceMapping) {
          const rootPath = getRootPath();
          if (!rootPath) return;
          const filePath = path.isAbsolute(sourceMapping.filePath)
            ? sourceMapping.filePath
            : path.join(rootPath, sourceMapping.filePath);
          const success = await localeFileIO.saveTranslation(filePath, key, newValue);
          if (success) {
            loadLocalesAndRefresh(rootPath);
            vscode.window.showInformationMessage(`已更新: ${key} = ${newValue}`);
          }
        } else {
          vscode.window.showWarningMessage('未找到源语言文件映射，请先配置 languageMappings');
        }
      }
    })
  );

  // 翻译指定文本到目标语言（HoverProvider 调用）
  context.subscriptions.push(
    vscode.commands.registerCommand('i18n-swapper.translateText', async (params: {
      text: string;
      targetLang: string;
      i18nKey: string;
      filePath: string;
    }) => {
      if (!ensurePlatformReady('翻译')) return;
      if (!translationService.isConfigured) {
        vscode.window.showWarningMessage('翻译 API 未配置，请先设置 apiKey 和 apiSecret');
        return;
      }

      try {
        const translated = await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Notification, title: '正在翻译...' },
          () => translationService.translate(params.text, params.targetLang)
        );

        const rootPath = getRootPath();
        if (!rootPath) return;
        const filePath = path.isAbsolute(params.filePath)
          ? params.filePath
          : path.join(rootPath, params.filePath);

        await localeFileIO.saveTranslation(filePath, params.i18nKey, translated);
        loadLocalesAndRefresh(rootPath);
        vscode.window.showInformationMessage(`翻译完成: ${translated}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        vscode.window.showErrorMessage(`翻译失败: ${msg}`);
      }
    })
  );

  // 翻译到所有语言（HoverProvider 调用）
  context.subscriptions.push(
    vscode.commands.registerCommand('i18n-swapper.translateHover', async (params: {
      text: string;
      key: string;
    }) => {
      if (!ensurePlatformReady('翻译到所有语言')) return;
      if (!translationService.isConfigured) {
        vscode.window.showWarningMessage('翻译 API 未配置，请先设置 apiKey 和 apiSecret');
        return;
      }

      let { text, key } = params;

      if (!text) {
        text = await vscode.window.showInputBox({
          prompt: '请输入要翻译的文本',
          placeHolder: '例如：提交表单',
          validateInput: (input) => (input?.trim() ? null : '文本不能为空'),
        }) ?? '';
        if (!text) return;
      }

      const rootPath = getRootPath();
      if (!rootPath) return;

      const mappings = configManager.languageMappings;
      const sourceLang = configManager.sourceLanguage;
      const targetMappings = mappings.filter((m) => m.languageCode !== sourceLang);

      if (targetMappings.length === 0) {
        vscode.window.showWarningMessage('未配置目标语言映射，请先在 languageMappings 中配置');
        return;
      }

      try {
        await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Notification, title: '翻译中...', cancellable: false },
          async (progress) => {
            for (const mapping of targetMappings) {
              progress.report({ message: `正在翻译到 ${mapping.languageCode}...` });
              const translated = await translationService.translate(text, mapping.languageCode);
              const filePath = path.isAbsolute(mapping.filePath)
                ? mapping.filePath
                : path.join(rootPath, mapping.filePath);
              await localeFileIO.saveTranslation(filePath, key, translated);
            }

            const sourceMapping = mappings.find((m) => m.languageCode === sourceLang);
            if (sourceMapping) {
              const filePath = path.isAbsolute(sourceMapping.filePath)
                ? sourceMapping.filePath
                : path.join(rootPath, sourceMapping.filePath);
              await localeFileIO.saveTranslation(filePath, key, text);
            }
          }
        );

        loadLocalesAndRefresh(rootPath);
        const preview = text.length > 20 ? text.substring(0, 20) + '...' : text;
        vscode.window.showInformationMessage(`已翻译"${preview}"并保存到所有语言文件`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        vscode.window.showErrorMessage(`翻译失败: ${msg}`);
      }
    })
  );

  // 打开语言文件（HoverProvider 调用）
  context.subscriptions.push(
    vscode.commands.registerCommand('i18n-swapper.openLanguageFile', async (params: {
      filePath: string;
      i18nKey: string;
    }) => {
      const rootPath = getRootPath();
      if (!rootPath) return;
      const fullPath = path.isAbsolute(params.filePath)
        ? params.filePath
        : path.join(rootPath, params.filePath);

      try {
        const document = await vscode.workspace.openTextDocument(vscode.Uri.file(fullPath));
        const editor = await vscode.window.showTextDocument(document, {
          viewColumn: vscode.ViewColumn.Beside,
          preserveFocus: true,
        });

        const text = document.getText();
        const keyParts = params.i18nKey.split('.');
        const lastPart = keyParts[keyParts.length - 1];
        const keyIndex = text.indexOf(`"${lastPart}"`);
        if (keyIndex >= 0) {
          const pos = document.positionAt(keyIndex);
          editor.revealRange(
            new vscode.Range(pos, pos),
            vscode.TextEditorRevealType.InCenter
          );
        }
      } catch {
        vscode.window.showErrorMessage(`无法打开文件: ${fullPath}`);
      }
    })
  );

  // 编辑语言条目（HoverProvider 调用）
  context.subscriptions.push(
    vscode.commands.registerCommand('i18n-swapper.editLanguageEntry', async (params: {
      langCode: string;
      i18nKey: string;
      filePath: string;
      currentValue: string;
    }) => {
      if (!ensurePlatformReady('编辑翻译')) return;
      const newValue = await vscode.window.showInputBox({
        prompt: `编辑 ${params.langCode} 的 "${params.i18nKey}"`,
        value: params.currentValue,
      });

      if (newValue !== undefined && newValue !== params.currentValue) {
        const rootPath = getRootPath();
        if (!rootPath) return;
        const filePath = path.isAbsolute(params.filePath)
          ? params.filePath
          : path.join(rootPath, params.filePath);

        const success = await localeFileIO.saveTranslation(filePath, params.i18nKey, newValue);
        if (success) {
          loadLocalesAndRefresh(rootPath);
          vscode.window.showInformationMessage(`已更新: [${params.langCode}] ${params.i18nKey} = ${newValue}`);
        }
      }
    })
  );

  // 高亮定位文本（面板调用）
  context.subscriptions.push(
    vscode.commands.registerCommand('i18n-swapper.highlightText', async (params: {
      start: number;
      end: number;
      filePath?: string;
    }) => {
      if (params.filePath) {
        await highlightService.highlightInFile(params.filePath, params.start, params.end);
      } else {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          await highlightService.highlightRange(editor.document, params.start, params.end);
        }
      }
    })
  );
}

export function deactivate() {
  console.log('[i18n-swapper] 插件已停用');
}
