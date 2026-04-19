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

  readonly defaultFunctionName = 'getString';
  readonly availableFunctionNames = ['getString', 'stringResource', 'R.string', '@string'];

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

  /**
   * 收集 res/ 下的多语言 strings.xml
   * 规则：
   *  1. 仅识别 values-XXX/（带连字符）目录，跳过纯 values/
   *  2. XXX 必须是合法语言限定符（排除 sw320dp、v26、land、night、xxhdpi 等非语言限定符）
   *  3. 该 res 目录必须同时存在 values-en* 与 values-zh* 才视为多语言目录
   *     （避免把仅含屏幕/夜间等限定符的 res 目录误判为 i18n 源）
   */
  private collectValuesFromRes(
    resDir: string,
    rootPath: string,
    results: LocaleFileInfo[]
  ): void {
    try {
      const dirs = fs.readdirSync(resDir);

      const candidates: { dir: string; suffix: string; stringsPath: string }[] = [];
      let hasEn = false;
      let hasZh = false;

      for (const dir of dirs) {
        if (!dir.startsWith('values-')) continue;

        const suffix = dir.slice('values-'.length);
        if (!AndroidAdapter.isLanguageQualifier(suffix)) continue;

        const stringsPath = path.join(resDir, dir, 'strings.xml');
        if (!fs.existsSync(stringsPath)) continue;

        candidates.push({ dir, suffix, stringsPath });

        const langLower = suffix.toLowerCase();
        if (langLower === 'en' || langLower.startsWith('en-')) hasEn = true;
        if (langLower === 'zh' || langLower.startsWith('zh-')) hasZh = true;
      }

      if (!hasEn || !hasZh) return;

      for (const { dir, stringsPath } of candidates) {
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

  private static readonly NON_LANG_QUALIFIERS = new Set([
    'land', 'port',
    'night', 'notnight',
    'large', 'small', 'xlarge', 'normal',
    'long', 'notlong',
    'round', 'notround',
    'widecg', 'nowidecg',
    'highdr', 'lowdr',
    'car', 'tv', 'desk', 'appliance', 'watch', 'vrheadset', 'television',
    'ldpi', 'mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi', 'tvdpi', 'nodpi', 'anydpi',
    'keysexposed', 'keyshidden', 'keyssoft',
    'nokeys', 'qwerty', '12key',
    'navexposed', 'navhidden',
    'nonav', 'dpad', 'trackball', 'wheel',
    'finger', 'notouch', 'stylus',
    'rtl', 'ltr',
  ]);

  private static readonly NON_LANG_PATTERNS: RegExp[] = [
    /^sw\d+dp$/,   // smallest width
    /^w\d+dp$/,    // available width
    /^h\d+dp$/,    // available height
    /^v\d+$/,      // platform version
    /^\d+x\d+$/,   // screen pixel size (legacy)
    /dpi$/,        // 兜底匹配密度
  ];

  /**
   * 判断 values-XXX 中的 XXX 是否为合法语言限定符
   * 合法形式：
   *   - 2~3 位小写字母（ISO 639-1/639-2，如 en/zh/fil）
   *   - xx-rXX（带地区，如 zh-rCN/pt-rBR）
   *   - b+xx[+...]（BCP 47 形式，如 b+sr+Latn）
   */
  private static isLanguageQualifier(suffix: string): boolean {
    if (!suffix) return false;
    if (AndroidAdapter.NON_LANG_QUALIFIERS.has(suffix)) return false;
    if (AndroidAdapter.NON_LANG_PATTERNS.some((re) => re.test(suffix))) return false;

    if (/^b\+[A-Za-z][A-Za-z0-9]*(?:\+[A-Za-z0-9]+)*$/.test(suffix)) return true;
    if (/^[a-z]{2,3}(?:-r[A-Z]{2})?$/.test(suffix)) return true;

    return false;
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
