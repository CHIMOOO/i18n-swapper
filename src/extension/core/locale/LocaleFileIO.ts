/**
 * 语言文件读写服务
 * 委托给平台 parser 进行解析/序列化
 */
import * as fs from 'fs';
import * as path from 'path';
import type { ILocaleParser } from '../../platforms/types';
import type { NestedLocaleData } from '../types';
import type { LanguageMapping } from '../config/types';
import { LocaleStore } from './LocaleStore';

export class LocaleFileIO {
  constructor(
    private parser: ILocaleParser,
    private store: LocaleStore
  ) {}

  setParser(parser: ILocaleParser): void {
    this.parser = parser;
  }

  /**
   * 加载源语言文件到扁平缓存
   */
  loadSourceLocales(localesPaths: string[], rootPath: string): void {
    this.store.setFlatData({});

    for (const localePath of localesPaths) {
      try {
        const fullPath = path.join(rootPath, localePath);
        if (!fs.existsSync(fullPath)) {
          console.log(`[i18n-swapper] 语言文件不存在，已跳过: ${fullPath}`);
          continue;
        }
        const content = fs.readFileSync(fullPath, 'utf8');
        const flatData = this.parser.parse(content, fullPath);
        this.store.mergeFlatData(flatData);
        console.log(`[i18n-swapper] 已加载: ${localePath}, 键数: ${Object.keys(flatData).length}`);
      } catch (e) {
        console.error(`[i18n-swapper] 加载语言文件失败 ${localePath}:`, e);
      }
    }

    console.log(`[i18n-swapper] 总计 ${this.store.keyCount} 个键值`);
  }

  /**
   * 加载所有语言的嵌套数据（用于悬浮面板多语言展示）
   */
  loadAllLanguages(languageMappings: LanguageMapping[], rootPath: string): void {
    for (const mapping of languageMappings) {
      try {
        if (!mapping.filePath) continue;
        const fullPath = path.join(rootPath, mapping.filePath);
        if (!fs.existsSync(fullPath)) {
          this.store.setLanguageData(mapping.languageCode, {});
          continue;
        }
        const content = fs.readFileSync(fullPath, 'utf8');
        const data = this.parser.parseNested(content, fullPath);
        this.store.setLanguageData(mapping.languageCode, data);
      } catch (e) {
        console.error(`[i18n-swapper] 加载语言文件失败 (${mapping.languageCode}):`, e);
      }
    }
  }

  /**
   * 将翻译值写入语言文件
   */
  async saveTranslation(filePath: string, key: string, value: string): Promise<boolean> {
    try {
      let data: NestedLocaleData = {};

      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        data = this.parser.parseNested(content, filePath);
      } else {
        const dirPath = path.dirname(filePath);
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }      }

      if (this.parser.useFlatKeys) {
        // 扁平键解析器（iOS .strings / Android strings.xml）：
        // key 中的 `.` 不表示嵌套，直接作为完整 key 赋值
        (data as Record<string, unknown>)[key] = value;
      } else {
        const keyParts = key.split('.');
        let current: Record<string, unknown> = data as Record<string, unknown>;
        for (let i = 0; i < keyParts.length - 1; i++) {
          const part = keyParts[i];
          if (!current[part] || typeof current[part] !== 'object') {
            current[part] = {};
          }
          current = current[part] as Record<string, unknown>;
        }
        current[keyParts[keyParts.length - 1]] = value;
      }

      const serialized = this.parser.serialize(data, filePath);
      fs.writeFileSync(filePath, serialized, 'utf8');
      return true;
    } catch (e) {
      console.error('[i18n-swapper] 写入语言文件失败:', e);
      return false;
    }
  }
}
