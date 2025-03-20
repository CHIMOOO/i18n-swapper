const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const defaultsConfig = require('../../config/defaultsConfig');

/**
 * i18n键状态管理服务
 * 负责检查和管理i18n键在不同语言文件中的状态
 */
class I18nKeyStatusService {
  constructor() {
    // 状态缓存
    this.statusCache = new Map();
  }

  /**
   * 加载所有国际化键的翻译状态
   * @param {Array} items 需要检查状态的项目数组
   * @param {Array} languageMappings 语言映射配置
   * @returns {Promise<void>}
   */
  async loadI18nKeysStatus(items, languageMappings) {
    try {
      // 获取工作区根目录
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) return;
      const rootPath = workspaceFolders[0].uri.fsPath;
      
      // 为每个项目加载翻译状态
      for (const item of items) {
        if (!item.i18nKey) continue;

        // 如果不存在翻译状态对象，则创建一个
        if (!item.i18nStatus) {
          item.i18nStatus = {};
        }

        // 遍历每种语言，检查键是否存在
        for (const mapping of languageMappings) {
          try {
            const fullPath = path.join(rootPath, mapping.filePath);

            // 检查文件是否存在
            if (!fs.existsSync(fullPath)) {
              item.i18nStatus[mapping.languageCode] = {
                exists: false,
                value: null,
                error: '文件不存在'
              };
              continue;
            }

            // 读取文件内容
            const fileContent = fs.readFileSync(fullPath, 'utf8');
            let i18nData;

            // 解析文件内容
            if (fullPath.endsWith('.json')) {
              i18nData = JSON.parse(fileContent);
            } else if (fullPath.endsWith('.js')) {
              // 简单解析JS模块导出
              const match = fileContent.match(/export\s+default\s+({[\s\S]*?});?$/m);
              if (match && match[1]) {
                i18nData = Function(`return ${match[1]}`)();
              } else {
                item.i18nStatus[mapping.languageCode] = {
                  exists: false,
                  value: null,
                  error: '无法解析JS文件'
                };
                continue;
              }
            } else {
              item.i18nStatus[mapping.languageCode] = {
                exists: false,
                value: null,
                error: '不支持的文件类型'
              };
              continue;
            }

            // 获取嵌套键的值
            const keyParts = item.i18nKey.split('.');
            let value = i18nData;
            let exists = true;

            for (const part of keyParts) {
              if (value && typeof value === 'object' && part in value) {
                value = value[part];
              } else {
                exists = false;
                value = null;
                break;
              }
            }

            // 保存状态
            item.i18nStatus[mapping.languageCode] = {
              exists,
              value: exists ? value : null
            };
          } catch (error) {
            console.error(`加载键 ${item.i18nKey} 的 ${mapping.languageCode} 翻译状态时出错:`, error);
            item.i18nStatus[mapping.languageCode] = {
              exists: false,
              value: null,
              error: error.message
            };
          }
        }
      }
    } catch (error) {
      console.error('加载国际化键状态时出错:', error);
    }
  }

  /**
   * 检查单个国际化键在各语言中的状态
   * @param {Object} item 要检查的项目
   * @param {string} key 要检查的国际化键
   * @param {Array} languageMappings 语言映射配置
   * @returns {Promise<Object>} 键的状态信息
   */
  async checkI18nKeyStatus(item, key, languageMappings) {
    try {
      if (!key) return null;

      // 获取工作区根目录
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) return null;
      const rootPath = workspaceFolders[0].uri.fsPath;

      // 更新项的键值
      item.i18nKey = key;

      // 初始化状态对象
      if (!item.i18nStatus) {
        item.i18nStatus = {};
      }

      // 检查每种语言中的状态
      for (const mapping of languageMappings) {
        try {
          const fullPath = path.join(rootPath, mapping.filePath);

          // 检查文件是否存在
          if (!fs.existsSync(fullPath)) {
            item.i18nStatus[mapping.languageCode] = {
              exists: false,
              value: null,
              error: '文件不存在'
            };
            continue;
          }

          // 读取文件内容
          const fileContent = fs.readFileSync(fullPath, 'utf8');
          let i18nData;

          // 解析文件内容
          if (fullPath.endsWith('.json')) {
            i18nData = JSON.parse(fileContent);
          } else if (fullPath.endsWith('.js')) {
            // 简单解析JS模块导出
            const match = fileContent.match(/export\s+default\s+({[\s\S]*?});?$/m);
            if (match && match[1]) {
              i18nData = Function(`return ${match[1]}`)();
            } else {
              item.i18nStatus[mapping.languageCode] = {
                exists: false,
                value: null,
                error: '无法解析JS文件'
              };
              continue;
            }
          } else {
            item.i18nStatus[mapping.languageCode] = {
              exists: false,
              value: null,
              error: '不支持的文件类型'
            };
            continue;
          }

          // 获取嵌套键的值
          const keyParts = key.split('.');
          let value = i18nData;
          let exists = true;

          for (const part of keyParts) {
            if (value && typeof value === 'object' && part in value) {
              value = value[part];
            } else {
              exists = false;
              value = null;
              break;
            }
          }

          // 保存状态
          item.i18nStatus[mapping.languageCode] = {
            exists,
            value: exists ? value : null
          };
        } catch (error) {
          console.error(`检查键 ${key} 的 ${mapping.languageCode} 状态时出错:`, error);
          item.i18nStatus[mapping.languageCode] = {
            exists: false,
            value: null,
            error: error.message
          };
        }
      }

      return item.i18nStatus;
    } catch (error) {
      console.error('检查国际化键状态时出错:', error);
      return null;
    }
  }

  /**
   * 打开语言文件并定位到指定的键
   * @param {string} filePath 文件路径
   * @param {string} key 国际化键
   * @param {string} languageCode 语言代码
   * @returns {Promise<void>}
   */
  async openLanguageFile(filePath, key, languageCode) {
    try {
      // 获取工作区根目录
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        throw new Error('未找到工作区文件夹');
      }
      const rootPath = workspaceFolders[0].uri.fsPath;

      // 构建完整文件路径
      const fullPath = path.isAbsolute(filePath) ?
        filePath :
        path.join(rootPath, filePath);

      // 检查文件是否存在
      if (!fs.existsSync(fullPath)) {
        throw new Error(`文件不存在: ${filePath}`);
      }

      // 打开文件
      const document = await vscode.workspace.openTextDocument(fullPath);
      const editor = await vscode.window.showTextDocument(document);

      // 尝试在文件中查找键并定位光标
      const content = document.getText();

      // 根据文件类型选择不同的查找方式
      let position = null;

      if (fullPath.endsWith('.json')) {
        // JSON文件查找格式: "key": 或 "nested.key":
        const keyParts = key.split('.');
        let searchKey = '';

        // 处理嵌套键，生成搜索模式
        if (keyParts.length === 1) {
          // 单级键: "key":
          searchKey = `"${key}"\\s*:`;
        } else {
          // 尝试直接查找最末级键
          const lastKey = keyParts[keyParts.length - 1];
          searchKey = `"${lastKey}"\\s*:`;
        }

        const regex = new RegExp(searchKey);
        const text = document.getText();
        const match = regex.exec(text);

        if (match) {
          const offset = match.index;
          position = document.positionAt(offset);
        }
      } else if (fullPath.endsWith('.js') || fullPath.endsWith('.ts')) {
        // JS/TS文件查找: key: 或 'key': 或 "key":
        const keyParts = key.split('.');
        const lastKey = keyParts[keyParts.length - 1];
        const searchKey = `['\"]?${lastKey}['\"]?\\s*:`;

        const regex = new RegExp(searchKey);
        const text = document.getText();
        const match = regex.exec(text);

        if (match) {
          const offset = match.index;
          position = document.positionAt(offset);
        }
      }

      // 如果找到位置，滚动到该位置
      if (position) {
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
      } else {
        // 未找到精确位置时，提示用户
        vscode.window.showInformationMessage(`已打开 ${filePath}，但未找到键 "${key}" 的精确位置`);
      }

      // 无论是否找到位置，记录一条日志信息
      console.log(`已打开文件 ${filePath} 查找键 ${key} [${languageCode}]`);
    } catch (error) {
      console.error('打开语言文件出错:', error);
      vscode.window.showErrorMessage(`打开文件失败: ${error.message}`);
    }
  }
}

module.exports = I18nKeyStatusService; 