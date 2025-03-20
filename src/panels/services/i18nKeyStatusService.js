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
   * @param {vscode.ViewColumn} viewColumn 视图列，指定在哪个窗口打开
   */
  async openLanguageFile(filePath, key, languageCode, viewColumn = vscode.ViewColumn.Active) {
    try {
      // 获取工作区根目录
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        throw new Error('未找到工作区文件夹');
      }
      const rootPath = workspaceFolders[0].uri.fsPath;

      // 构建绝对路径
      const absolutePath = path.isAbsolute(filePath) ?
        filePath :
        path.join(rootPath, filePath);

      // 打开文件
      const uri = vscode.Uri.file(absolutePath);
      const document = await vscode.workspace.openTextDocument(uri);
      
      // 指定在特定窗口打开文件
      const editor = await vscode.window.showTextDocument(document, {
        viewColumn: viewColumn,
        preserveFocus: false,
        preview: false
      });

      // 尝试定位到键
      if (key) {
        const text = document.getText();
        
        // 处理嵌套键
        const keyParts = key.split('.');
        let searchPosition = 0;
        let currentPart = 0;
        
        while (currentPart < keyParts.length && searchPosition !== -1) {
          const part = keyParts[currentPart];
          // 匹配模式: "key": 或 'key': 或 "key" : 等
          const keyPattern = new RegExp(`["'](${this._escapeRegExp(part)})["']\\s*:`, 'g');
          keyPattern.lastIndex = searchPosition;
          
          const match = keyPattern.exec(text);
          if (match) {
            searchPosition = match.index;
            currentPart++;
          } else {
            searchPosition = -1;
          }
        }
        
        if (searchPosition !== -1) {
          const pos = document.positionAt(searchPosition);
          editor.selection = new vscode.Selection(pos, pos);
          editor.revealRange(
            new vscode.Range(pos, pos),
            vscode.TextEditorRevealType.InCenter
          );
        } else {
          // 回退：尝试直接搜索完整键
          const regex = new RegExp(`["']${this._escapeRegExp(key)}["']`, 'g');
          const match = regex.exec(text);
          
          if (match) {
            const pos = document.positionAt(match.index);
            editor.selection = new vscode.Selection(pos, pos);
            editor.revealRange(
              new vscode.Range(pos, pos),
              vscode.TextEditorRevealType.InCenter
            );
          } else {
            vscode.window.showInformationMessage(`在文件中未找到键 "${key}"`);
          }
        }
      }
    } catch (error) {
      console.error('打开语言文件时出错:', error);
      vscode.window.showErrorMessage(`打开文件失败: ${error.message}`);
    }
  }

  /**
   * 转义正则表达式特殊字符
   * @param {string} string 要转义的字符串
   * @returns {string} 转义后的字符串
   * @private
   */
  _escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

module.exports = I18nKeyStatusService; 