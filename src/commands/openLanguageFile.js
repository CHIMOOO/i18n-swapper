const vscode = require('vscode');
const path = require('path');

/**
 * 打开语言文件并可选择定位到指定键
 * @param {Object} args - 命令参数
 * @param {String} args.filePath - 相对于工作区根目录的文件路径
 * @param {String} args.langCode - 语言代码
 * @param {String} args.i18nKey - 要定位的i18n键名
 * @param {Boolean} args.shouldLocateKey - 是否应该尝试定位到键(可能不存在)
 */
async function openLanguageFile(args) {
    const { filePath, langCode, i18nKey, shouldLocateKey = true } = args;
    
    if (!filePath) {
        vscode.window.showErrorMessage('找不到语言文件路径');
        return;
    }
    
    // 获取工作区根目录
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage('未找到工作区文件夹');
        return;
    }
    
    const rootPath = workspaceFolders[0].uri.fsPath;
    const fullPath = path.join(rootPath, filePath);
    
    try {
        // 创建文件URI
        const fileUri = vscode.Uri.file(fullPath);
        
        // 检查当前编辑器状态
        const currentEditors = vscode.window.visibleTextEditors;
        
        // 决定在哪个视图打开文件
        let targetViewColumn;
        
        if (currentEditors.length > 1) {
            // 已有多个编辑器视图，找出非活动的那个
            const activeViewColumn = vscode.window.activeTextEditor?.viewColumn || vscode.ViewColumn.One;
            
            // 找到一个不是当前活动的视图
            for (const editor of currentEditors) {
                if (editor.viewColumn !== activeViewColumn) {
                    targetViewColumn = editor.viewColumn;
                    break;
                }
            }
            
            // 如果没找到其他视图，则使用第二视图
            if (!targetViewColumn) {
                targetViewColumn = activeViewColumn === vscode.ViewColumn.One 
                    ? vscode.ViewColumn.Two 
                    : vscode.ViewColumn.One;
            }
        } else {
            // 只有一个编辑器视图，先分屏再打开
            await vscode.commands.executeCommand('workbench.action.splitEditor');
            targetViewColumn = vscode.ViewColumn.Beside;
        }
        
        // 在目标视图中打开文件
        const document = await vscode.workspace.openTextDocument(fileUri);
        const editor = await vscode.window.showTextDocument(document, { 
            viewColumn: targetViewColumn,
            preserveFocus: false // 切换焦点到新打开的文件
        });
        
        // 如果有键值，且shouldLocateKey为true，尝试找到该键在文件中的位置
        if (i18nKey && shouldLocateKey) {
            // 搜索键的位置
            const text = document.getText();
            const keyParts = i18nKey.split('.');
            
            // 构建搜索模式：寻找如 "key": 或 "key" : 或 'key': 等模式
            let searchPosition = 0;
            let currentPart = 0;
            
            while (currentPart < keyParts.length && searchPosition !== -1) {
                const key = keyParts[currentPart];
                const keyPattern = new RegExp(`['"](${key})['"]\\s*:`, 'g');
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
                // 找到键的位置，创建选择区域
                const pos = document.positionAt(searchPosition);
                editor.selection = new vscode.Selection(pos, pos);
                editor.revealRange(
                    new vscode.Range(pos, pos),
                    vscode.TextEditorRevealType.InCenter
                );
            } else if (i18nKey) {
                // 没有找到键，给用户提示
                vscode.window.showInformationMessage(`在 ${langCode} 语言文件中未找到键 "${i18nKey}"`);
            }
        }
    } catch (error) {
        console.error('打开语言文件时出错:', error);
        vscode.window.showErrorMessage(`无法打开语言文件: ${error.message}`);
    }
}

/**
 * 注册打开语言文件命令
 * @param {vscode.ExtensionContext} context - 扩展上下文
 */
function registerOpenLanguageFileCommand(context) {
    const command = vscode.commands.registerCommand('i18n-swapper.openLanguageFile', openLanguageFile);
    context.subscriptions.push(command);
}

module.exports = {
    openLanguageFile,
    registerOpenLanguageFileCommand
}; 