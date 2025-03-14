const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

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
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    } else if (filePath.endsWith('.js')) {
      // 加载JS文件
      try {
        // 清除require缓存，确保获取最新内容
        delete require.cache[require.resolve(filePath)];
        return require(filePath);
      } catch (e) {
        console.error(`加载JS文件失败: ${e.message}`);
        return null;
      }
    }
    
    return null;
  } catch (error) {
    console.error(`加载文件失败: ${error.message}`);
    return null;
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
      '未配置国际化文件词库路径，是否立即选择词库？（*.json 或 *.js）',
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
        // 转换为相对于工作区的路径
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
          vscode.window.showErrorMessage('未找到工作区文件夹');
          return [];
        }
        
        const rootPath = workspaceFolders[0].uri.fsPath;
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