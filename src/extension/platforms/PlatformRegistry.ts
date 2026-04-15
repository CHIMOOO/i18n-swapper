/**
 * 平台注册中心
 * 管理所有平台适配器的注册、检测和获取
 * Phase 6: 增加状态栏指示器、平台切换、检测结果持久化
 */
import * as vscode from 'vscode';
import type { IPlatformAdapter } from './types';
import type { PlatformId } from '../core/types';
import type { LocaleFileInfo } from '../core/types';
import { WebAdapter } from './web/WebAdapter';
import { AndroidAdapter } from './android/AndroidAdapter';
import { iOSAdapter } from './ios/iOSAdapter';

const PLATFORM_ICONS: Record<PlatformId, string> = {
  web: '$(globe)',
  android: '$(device-mobile)',
  ios: '$(device-mobile)',
};

export class PlatformRegistry implements vscode.Disposable {
  private adapters = new Map<PlatformId, IPlatformAdapter>();
  private currentAdapter: IPlatformAdapter | null = null;
  private statusBarItem: vscode.StatusBarItem;
  private _onDidChangePlatform = new vscode.EventEmitter<IPlatformAdapter>();
  readonly onDidChangePlatform = this._onDidChangePlatform.event;

  constructor() {
    this.registerBuiltinAdapters();
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.command = 'i18n-swapper.switchPlatform';
    this.statusBarItem.tooltip = '点击切换 i18n 平台';
  }

  private registerBuiltinAdapters(): void {
    this.register(new WebAdapter());
    this.register(new AndroidAdapter());
    this.register(new iOSAdapter());
  }

  /** 注册一个平台适配器 */
  register(adapter: IPlatformAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  /** 获取指定平台的适配器 */
  get(id: PlatformId): IPlatformAdapter | undefined {
    return this.adapters.get(id);
  }

  /** 获取当前激活的适配器 */
  getCurrent(): IPlatformAdapter | null {
    return this.currentAdapter;
  }

  /** 获取所有已注册的适配器 */
  getAll(): IPlatformAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * 根据配置或自动检测设置当前平台
   * @param platformConfig 用户配置的平台值
   * @param rootPath 工作区根路径
   */
  async resolve(platformConfig: PlatformId | 'auto', rootPath: string): Promise<IPlatformAdapter> {
    if (platformConfig !== 'auto') {
      const adapter = this.adapters.get(platformConfig);
      if (adapter) {
        this.setCurrentAdapter(adapter);
        console.log(`[i18n-swapper] 使用配置的平台: ${adapter.displayName}`);
        return adapter;
      }
      console.warn(`[i18n-swapper] 配置的平台 "${platformConfig}" 未注册，回退到自动检测`);
    }

    return this.autoDetect(rootPath);
  }

  /**
   * 自动检测工作区的项目类型
   * 检测优先级：Android > iOS > Web（因为 Web 检测最宽松）
   */
  private async autoDetect(rootPath: string): Promise<IPlatformAdapter> {
    const detectionOrder: PlatformId[] = ['android', 'ios', 'web'];

    for (const id of detectionOrder) {
      const adapter = this.adapters.get(id);
      if (!adapter) continue;

      try {
        const detected = await adapter.detect(rootPath);
        if (detected) {
          this.setCurrentAdapter(adapter);
          console.log(`[i18n-swapper] 自动检测到平台: ${adapter.displayName}`);
          return adapter;
        }
      } catch (e) {
        console.error(`[i18n-swapper] 检测平台 ${id} 时出错:`, e);
      }
    }

    const selected = await this.promptUserSelect();
    if (selected) {
      this.setCurrentAdapter(selected);
      return selected;
    }

    const webAdapter = this.adapters.get('web')!;
    this.setCurrentAdapter(webAdapter);
    console.log('[i18n-swapper] 回退到默认平台: Web');
    return webAdapter;
  }

  /** 提示用户手动选择平台 */
  async promptUserSelect(): Promise<IPlatformAdapter | null> {
    const items = this.getAll().map((adapter) => ({
      label: `${PLATFORM_ICONS[adapter.id]} ${adapter.displayName}`,
      description: this.currentAdapter?.id === adapter.id ? '(当前)' : '',
      adapter,
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: '选择项目平台类型',
      canPickMany: false,
    });

    return selected?.adapter ?? null;
  }

  /**
   * 手动切换到指定平台并持久化到工作区配置
   */
  async switchPlatform(adapter: IPlatformAdapter): Promise<void> {
    this.setCurrentAdapter(adapter);
    await vscode.workspace.getConfiguration('i18n-swapper').update(
      'platform',
      adapter.id,
      vscode.ConfigurationTarget.Workspace
    );
    this._onDidChangePlatform.fire(adapter);
    vscode.window.showInformationMessage(`i18n 平台已切换为: ${adapter.displayName}`);
  }

  /**
   * 使用当前适配器自动发现语言文件
   */
  async discoverLocaleFiles(rootPath: string): Promise<LocaleFileInfo[]> {
    if (!this.currentAdapter) return [];
    return this.currentAdapter.discoverLocaleFiles(rootPath);
  }

  /**
   * 使用指定路径（可以是外部仓库路径）自动发现语言文件
   */
  async discoverLocaleFilesFromPath(repoPath: string): Promise<LocaleFileInfo[]> {
    if (!this.currentAdapter) return [];
    return this.currentAdapter.discoverLocaleFiles(repoPath);
  }

  private setCurrentAdapter(adapter: IPlatformAdapter): void {
    this.currentAdapter = adapter;
    this.updateStatusBar(adapter);
  }

  private updateStatusBar(adapter: IPlatformAdapter): void {
    const icon = PLATFORM_ICONS[adapter.id];
    this.statusBarItem.text = `${icon} i18n: ${adapter.displayName}`;
    this.statusBarItem.show();
  }

  dispose(): void {
    this.statusBarItem.dispose();
    this._onDidChangePlatform.dispose();
  }
}
