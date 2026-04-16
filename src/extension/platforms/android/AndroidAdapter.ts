/**
 * Android 平台适配器
 * 支持 strings.xml 语言文件 + R.string.xxx/stringResource() 调用模式
 */
import * as fs from 'fs';
import * as path from 'path';
import type { IPlatformAdapter, DiscoverOptions } from '../types';
import type { LocaleFileInfo, PlatformId } from '../../core/types';
import { AndroidParser } from './AndroidParser';
import { AndroidMatcher } from './AndroidMatcher';
import { AndroidReplacer } from './AndroidReplacer';

export class AndroidAdapter implements IPlatformAdapter {
  readonly id: PlatformId = 'android';
  readonly displayName = 'Android (Kotlin/Java)';

  readonly parser = new AndroidParser();
  readonly matcher = new AndroidMatcher();
  readonly replacer = new AndroidReplacer();

  readonly supportedExtensions = ['.kt', '.java', '.xml'];
  readonly activationLanguages = ['kotlin', 'java', 'xml'];

  async detect(rootPath: string): Promise<boolean> {
    const indicators = [
      'build.gradle',
      'build.gradle.kts',
      'AndroidManifest.xml',
      path.join('app', 'build.gradle'),
      path.join('app', 'build.gradle.kts'),
      path.join('app', 'src', 'main', 'AndroidManifest.xml'),
    ];

    return indicators.some((indicator) =>
      fs.existsSync(path.join(rootPath, indicator))
    );
  }

  private static readonly SKIP_DIRS = new Set([
    'build', '.gradle', '.idea', 'node_modules', '.git', 'gradle', '.cxx',
  ]);

  private static readonly MAX_SCAN_DEPTH = 6;

  async discoverLocaleFiles(rootPath: string, options?: DiscoverOptions): Promise<LocaleFileInfo[]> {
    const results: LocaleFileInfo[] = [];

    if (options?.localeResSubPaths && options.localeResSubPaths.length > 0) {
      for (const subPath of options.localeResSubPaths) {
        const resDir = path.join(rootPath, subPath);
        if (fs.existsSync(resDir)) {
          this.collectValuesFromRes(resDir, rootPath, results);
        }
      }
    } else {
      this.scanForResValuesDirs(rootPath, rootPath, results, 0);
    }

    return results;
  }

  /**
   * 递归扫描多模块项目中的 res/values[locale]/strings.xml
   * 匹配如 {module}/src/main/res/values-xx/strings.xml 或直接 res/values-xx/strings.xml
   */
  private scanForResValuesDirs(
    dir: string,
    rootPath: string,
    results: LocaleFileInfo[],
    depth: number
  ): void {
    if (depth > AndroidAdapter.MAX_SCAN_DEPTH) return;

    try {
      const entries = fs.readdirSync(dir);

      for (const entry of entries) {
        if (AndroidAdapter.SKIP_DIRS.has(entry)) continue;

        const fullPath = path.join(dir, entry);

        if (entry === 'res') {
          this.collectValuesFromRes(fullPath, rootPath, results);
          continue;
        }

        try {
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            this.scanForResValuesDirs(fullPath, rootPath, results, depth + 1);
          }
        } catch {
          // stat 失败时跳过
        }
      }
    } catch {
      // 目录读取失败时跳过
    }
  }

  private collectValuesFromRes(
    resDir: string,
    rootPath: string,
    results: LocaleFileInfo[]
  ): void {
    try {
      const dirs = fs.readdirSync(resDir);
      for (const dir of dirs) {
        if (!dir.startsWith('values')) continue;

        const stringsPath = path.join(resDir, dir, 'strings.xml');
        if (!fs.existsSync(stringsPath)) continue;

        const langCode = this.extractLanguageCode(dir);
        const relativePath = path.relative(rootPath, stringsPath).replace(/\\/g, '/');
        results.push({
          languageCode: langCode,
          filePath: relativePath,
          format: 'xml',
        });
      }
    } catch {
      // 目录读取失败时跳过
    }
  }

  /**
   * 从 values 目录名提取语言代码
   * values → default (通常为英文或项目默认语言)
   * values-zh → zh
   * values-zh-rCN → zh-CN
   * values-pt-rBR → pt-BR
   */
  private extractLanguageCode(dirName: string): string {
    if (dirName === 'values') return 'default';

    const suffix = dirName.replace('values-', '');
    // Android 用 -r 前缀表示地区，如 zh-rCN → zh-CN
    return suffix.replace(/-r([A-Z]{2})/, '-$1');
  }
}
