/**
 * iOS 平台适配器
 * 支持 .strings 语言文件 + NSLocalizedString/String(localized:) 调用模式
 */
import * as fs from 'fs';
import * as path from 'path';
import type { IPlatformAdapter } from '../types';
import type { LocaleFileInfo, PlatformId } from '../../core/types';
import { iOSParser } from './iOSParser';
import { iOSMatcher } from './iOSMatcher';
import { iOSReplacer } from './iOSReplacer';

export class iOSAdapter implements IPlatformAdapter {
  readonly id: PlatformId = 'ios';
  readonly displayName = 'iOS (Swift/Objective-C)';

  readonly parser = new iOSParser();
  readonly matcher = new iOSMatcher();
  readonly replacer = new iOSReplacer();

  readonly supportedExtensions = ['.swift', '.m', '.mm', '.storyboard', '.xib'];
  readonly activationLanguages = ['swift', 'objective-c', 'objective-cpp'];

  async detect(rootPath: string): Promise<boolean> {
    // 检查标志性文件
    const directIndicators = [
      'Podfile',
      'Package.swift',
    ];

    if (directIndicators.some((f) => fs.existsSync(path.join(rootPath, f)))) {
      return true;
    }

    // 检查 .xcodeproj 或 .xcworkspace 目录
    try {
      const entries = fs.readdirSync(rootPath);
      return entries.some(
        (entry) => entry.endsWith('.xcodeproj') || entry.endsWith('.xcworkspace')
      );
    } catch {
      return false;
    }
  }

  async discoverLocaleFiles(rootPath: string): Promise<LocaleFileInfo[]> {
    const results: LocaleFileInfo[] = [];
    this.scanForLprojDirs(rootPath, rootPath, results, 0);
    return results;
  }

  /**
   * 递归扫描 .lproj 目录，查找 Localizable.strings 文件
   * 限制递归深度避免性能问题
   */
  private scanForLprojDirs(
    dir: string,
    rootPath: string,
    results: LocaleFileInfo[],
    depth: number
  ): void {
    if (depth > 5) return;

    try {
      const entries = fs.readdirSync(dir);

      for (const entry of entries) {
        if (entry === 'node_modules' || entry === '.git' || entry === 'Pods' || entry === 'build') {
          continue;
        }

        const fullPath = path.join(dir, entry);

        if (entry.endsWith('.lproj')) {
          const stringsFile = path.join(fullPath, 'Localizable.strings');
          if (fs.existsSync(stringsFile)) {
            const langCode = this.extractLanguageCode(entry);
            const relativePath = path.relative(rootPath, stringsFile).replace(/\\/g, '/');
            results.push({
              languageCode: langCode,
              filePath: relativePath,
              format: 'strings',
            });
          }
          continue;
        }

        try {
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            this.scanForLprojDirs(fullPath, rootPath, results, depth + 1);
          }
        } catch {
          // stat 失败时跳过
        }
      }
    } catch {
      // 目录读取失败时跳过
    }
  }

  /**
   * 从 .lproj 目录名提取语言代码
   * en.lproj → en
   * zh-Hans.lproj → zh-Hans
   * Base.lproj → Base
   */
  private extractLanguageCode(dirName: string): string {
    return dirName.replace('.lproj', '');
  }
}
