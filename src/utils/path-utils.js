const vscode = require('vscode');
const path = require('path');

/**
 * 获取相对于工作区的路径
 * @param {string} absolutePath 绝对路径
 * @returns {string} 相对路径
 */
function getRelativePath(absolutePath) {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return absolutePath;
  }
  const rootPath = workspaceFolders[0].uri.fsPath;
  return path.relative(rootPath, absolutePath);
}

/**
 * 获取文件的相对路径
 * @param {vscode.Uri} fileUri 文件URI
 * @returns {string} 相对路径
 */
function getFileRelativePath(fileUri) {
  return vscode.workspace.asRelativePath(fileUri);
}

/**
 * 将相对路径转换为绝对路径
 * @param {string} relativePath 相对路径
 * @returns {string} 绝对路径
 */
function getAbsolutePath(relativePath) {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return relativePath;
  }
  const rootPath = workspaceFolders[0].uri.fsPath;
  return path.join(rootPath, relativePath);
}

/**
 * 标准化文件路径
 * @param {string} filePath 文件路径
 * @returns {string} 标准化后的路径
 */
function normalizePath(filePath) {
  return path.normalize(filePath).replace(/\\/g, '/');
}

module.exports = {
  getRelativePath,
  getFileRelativePath,
  getAbsolutePath,
  normalizePath
}; 