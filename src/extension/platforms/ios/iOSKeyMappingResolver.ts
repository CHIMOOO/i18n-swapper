/**
 * iOS Key Mapping 解析器
 * 解析 Swift 枚举/结构体文件（如 UGLocalizableKey.swift, UGStringMapping.swift），
 * 构建属性名 → 实际 i18n key 的映射表
 */
import * as fs from 'fs';

const STATIC_LET_RE = /static\s+let\s+(\w+)\s*=\s*"([^"]*)"/g;

export class iOSKeyMappingResolver {
  /** 命名空间 → { 属性名: 实际key } */
  private mappings = new Map<string, Map<string, string>>();

  /**
   * 从 Swift 文件加载 key 映射表
   * @param filePath Swift 文件绝对路径
   * @param namespace 命名空间（如 "UGLocalizableKey", "UGStringMapping"）
   */
  loadFromFile(filePath: string, namespace: string): void {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const map = new Map<string, string>();
      let match: RegExpExecArray | null;

      const regex = new RegExp(STATIC_LET_RE.source, STATIC_LET_RE.flags);
      while ((match = regex.exec(content)) !== null) {
        const propName = match[1];
        const keyValue = match[2];
        map.set(propName, keyValue);
      }

      this.mappings.set(namespace, map);
      console.log(`[i18n-swapper] 加载 ${namespace} key 映射: ${map.size} 条`);
    } catch (e) {
      console.error(`[i18n-swapper] 加载 key mapping 文件失败: ${filePath}`, e);
    }
  }

  /**
   * 解析间接引用的 key
   * @param namespace 命名空间 (如 "UGLocalizableKey")
   * @param propName 属性名 (如 "str1000003")
   * @returns 实际 key (如 "1000003") 或 undefined
   */
  resolve(namespace: string, propName: string): string | undefined {
    return this.mappings.get(namespace)?.get(propName);
  }

  /** 检查某个命名空间是否已加载 */
  hasNamespace(namespace: string): boolean {
    return this.mappings.has(namespace);
  }

  /** 清空所有映射 */
  clear(): void {
    this.mappings.clear();
  }
}
