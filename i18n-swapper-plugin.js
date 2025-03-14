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
 * 激活插件
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  // 注册命令
  let disposable = vscode.commands.registerCommand('i18n-swapper.replaceWithI18n', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showInformationMessage('没有打开的编辑器');
      return;
    }

    // 获取插件配置
    const config = vscode.workspace.getConfiguration('i18n-swapper');
    const localesPaths = config.get('localesPaths', ['src/locales/zh-CN.json']);
    const configQuoteType = config.get('quoteType', 'single');
    const functionName = config.get('functionName', 't');
    
    // 确定生成代码中使用的引号
    const codeQuote = configQuoteType === 'single' ? "'" : '"';

    // 获取选中的文本
    let selection = editor.selection;
    let selectedText = editor.document.getText(selection);
    
    if (!selectedText) {
      vscode.window.showInformationMessage('没有选中任何文本');
      return;
    }

    // 处理选中的文本，去除可能存在的引号
    let textToFind = selectedText;
    let hasQuotes = false;
    let selectedQuoteType = '';
    
    // 检查文本本身是否带有引号
    if ((textToFind.startsWith('"') && textToFind.endsWith('"'))) {
      textToFind = textToFind.substring(1, textToFind.length - 1);
      hasQuotes = true;
      selectedQuoteType = '"';
    } else if ((textToFind.startsWith("'") && textToFind.endsWith("'"))) {
      textToFind = textToFind.substring(1, textToFind.length - 1);
      hasQuotes = true;
      selectedQuoteType = "'";
    } else {
      // 检查选中文本周围是否有引号
      const document = editor.document;
      const startPos = selection.start;
      const endPos = selection.end;
      
      // 检查选中文本前面的字符是否为引号
      let quoteBefore = '';
      if (startPos.character > 0) {
        const posBefore = new vscode.Position(startPos.line, startPos.character - 1);
        quoteBefore = document.getText(new vscode.Range(posBefore, startPos));
      }
      
      // 检查选中文本后面的字符是否为引号
      let quoteAfter = '';
      const posAfter = new vscode.Position(endPos.line, endPos.character + 1);
      if (posAfter.character <= document.lineAt(endPos.line).text.length) {
        quoteAfter = document.getText(new vscode.Range(endPos, posAfter));
      }
      
      // 如果周围有匹配的引号，则使用选中的文本进行查询
      if (quoteBefore === '"' && quoteAfter === '"') {
        hasQuotes = true;
        selectedQuoteType = '"';
        
        // 选中文本外部有引号，更新选择范围为包含引号的完整文本
        selection = new vscode.Selection(
          new vscode.Position(startPos.line, startPos.character - 1),
          new vscode.Position(endPos.line, endPos.character + 1)
        );
        
        // 更新选中的文本，但搜索值不变
        selectedText = document.getText(selection);
      } else if (quoteBefore === "'" && quoteAfter === "'") {
        hasQuotes = true;
        selectedQuoteType = "'";
        
        // 选中文本外部有引号，更新选择范围为包含引号的完整文本
        selection = new vscode.Selection(
          new vscode.Position(startPos.line, startPos.character - 1),
          new vscode.Position(endPos.line, endPos.character + 1)
        );
        
        // 更新选中的文本，但搜索值不变
        selectedText = document.getText(selection);
      }
    }

    try {
      // 获取工作区根目录
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        vscode.window.showErrorMessage('未找到工作区文件夹');
        return;
      }
      
      const rootPath = workspaceFolders[0].uri.fsPath;
      
      // 在所有配置的文件中查找
      let foundPath = null;
      let foundInFile = null;
      
      for (const relativePath of localesPaths) {
        const filePath = path.join(rootPath, relativePath);
        const localeData = loadLocaleFile(filePath);
        
        if (!localeData) {
          console.log(`跳过不存在或无法加载的文件: ${filePath}`);
          continue;
        }
        
        // 查找匹配的键
        const result = findPathByValue(localeData, textToFind);
        if (result) {
          foundPath = result;
          foundInFile = relativePath;
          break;
        }
      }
      
      if (foundPath) {
        // 替换选中的文本为配置的国际化函数调用
        await editor.edit(editBuilder => {
          editBuilder.replace(selection, `${functionName}(${codeQuote}${foundPath}${codeQuote})`);
        });
        vscode.window.showInformationMessage(`已替换为: ${functionName}(${codeQuote}${foundPath}${codeQuote}) (从 ${foundInFile} 找到)`);
      } else {
        vscode.window.showInformationMessage(`未找到文本 "${textToFind}" 的国际化键`);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`发生错误: ${error.message}`);
    }
  });

  context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
}; 