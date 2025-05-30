const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { SUPPORTED_LANGUAGE_MAPPINGS, LANGUAGE_NAMES } = require('../../utils/language-mappings');
const { parseJsFile } = require('../../utils/js-parser');

/**
 * 创建或选择语言文件
 * 允许用户基于已有的文件创建多语言版本
 */
async function createOrSelectLanguageFiles() {
  try {
    // 获取当前配置的文件
    const config = vscode.workspace.getConfiguration('i18n-swapper');
    const localesPaths = config.get('localesPaths', []);
    
    if (!localesPaths || localesPaths.length === 0) {
      vscode.window.showInformationMessage('请先选择至少一个国际化文件作为基础');
      return;
    }

    // 获取工作区根目录
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      vscode.window.showErrorMessage('未找到工作区文件夹');
      return;
    }
    const rootPath = workspaceFolders[0].uri.fsPath;

    // 让用户选择源语言文件
    const sourceFile = await vscode.window.showQuickPick(localesPaths, {
      placeHolder: '选择源语言文件',
      canPickMany: false
    });

    if (!sourceFile) {
      return;
    }

    // 猜测源语言
    let sourceLanguage = 'zh'; // 默认假设为中文
    for (const [langCode, langName] of Object.entries(LANGUAGE_NAMES)) {
      if (sourceFile.toLowerCase().includes(langCode.toLowerCase())) {
        sourceLanguage = langCode;
        break;
      }
    }

    // 获取支持的目标语言
    const targetLanguages = SUPPORTED_LANGUAGE_MAPPINGS[sourceLanguage] || [];
    if (targetLanguages.length === 0) {
      vscode.window.showWarningMessage(`无法确定源语言"${sourceLanguage}"支持的目标语言`);
      return;
    }

    // 构建语言选择列表
    const languageOptions = targetLanguages.map(langCode => ({
      label: LANGUAGE_NAMES[langCode] || langCode,
      description: langCode,
      picked: false
    }));

    // 让用户选择目标语言
    const selectedLanguages = await vscode.window.showQuickPick(languageOptions, {
      placeHolder: '选择要创建的语言文件(可多选)',
      canPickMany: true
    });

    if (!selectedLanguages || selectedLanguages.length === 0) {
      return;
    }

    // 为每个选择的语言创建对应文件
    for (const lang of selectedLanguages) {
      const langCode = lang.description;
      await createLanguageFile(rootPath, sourceFile, langCode);
    }

    vscode.window.showInformationMessage(
      `已创建 ${selectedLanguages.length} 个语言文件`
    );
  } catch (error) {
    console.error('创建语言文件出错:', error);
    vscode.window.showErrorMessage(`创建语言文件失败: ${error.message}`);
  }
}

/**
 * 创建语言文件
 * @param {string} rootPath 工作区根路径
 * @param {string} sourceFile 源文件路径
 * @param {string} langCode 语言代码
 */
async function createLanguageFile(rootPath, sourceFile, langCode) {
  try {
    // 构建新文件路径
    const sourceFilePath = path.join(rootPath, sourceFile);
    const sourceExt = path.extname(sourceFile);
    const sourceDir = path.dirname(sourceFile);
    const sourceBase = path.basename(sourceFile, sourceExt);
    
    // 移除可能的语言后缀，例如从 zh-CN.json 得到 .json
    const cleanBase = sourceBase.replace(/[-_](zh|en|ja|ko|fr|es|it|de|tr|ru|pt|vi|id|th|ms|ar|hi|zh-TW)$/i, '');
    
    // 构建新的文件名
    let newFileName;
    if (cleanBase === sourceBase) {
      // 源文件名没有语言代码，添加语言代码
      newFileName = `${sourceBase}-${langCode}${sourceExt}`;
    } else {
      // 源文件有语言代码，替换为新语言代码
      newFileName = `${cleanBase}-${langCode}${sourceExt}`;
    }
    
    const newFilePath = path.join(rootPath, sourceDir, newFileName);
    const newFileRelative = path.join(sourceDir, newFileName).replace(/\\/g, '/');
    
    // 检查文件是否已存在
    if (fs.existsSync(newFilePath)) {
      const overwrite = await vscode.window.showWarningMessage(
        `文件"${newFileRelative}"已存在，是否覆盖？`,
        '覆盖',
        '取消'
      );
      
      if (overwrite !== '覆盖') {
        return;
      }
    }
    
    // 创建空的目标文件
    const content = sourceExt === '.json' ? '{}' : 'module.exports = {};';
    fs.writeFileSync(newFilePath, content, 'utf8');
    
    // 更新配置
    const config = vscode.workspace.getConfiguration('i18n-swapper');
    const localesPaths = config.get('localesPaths', []);
    
    if (!localesPaths.includes(newFileRelative)) {
      localesPaths.push(newFileRelative);
      await config.update('localesPaths', localesPaths, vscode.ConfigurationTarget.Workspace);
    }
    
    // 打开新创建的文件
    const document = await vscode.workspace.openTextDocument(newFilePath);
    await vscode.window.showTextDocument(document, { preview: false });
    
    return newFileRelative;
  } catch (error) {
    console.error(`创建语言文件 ${langCode} 出错:`, error);
    throw error;
  }
}

/**
 * 保存翻译文本到国际化文件
 * @param {string} filePath 文件路径
 * @param {string} key 国际化键
 * @param {string} value 翻译值
 */
async function saveTranslationToFile(filePath, key, value) {
  try {
    // 确保目录存在
    const dirPath = path.dirname(filePath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    
    // 加载现有文件或创建新对象
    let localeData = {};
    if (fs.existsSync(filePath)) {
      try {
        if (filePath.endsWith('.json')) {
          const content = fs.readFileSync(filePath, 'utf8');
          localeData = JSON.parse(content || '{}');
        } else if (filePath.endsWith('.js')) {
          // 使用公共的JS解析模块
          localeData = parseJsFile(filePath);
        }
      } catch (error) {
        console.error(`加载文件 ${filePath} 失败:`, error);
        localeData = {};
      }
    }
    
    // 设置键值
    setNestedValue(localeData, key, value);
    
    // 保存文件
    if (filePath.endsWith('.json')) {
      // 保存JSON文件
      fs.writeFileSync(filePath, JSON.stringify(localeData, null, 2), 'utf8');
    } else if (filePath.endsWith('.js')) {
      // 保存JS文件
      const jsContent = `module.exports = ${JSON.stringify(localeData, null, 2)};`;
      fs.writeFileSync(filePath, jsContent, 'utf8');
    }
    
    return true;
  } catch (error) {
    console.error(`保存翻译到文件 ${filePath} 出错:`, error);
    throw error;
  }
}

/**
 * 设置嵌套对象的值
 * @param {object} obj 目标对象
 * @param {string} path 键路径，如 'a.b.c'
 * @param {any} value 要设置的值
 */
function setNestedValue(obj, path, value) {
  const keys = path.split('.');
  let current = obj;
  
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!current[key] || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }
  
  current[keys[keys.length - 1]] = value;
}

module.exports = {
  createOrSelectLanguageFiles,
  createLanguageFile,
  saveTranslationToFile
}; 