/**
 * 平台注册中心
 * 管理所有平台适配器的注册、检测和获取
 */
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import type { IPlatformAdapter } from './types';
import type { PlatformId } from '../core/types';
import { WebAdapter } from './web/WebAdapter';

export class PlatformRegistry {
  private adapters = new Map<PlatformId, IPlatformAdapter>();
  private currentAdapter: IPlatformAdapter | null = null;

  constructor() {
    this.registerBuiltinAdapters();
  }

  private registerBuiltinAdapters(): void {
    this.register(new WebAdapter());
    // Phase 5 将注册 AndroidAdapter 和 iOSAdapter
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
        this.currentAdapter = adapter;
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
          this.currentAdapter = adapter;
          console.log(`[i18n-swapper] 自动检测到平台: ${adapter.displayName}`);
          return adapter;
        }
      } catch (e) {
        console.error(`[i18n-swapper] 检测平台 ${id} 时出错:`, e);
      }
    }

    // 没有检测到任何平台时，提示用户选择
    const selected = await this.promptUserSelect();
    if (selected) {
      this.currentAdapter = selected;
      return selected;
    }

    // 最终回退到 Web
    const webAdapter = this.adapters.get('web')!;
    this.currentAdapter = webAdapter;
    console.log('[i18n-swapper] 回退到默认平台: Web');
    return webAdapter;
  }

  /** 提示用户手动选择平台 */
  private async promptUserSelect(): Promise<IPlatformAdapter | null> {
    const items = this.getAll().map((adapter) => ({
      label: adapter.displayName,
      description: adapter.id,
      adapter,
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: '无法自动识别项目类型，请选择平台',
      canPickMany: false,
    });

    return selected?.adapter ?? null;
  }
}
