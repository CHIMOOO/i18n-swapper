const vscode = require('vscode');
const path = require('path');
const utils = require('../utils');

/**
 * 查找文本周围的引号，并扩展选择范围
 */
async function expandSelectionIfNeeded(editor, selection) {
    // 检查选择是否已经包含引号
    const selectedText = editor.document.getText(selection);
    if ((selectedText.startsWith('"') && selectedText.endsWith('"')) ||
        (selectedText.startsWith("'") && selectedText.endsWith("'"))) {
        // 选择已经包含引号，不需要扩展
        return {
            selection: selection,
            text: selectedText,
            quoteType: selectedText.charAt(0),
            hasQuotes: true
        };
    }

    // 检查选择周围是否有引号
    const document = editor.document;
    const startPos = selection.start;
    const endPos = selection.end;
    
    // 检查前面的字符是否为引号
    let charBefore = '';
    if (startPos.character > 0) {
        const posBefore = new vscode.Position(startPos.line, startPos.character - 1);
        charBefore = document.getText(new vscode.Range(posBefore, startPos));
    }
    
    // 检查后面的字符是否为引号
    let charAfter = '';
    const posAfter = new vscode.Position(endPos.line, endPos.character + 1);
    if (posAfter.character <= document.lineAt(endPos.line).text.length) {
        charAfter = document.getText(new vscode.Range(endPos, posAfter));
    }
    
    // 如果周围有匹配的引号，则扩展选择范围
    if ((charBefore === '"' && charAfter === '"') || (charBefore === "'" && charAfter === "'")) {
        const expandedSelection = new vscode.Selection(
            new vscode.Position(startPos.line, startPos.character - 1),
            new vscode.Position(endPos.line, endPos.character + 1)
        );
        
        return {
            selection: expandedSelection,
            text: document.getText(expandedSelection),
            quoteType: charBefore,
            hasQuotes: true
        };
    }
    
    // 没有找到引号，保持原样
    return {
        selection: selection,
        text: selectedText,
        quoteType: '',
        hasQuotes: false
    };
}

/**
 * 替换为国际化函数调用
 */
async function replaceWithI18n() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showInformationMessage('没有打开的编辑器');
        return;
    }

    const selection = editor.selection;
    if (selection.isEmpty) {
        vscode.window.showInformationMessage('未选中文本');
        return;
    }

    // 获取选中的文本并检查周围的引号
    const { selection: expandedSelection, text: selectedText, hasQuotes, quoteType } = 
        await expandSelectionIfNeeded(editor, selection);
    
    // 去除选中文本中的引号（如果有）
    let textToFind = selectedText;
    if (hasQuotes) {
        textToFind = selectedText.substring(1, selectedText.length - 1);
    }

    if (!textToFind.trim()) {
        vscode.window.showInformationMessage('选中的文本为空');
        return;
    }

    // 获取配置
    const config = vscode.workspace.getConfiguration('i18n-swapper');

    // 检查并选择国际化文件
    const localesPaths = await utils.checkAndSelectLocaleFile();
    if (localesPaths.length === 0) {
        return; // 用户取消了操作或没有选择文件
    }

    const configQuoteType = config.get('quoteType', 'single');
    const functionName = config.get('functionName', 't');
    const codeQuote = configQuoteType === 'single' ? "'" : '"';

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
            const localeData = utils.loadLocaleFile(filePath);

            if (localeData) {
                // 查找是否已存在相同的文本
                const result = utils.findPathByValue(localeData, textToFind);
                if (result) {
                    foundPath = result;
                    foundInFile = relativePath;
                    break;
                }
            }
        }

        let i18nKey = '';

        if (foundPath) {
            // 已找到匹配的键
            i18nKey = foundPath;
        } else {
            // 未找到，创建新键
            // 显示输入框让用户输入键名
            const inputKey = await vscode.window.showInputBox({
                placeHolder: '输入国际化键名',
                prompt: '未找到匹配的国际化键，请输入新的键名',
                value: 'new.key'
            });

            if (!inputKey) {
                vscode.window.showInformationMessage('操作已取消');
                return;
            }

            i18nKey = inputKey;

            // 提示用户要添加的内容
            const addConfirm = await vscode.window.showInformationMessage(
                `将添加新的国际化键: ${i18nKey} = "${textToFind}"`, {
                    modal: false
                },
                '确认添加'
            );

            if (addConfirm !== '确认添加') {
                vscode.window.showInformationMessage('操作已取消');
                return;
            }

            // 选择要添加到哪个文件
            let targetFile;
            if (localesPaths.length === 1) {
                targetFile = localesPaths[0];
            } else {
                // 多个文件时，让用户选择
                targetFile = await vscode.window.showQuickPick(localesPaths, {
                    placeHolder: '选择要添加到哪个国际化文件'
                });

                if (!targetFile) {
                    vscode.window.showInformationMessage('操作已取消');
                    return;
                }
            }

            // TODO: 向文件添加新的键值对
            // 注意: 这部分功能需要根据项目实际需求实现
            // 例如: 解析文件 -> 添加新键 -> 保存文件

            foundInFile = targetFile;
        }

        // 生成替换文本
        let replacement;
        if (hasQuotes) {
            // 如果选中文本包含引号，则完全替换，不保留原有引号
            replacement = `${functionName}(${codeQuote}${i18nKey}${codeQuote})`;
        } else {
            // 根据上下文生成替换文本
            replacement = utils.generateReplacementText(
                selectedText,
                i18nKey,
                functionName,
                codeQuote,
                editor.document,
                expandedSelection.start
            );
        }
        
        // 执行替换
        await editor.edit(editBuilder => {
            editBuilder.replace(expandedSelection, replacement);
        });

        vscode.window.showInformationMessage(
            `已替换为 ${functionName}('${i18nKey}')` +
            (foundInFile ? ` [来自: ${foundInFile}]` : '')
        );
    } catch (error) {
        console.error('替换出错:', error);
        vscode.window.showErrorMessage(`替换出错: ${error.message}`);
    }
}

module.exports = replaceWithI18n;