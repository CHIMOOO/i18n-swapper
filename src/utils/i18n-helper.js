const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { parseJsFile } = require('./js-parser');

/**
 * 递归查找对象中指定值的路径
 * @param {Object} obj 要搜索的对象
 * @param {string} value 要查找的值
 * @param {string} currentPath 当前路径
 * @returns {string|null} 返回找到的路径或null
 */
function findPathByValue(obj, value, currentPath = '') {
  for (const key in obj) {
    const newPath = currentPath ? `${currentPath}.${key}` : key;
    
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      // 递归搜索对象
      const result = findPathByValue(obj[key], value, newPath);
      if (result) return result;
    } else if (obj[key] === value) {
      // 找到匹配的值
      return newPath;
    }
  }
  return null;
}

/**
 * 加载国际化文件内容
 * @param {string} filePath 文件路径
 * @returns {Object|null} 返回文件内容对象或null
 */
function loadLocaleFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    
    if (filePath.endsWith('.json')) {
      // 加载JSON文件
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        // 检查文件内容是否为空
        if (!content || content.trim() === '') {
          console.log(`[警告] 文件为空: ${filePath}`);
          return {};
        }
        return JSON.parse(content);
      } catch (parseError) {
        console.error(`[错误] JSON解析失败: ${filePath}, 错误: ${parseError.message}`);
        // 文件格式错误时，返回一个空对象而不是null
        return {};
      }
    } else if (filePath.endsWith('.js')) {
      // 使用公共的JS解析模块
      return parseJsFile(filePath);
    }
    
    return null;
  } catch (error) {
    console.error(`[错误] 加载文件失败: ${filePath}, 错误: ${error.message}`);
    return {};
  }
}

/**
 * 检查并引导用户选择国际化文件
 * @returns {Promise<string[]>} 国际化文件路径数组
 */
async function checkAndSelectLocaleFile() {
  // 获取配置的国际化文件路径
  const config = vscode.workspace.getConfiguration('i18n-swapper');
  let localesPaths = config.get('localesPaths', []);
  
  // 检查是否有配置的路径
  if (!localesPaths || localesPaths.length === 0 || (localesPaths.length === 1 && !localesPaths[0])) {
    // 提示用户选择国际化文件
    const result = await vscode.window.showInformationMessage(
      '未配置源语言文件国际化词库路径（将用于国际化函数预览、源语言的文本快捷替换国际化函数方法，默认可以选中文翻译库）（*.json 或 *.js）',
      { modal: true },
      '选择文件'
    );
    
    if (result === '选择文件') {
      // 打开文件选择器
      const fileUris = await vscode.window.showOpenDialog({
        canSelectMany: true,
        filters: {
          '国际化文件': ['json', 'js']
        },
        title: '选择国际化文件'
      });
      
      if (fileUris && fileUris.length > 0) {
        // 获取工作区根路径
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
          vscode.window.showErrorMessage('未找到工作区文件夹');
          return [];
        }
        
        const rootPath = workspaceFolders[0].uri.fsPath;
        
        // 获取语言名称映射
        const { LANGUAGE_NAMES } = require('./language-mappings');
        
        // 构建语言选择项
        const languageOptions = Object.entries(LANGUAGE_NAMES).map(([code, name]) => ({
          label: `${name} (${code})`,
          code: code
        }));
        
        // 添加"其他"选项
        languageOptions.push({ label: '其他', code: 'other' });
        
        // 提示用户选择语言
        const selectedLanguage = await vscode.window.showQuickPick(languageOptions, {
          placeHolder: '请选择这个文件对应的语言（将用于翻译对齐）',
          canPickMany: false
        });
        
        if (selectedLanguage && selectedLanguage.code !== 'other') {
          // 更新源语言设置
          await config.update('tencentTranslation.sourceLanguage', selectedLanguage.code, vscode.ConfigurationTarget.Workspace);
          
          // 准备语言映射（使用相对路径）
          const languageMappings = fileUris.map(uri => {
            const absolutePath = uri.fsPath;
            const relativePath = path.relative(rootPath, absolutePath).replace(/\\/g, '/');
            return {
              languageCode: selectedLanguage.code,
              filePath: relativePath
            };
          });
          
          // 更新语言映射设置
          await config.update('tencentTranslation.languageMappings', languageMappings, vscode.ConfigurationTarget.Workspace);
          
          vscode.window.showInformationMessage(`已将 ${selectedLanguage.label} 设置为源语言，并更新了语言映射配置`);
        }
        
        const relativePaths = fileUris.map(uri => {
          const filePath = uri.fsPath;
          return path.relative(rootPath, filePath).replace(/\\/g, '/');
        });
        
        // 更新配置
        await config.update('localesPaths', relativePaths, vscode.ConfigurationTarget.Workspace);
        
        vscode.window.showInformationMessage(`已添加 ${relativePaths.length} 个国际化文件`);
        return relativePaths;
      } else {
        vscode.window.showWarningMessage('未选择任何文件，操作取消');
        return [];
      }
    } else {
      vscode.window.showWarningMessage('未配置国际化文件，操作取消');
      return [];
    }
  }
  
  return localesPaths;
}

module.exports = {
  findPathByValue,
  loadLocaleFile,
  checkAndSelectLocaleFile
}; 