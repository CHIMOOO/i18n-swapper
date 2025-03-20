/**
 * 工作区扫描服务
 * 负责扫描工作区中所有符合条件的文件并执行国际化分析
 */
const vscode = require('vscode');
const path = require('path');
const defaultsConfig = require('../../config/defaultsConfig');
const { analyzeDocument } = require('./documentAnalyzer');
const pathUtils = require('../../utils/path-utils');

class WorkspaceScannerService {
  /**
   * 构造函数
   */
  constructor() {
    // 支持的文件扩展名
    this.supportedExtensions = ['.js', '.jsx', '.ts', '.tsx', '.vue', '.html'];
  }

  /**
   * 扫描工作区中的所有文件
   * @param {Function} analyzeExistingI18nCalls 分析已存在国际化调用的函数
   * @param {vscode.Progress} progress 进度对象
   * @returns {Object} 包含replacements和existingCalls的扫描结果
   */
  async scanAllWorkspaceFiles(analyzeExistingI18nCalls, progress) {
    try {
      // 获取工作区根目录
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        throw new Error('未找到工作区文件夹');
      }
      
      // 获取配置
      const config = vscode.workspace.getConfiguration('i18n-swapper');
      const scanPatterns = config.get('scanPatterns', defaultsConfig.scanPatterns);
      const excludeFiles = config.get('excludeFiles', defaultsConfig.excludeFiles);
      const localesPaths = config.get('localesPaths', defaultsConfig.localesPaths);
      
      // 创建排除模式
      const excludeGlobs = this._createExcludeGlobs(excludeFiles);
      
      // 构建包含模式
      const includePattern = this._createIncludePattern();
      
      progress.report({ message: "查找文件中..." });
      
      // 使用vscode API查找文件
      const files = await vscode.workspace.findFiles(
        includePattern,
        `{${excludeGlobs.join(',')}}`
      );
      
      // 初始化结果
      const results = {
        replacements: [],
        existingCalls: []
      };
      
      // 分析每个文件
      await this._analyzeFiles(files, progress, scanPatterns, localesPaths, analyzeExistingI18nCalls, results);
      
      return results;
    } catch (error) {
      console.error('扫描工作区文件时出错:', error);
      throw error;
    }
  }

  /**
   * 分析所有匹配的文件
   * @param {Array} files 文件URI数组
   * @param {vscode.Progress} progress 进度对象
   * @param {Array} scanPatterns 扫描模式
   * @param {Array} localesPaths 语言文件路径
   * @param {Function} analyzeExistingI18nCalls 分析已存在国际化调用的函数
   * @param {Object} results 结果对象
   * @private
   */
  async _analyzeFiles(files, progress, scanPatterns, localesPaths, analyzeExistingI18nCalls, results) {
    const totalFiles = files.length;
    
    for (let i = 0; i < totalFiles; i++) {
      const file = files[i];
      const relativePath = pathUtils.getFileRelativePath(file);
      
      progress.report({ 
        message: `分析文件 ${i+1}/${totalFiles}: ${relativePath}`,
        increment: 100 / totalFiles 
      });
      
      try {
        // 读取文件内容
        const document = await vscode.workspace.openTextDocument(file);
        const text = document.getText();
        const fileExtension = path.extname(file.fsPath).toLowerCase();
        
        // 分析文档，查找待替换的文本
        const fileReplacements = await analyzeDocument(
          text, fileExtension, scanPatterns, localesPaths, document
        );
        
        // 标记文件信息
        this._attachFileInfo(fileReplacements, file);
        
        // 添加到总结果
        results.replacements.push(...fileReplacements);
        
        // 分析已转义内容
        const fileExistingCalls = await analyzeExistingI18nCalls(text, document);
        
        // 标记文件信息
        this._attachFileInfo(fileExistingCalls, file);
        
        // 添加到总结果
        results.existingCalls.push(...fileExistingCalls);
      } catch (error) {
        console.error(`分析文件 ${file.fsPath} 时出错:`, error);
        // 继续处理下一个文件
      }
    }
  }

  /**
   * 为替换项和已存在调用添加文件信息
   * @param {Array} items 项目数组
   * @param {vscode.Uri} file 文件URI
   * @private
   */
  _attachFileInfo(items, file) {
    const relativePath = pathUtils.getFileRelativePath(file);
    items.forEach(item => {
      item.filePath = relativePath;
    });
  }

  /**
   * 创建排除模式
   * @param {Array} excludeFiles 排除文件列表
   * @returns {Array} 排除模式数组
   * @private
   */
  _createExcludeGlobs(excludeFiles) {
    return excludeFiles.map(pattern => `**/${pattern}/**`);
  }

  /**
   * 创建包含模式
   * @returns {string} 包含模式
   * @private
   */
  _createIncludePattern() {
    return '**/*.{js,jsx,ts,tsx,vue,html}';
  }
}

module.exports = new WorkspaceScannerService(); 