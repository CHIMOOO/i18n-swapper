const vscode = require('vscode');
const path = require('path');
const { normalizePath } = require('./path-utils');

/**
 * 判断文件是否为语言文件
 * @param {string} filePath 文件路径
 * @returns {boolean} 是否为语言文件
 */
function isLanguageFile(filePath) {
  if (!filePath) return false;
  
  // 获取本地化文件路径配置
  const config = vscode.workspace.getConfiguration('i18n-swapper');
  const localesPaths = config.get('localesPaths', []);
  
  // 获取腾讯翻译API配置的语言映射
  const languageMappings = config.get('tencentTranslation.languageMappings', []);
  const languageFilePaths = languageMappings.map(mapping => mapping.filePath);
  
  // 合并两个路径列表
  const allLanguageFilePaths = [...localesPaths, ...languageFilePaths];
  
  // 获取工作区文件夹路径
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) return false;
  const workspacePath = workspaceFolders[0].uri.fsPath;
  
  // 规范化当前文件路径
  const normalizedFilePath = normalizePath(filePath);
  
  // 检查文件路径是否在语言文件列表中
  for (const langPath of allLanguageFilePaths) {
    // 跳过空路径
    if (!langPath) continue;
    
    // 将相对路径转换为绝对路径
    let absoluteLangPath;
    if (path.isAbsolute(langPath)) {
      absoluteLangPath = normalizePath(langPath);
    } else {
      // 如果是相对路径，拼接工作区路径
      absoluteLangPath = normalizePath(path.join(workspacePath, langPath));
    }
    
    // 路径匹配判断
    if (pathsMatch(normalizedFilePath, absoluteLangPath)) {
      return true;
    }
  }
  
  return false;
}

/**
 * 比较两个路径是否匹配
 * @param {string} path1 第一个路径
 * @param {string} path2 第二个路径
 * @returns {boolean} 是否匹配
 */
function pathsMatch(path1, path2) {
  // 精确匹配
  if (path1 === path2) return true;
  
  // 提取文件名
  const fileName1 = path1.split('/').pop();
  const fileName2 = path2.split('/').pop();
  
  // 文件名匹配
  if (fileName1 === fileName2) {
    // 检查是否在合理的目录路径中
    // 例如：src/locales/zh-CN.json 应该匹配 D:/project/src/locales/zh-CN.json
    const dir2 = path2.substring(0, path2.length - fileName2.length);
    if (path1.endsWith(dir2 + fileName2)) return true;
  }
  
  // Windows 平台忽略大小写比较
  if (process.platform === 'win32') {
    if (path1.toLowerCase() === path2.toLowerCase()) return true;
    
    // 提取小写文件名
    const lcFileName1 = fileName1.toLowerCase();
    const lcFileName2 = fileName2.toLowerCase();
    
    // 小写文件名匹配
    if (lcFileName1 === lcFileName2) {
      const lcDir2 = path2.substring(0, path2.length - fileName2.length).toLowerCase();
      if (path1.toLowerCase().endsWith(lcDir2 + lcFileName2)) return true;
    }
  }
  
  return false;
}

/**
 * 获取所有语言文件路径
 * @returns {Array<string>} 所有语言文件路径
 */
function getAllLanguageFilePaths() {
  const config = vscode.workspace.getConfiguration('i18n-swapper');
  const localesPaths = config.get('localesPaths', []);
  
  // 获取腾讯翻译API配置的语言映射
  const languageMappings = config.get('tencentTranslation.languageMappings', []);
  const languageFilePaths = languageMappings.map(mapping => mapping.filePath);
  
  // 合并两个路径列表并去重
  return [...new Set([...localesPaths, ...languageFilePaths])].filter(Boolean);
}

module.exports = {
  isLanguageFile,
  pathsMatch,
  getAllLanguageFilePaths
}; 