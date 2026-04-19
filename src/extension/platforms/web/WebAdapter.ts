/**
 * Web 平台适配器
 * 支持 JSON/JS 语言文件 + t()/$t() 调用模式
 */
import * as fs from 'fs';
import * as path from 'path';
import type { IPlatformAdapter } from '../types';
import type { LocaleFileInfo, PlatformId } from '../../core/types';
import { WebParser } from './WebParser';
import { WebMatcher } from './WebMatcher';
import { WebReplacer } from './WebReplacer';

export class WebAdapter implements IPlatformAdapter {
  readonly id: PlatformId = 'web';
  readonly displayName = 'Web (Vue/React/Angular)';

  readonly parser = new WebParser();
  readonly matcher = new WebMatcher();
  readonly replacer = new WebReplacer();

  readonly supportedExtensions = ['.js', '.jsx', '.ts', '.tsx', '.vue', '.html'];
  readonly activationLanguages = [
    'javascript', 'typescript', 'javascriptreact', 'typescriptreact', 'vue', 'html',
  ];

  readonly defaultFunctionName = 't';
  readonly availableFunctionNames = ['t', '$t', 'i18n.t', 'i18next.t'];

  async detect(rootPath: string): Promise<boolean> {
    const packageJsonPath = path.join(rootPath, 'package.json');
    return fs.existsSync(packageJsonPath);
  }

  async discoverLocaleFiles(rootPath: string, _options?: import('../types').DiscoverOptions): Promise<LocaleFileInfo[]> {
    const results: LocaleFileInfo[] = [];
    const commonPaths = [
      'src/locales',
      'src/locale',
      'src/i18n',
      'locales',
      'locale',
      'i18n',
      'src/lang',
      'lang',
    ];

    for (const relativePath of commonPaths) {
      const dirPath = path.join(rootPath, relativePath);
      if (!fs.existsSync(dirPath)) continue;

      try {
        const files = fs.readdirSync(dirPath);
        for (const file of files) {
          const ext = path.extname(file).toLowerCase();
          if (ext !== '.json' && ext !== '.js') continue;

          const langCode = path.basename(file, ext);
          results.push({
            languageCode: langCode,
            filePath: path.join(relativePath, file).replace(/\\/g, '/'),
            format: ext === '.json' ? 'json' : 'js',
          });
        }
      } catch {
        // 目录读取失败时跳过
      }
    }

    return results;
  }
}
