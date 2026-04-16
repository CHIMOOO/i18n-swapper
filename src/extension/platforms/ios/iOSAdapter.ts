/**
 * iOS 平台适配器
 * 支持 .strings 语言文件 + NSLocalizedString/String(localized:)/.curLocalized 调用模式
 */
import * as fs from 'fs';
import * as path from 'path';
import type { IPlatformAdapter, DiscoverOptions } from '../types';
import type { LocaleFileInfo, PlatformId } from '../../core/types';
import { iOSParser } from './iOSParser';
import { iOSMatcher } from './iOSMatcher';
import { iOSReplacer } from './iOSReplacer';

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'Pods', 'build', 'DerivedData', '.build', 'Carthage',
]);

const KEY_MAPPING_FILENAMES = ['UGLocalizableKey.swift', 'UGStringMapping.swift'];
const MAX_SCAN_DEPTH = 6;

export class iOSAdapter implements IPlatformAdapter {
  readonly id: PlatformId = 'ios';
  readonly displayName = 'iOS (Swift/Objective-C)';

  readonly parser = new iOSParser();
  readonly matcher = new iOSMatcher();
  readonly replacer = new iOSReplacer();

  readonly supportedExtensions = ['.swift', '.m', '.mm', '.storyboard', '.xib'];
  readonly activationLanguages = ['swift', 'objective-c', 'objective-cpp'];

  async detect(rootPath: string): Promise<boolean> {
    const directIndicators = ['Podfile', 'Package.swift'];

    if (directIndicators.some((f) => fs.existsSync(path.join(rootPath, f)))) {
      return true;
    }

    try {
      const entries = fs.readdirSync(rootPath);
      return entries.some(
        (entry) => entry.endsWith('.xcodeproj') || entry.endsWith('.xcworkspace')
      );
    } catch {
      return false;
    }
  }

  async discoverLocaleFiles(rootPath: string, options?: DiscoverOptions): Promise<LocaleFileInfo[]> {
    const results: LocaleFileInfo[] = [];
    const keyMappingFiles: string[] = [];
    this.scanDirectory(rootPath, rootPath, results, keyMappingFiles, 0);

    if (options?.keyMappingFiles) {
      for (const relPath of options.keyMappingFiles) {
        const absPath = path.isAbsolute(relPath) ? relPath : path.join(rootPath, relPath);
        if (fs.existsSync(absPath) && !keyMappingFiles.includes(absPath)) {
          keyMappingFiles.push(absPath);
        }
      }
    }

    if (keyMappingFiles.length > 0) {
      await this.matcher.loadKeyMappings!(rootPath, keyMappingFiles);
    }

    return results;
  }

  /**
   * 递归扫描目录，同时查找:
   * 1. .lproj/Localizable.strings 语言文件
   * 2. key mapping Swift 文件 (UGLocalizableKey.swift, UGStringMapping.swift)
   */
  private scanDirectory(
    dir: string,
    rootPath: string,
    results: LocaleFileInfo[],
    keyMappingFiles: string[],
    depth: number
  ): void {
    if (depth > MAX_SCAN_DEPTH) return;

    try {
      const entries = fs.readdirSync(dir);

      for (const entry of entries) {
        if (SKIP_DIRS.has(entry)) continue;

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

        if (KEY_MAPPING_FILENAMES.includes(entry)) {
          try {
            const stat = fs.statSync(fullPath);
            if (stat.isFile()) {
              keyMappingFiles.push(fullPath);
            }
          } catch {
            // stat 失败时跳过
          }
          continue;
        }

        try {
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            this.scanDirectory(fullPath, rootPath, results, keyMappingFiles, depth + 1);
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
