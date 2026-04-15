/**
 * Android 平台适配器
 * 支持 strings.xml 语言文件 + R.string.xxx/stringResource() 调用模式
 */
import * as fs from 'fs';
import * as path from 'path';
import type { IPlatformAdapter } from '../types';
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

  async discoverLocaleFiles(rootPath: string): Promise<LocaleFileInfo[]> {
    const results: LocaleFileInfo[] = [];

    const resPaths = [
      path.join('app', 'src', 'main', 'res'),
      'res',
    ];

    for (const resRelative of resPaths) {
      const resDir = path.join(rootPath, resRelative);
      if (!fs.existsSync(resDir)) continue;

      try {
        const dirs = fs.readdirSync(resDir);
        for (const dir of dirs) {
          if (!dir.startsWith('values')) continue;

          const stringsPath = path.join(resDir, dir, 'strings.xml');
          if (!fs.existsSync(stringsPath)) continue;

          const langCode = this.extractLanguageCode(dir);
          results.push({
            languageCode: langCode,
            filePath: path.join(resRelative, dir, 'strings.xml').replace(/\\/g, '/'),
            format: 'xml',
          });
        }
      } catch {
        // 目录读取失败时跳过
      }
    }

    return results;
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
