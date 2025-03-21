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
      const includeFiles = config.get('includeFiles', defaultsConfig.includeFiles);
      const localesPaths = config.get('localesPaths', defaultsConfig.localesPaths);
      
      // 创建排除模式
      const excludeGlobs = this._createExcludeGlobs(excludeFiles);
      
      // 处理包含文件和文件夹
      const processedIncludeFiles = await this._processIncludeFiles(includeFiles);
      
      // 构建包含模式
      const includePattern = this._createIncludePattern(processedIncludeFiles);
      
      // 调试日志
      console.log('扫描模式:', includePattern);
      
      progress.report({ message: "查找文件中..." });
      
      // 使用vscode API查找文件
      const files = await vscode.workspace.findFiles(
        includePattern,
        `{${excludeGlobs.join(',')}}`
      );
      
      console.log(`找到 ${files.length} 个匹配的文件`);
      
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
   * 处理includeFiles列表，检查每个路径是否为文件夹，如果是则确保以斜杠结尾
   * @param {Array} includeFiles 包含的文件或文件夹列表
   * @returns {Array} 处理后的包含列表
   * @private
   */
  async _processIncludeFiles(includeFiles) {
    if (!includeFiles || includeFiles.length === 0) {
      return [];
    }
    
    const fs = require('fs');
    const result = [];
    
    // 获取工作区根目录
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return includeFiles;
    }
    const rootPath = workspaceFolders[0].uri.fsPath;
    
    for (const filePath of includeFiles) {
      try {
        // 构建绝对路径
        const absolutePath = path.join(rootPath, filePath);
        
        // 检查路径是否存在
        if (!fs.existsSync(absolutePath)) {
          console.warn(`指定的路径不存在：${absolutePath}`);
          result.push(filePath); // 保留原始路径，以防万一
          continue;
        }
        
        // 检查是否为目录
        const stats = fs.statSync(absolutePath);
        if (stats.isDirectory()) {
          // 确保目录路径以斜杠结尾
          const normalizedPath = filePath.endsWith('/') || filePath.endsWith('\\') 
            ? filePath 
            : filePath + '/';
          result.push(normalizedPath);
          console.log(`处理目录: ${normalizedPath}`);
        } else {
          result.push(filePath);
          console.log(`处理文件: ${filePath}`);
        }
      } catch (error) {
        console.error(`处理路径时出错 ${filePath}:`, error);
        result.push(filePath); // 保留原始路径，以防万一
      }
    }
    
    return result;
  }

  /**
   * 创建包含模式
   * @param {Array} includeFiles 指定要包含的文件或文件夹列表
   * @returns {string} 包含模式
   * @private
   */
  _createIncludePattern(includeFiles = []) {
    // 如果有指定的文件或文件夹，使用它们构建包含模式
    if (includeFiles && includeFiles.length > 0) {
      // 处理文件和文件夹路径，构建glob模式
      const patterns = includeFiles.map(filePath => {
        // 检查是否是目录（以斜杠结尾）
        if (filePath.endsWith('/') || filePath.endsWith('\\')) {
          // 如果是目录，匹配该目录下所有支持的文件类型
          return `${filePath}**/*.{js,jsx,ts,tsx,vue,html}`;
        } else {
          // 如果是文件，直接包含
          // 处理特殊字符避免glob模式解析问题
          const escapedPath = filePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          return escapedPath;
        }
      });
      
      // 打印处理后的模式
      console.log('生成的扫描模式:', patterns);
      
      // 将所有模式合并为一个逗号分隔的列表
      return patterns.length > 1 ? `{${patterns.join(',')}}` : patterns[0];
    }
    
    // 默认包含所有支持的文件类型
    return '**/*.{js,jsx,ts,tsx,vue,html}';
  }
}

module.exports = new WorkspaceScannerService(); 