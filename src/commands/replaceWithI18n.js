const vscode = require('vscode');
const path = require('path');
const utils = require('../utils');
const { generateKeyFromTranslation, translateTextToAllLanguages } = require('../services/translationService');
const { saveTranslationToFile } = require('../panels/services/languageFileManager');

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
        // 获取配置
        const config = vscode.workspace.getConfiguration('i18n-swapper');
      const autoGenerateKeyFromText = config.get('autoGenerateKeyFromText');
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
            // 未找到匹配键时的处理逻辑
            // 使用PromptManager来处理是否翻译生成键名的提示
            let autoGenerateKeyFromText = await utils.PromptManager.promptForKeyGeneration();
            const autoTranslateAllLanguages = config.get('autoTranslateAllLanguages', false);
            const sourceLanguage = config.get('tencentTranslation.sourceLanguage', 'zh');
            
            try {
                // 1. 根据配置生成键名
                if (autoGenerateKeyFromText) {
                    // 使用翻译API生成有意义的键名
                    i18nKey = await generateKeyFromTranslation(textToFind);
                } else {
                    // 使用默认前缀加哈希值作为键名
                    const autoGenerateKeyPrefix = config.get('autoGenerateKeyPrefix', '_iw');
                    i18nKey = `${autoGenerateKeyPrefix}.${simpleHash(textToFind).toString(16).substring(0, 6)}`;
                }
                
                // 2. 根据配置翻译并保存到语言文件
                if (autoTranslateAllLanguages) {
                    // 调用翻译服务翻译到所有配置的语言
                    await vscode.window.withProgress({
                        location: vscode.ProgressLocation.Notification,
                        title: '翻译中...',
                        cancellable: false
                    }, async (progress) => {
                        progress.report({ message: `正在翻译文本并保存到所有语言文件...` });
                        
                        // 使用通用的翻译服务
                        await translateTextToAllLanguages(textToFind, i18nKey);
                    });
                } else {
                    // 只保存源语言
                    const workspaceFolders = vscode.workspace.workspaceFolders;
                    if (!workspaceFolders) {
                        throw new Error('未找到工作区文件夹');
                    }
                    
                    // 获取语言映射配置
                    const languageMappings = config.get('tencentTranslation.languageMappings', []);
                    
                    // 查找源语言的配置
                    const sourceLangMapping = languageMappings.find(mapping => 
                        mapping.languageCode === sourceLanguage
                    );
                    
                    if (sourceLangMapping) {
                        const rootPath = workspaceFolders[0].uri.fsPath;
                        const targetFile = path.join(rootPath, sourceLangMapping.filePath);
                        
                        // 保存到源语言文件
                        await utils.saveTranslationToFile(targetFile, i18nKey, textToFind);
                        
                        // 设置使用的文件路径
                        foundInFile = targetFile;
                    } else {
                        vscode.window.showWarningMessage(`未找到源语言 ${sourceLanguage} 的映射配置，无法保存翻译`);
                    }
                }
            } catch (error) {
                console.error('自动生成键名或翻译失败:', error);
                vscode.window.showErrorMessage(`自动处理失败: ${error.message}`);
                
                // 失败时使用默认方式
                const autoGenerateKeyPrefix = config.get('autoGenerateKeyPrefix', '_iw');
                i18nKey = `${autoGenerateKeyPrefix}.${simpleHash(textToFind).toString(16).substring(0, 6)}`;
            }
        }

        // 替换选中文本
        const document = editor.document;
        await editor.edit(editBuilder => {
            // 获取位置信息
            const position = new vscode.Position(selection.start.line, selection.start.character);
            
            // 使用统一的replaceFn方法处理替换逻辑
            const replacementResult = utils.replaceFn(
                textToFind,
                i18nKey,
                functionName,
                codeQuote,
                document,
                position
            );
            
            // 使用返回的范围和替换文本
            let range = replacementResult.isVueAttr ? replacementResult.range : expandedSelection;
            editBuilder.replace(range, replacementResult.replacementText);
        });

        vscode.window.showInformationMessage(
            `已替换为 ${functionName}('${i18nKey}')` +
            (foundInFile ? ` [来自: ${foundInFile}]` : '')
        );
        
        // 替换完成后刷新装饰器，使新的翻译内容立即显示
        await vscode.commands.executeCommand('i18n-swapper.refreshI18nDecorations');
    } catch (error) {
        console.error('替换出错:', error);
        vscode.window.showErrorMessage(`替换出错: ${error.message}`);
    }
}

/**
 * 简单的哈希函数
 * @param {string} str 输入字符串
 * @returns {number} 哈希值
 */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

module.exports = replaceWithI18n;