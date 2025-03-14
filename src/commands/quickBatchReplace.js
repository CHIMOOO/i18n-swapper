const vscode = require('vscode');
const path = require('path');
const utils = require('../utils');

/**
 * 快速批量替换
 */
async function quickBatchReplace() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showInformationMessage('没有打开的编辑器');
        return;
    }

    // 获取配置
    const config = vscode.workspace.getConfiguration('i18n-swapper');
    let scanPatterns = config.get('scanPatterns', []);

    // 使用默认扫描模式并给用户提示
    if (!scanPatterns || scanPatterns.length === 0) {
        scanPatterns = [
            "value",
            "label",
            "placeholder",
            "message",
            "title",
            "text"
        ];

        // 使用默认配置
        vscode.window.showInformationMessage(
            '已使用默认扫描配置，您可以右键点击文件并选择"打开面板-批量替换国际化"进行自定义配置',
            '查看配置'
        ).then(selection => {
            if (selection === '查看配置') {
                vscode.commands.executeCommand('workbench.action.openSettings', 'i18n-swapper.scanPatterns');
            }
        });
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
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "分析文档中...",
            cancellable: false
        }, async (progress) => {
            // 获取文档内容和类型
            const document = editor.document;
            const text = document.getText();
            const fileExtension = path.extname(document.fileName).toLowerCase();

            progress.report({
                message: "查找可替换文本..."
            });

            // 收集替换项
            const replacements = utils.analyzeContent(
                text, 0, scanPatterns, utils.shouldBeInternationalized
            );

            if (replacements.length === 0) {
                vscode.window.showInformationMessage('未找到需要国际化的文本');
                return;
            }

            progress.report({
                message: "查找国际化键..."
            });

            // 获取工作区根目录
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                vscode.window.showErrorMessage('未找到工作区文件夹');
                return;
            }

            const rootPath = workspaceFolders[0].uri.fsPath;

            // 检查每个替换项是否已有对应的键
            for (const item of replacements) {
                for (const relativePath of localesPaths) {
                    const filePath = path.join(rootPath, relativePath);
                    const localeData = utils.loadLocaleFile(filePath);

                    if (!localeData) continue;

                    // 查找匹配的键
                    const result = utils.findPathByValue(localeData, item.text);
                    if (result) {
                        item.i18nKey = result;
                        item.i18nFile = relativePath;
                        break;
                    }
                }
            }

            progress.report({
                message: "执行替换..."
            });

            // 创建工作区编辑
            const workspaceEdit = new vscode.WorkspaceEdit();
            let replacedCount = 0;

            // 替换所有找到国际化键的项
            for (const item of replacements) {
                if (!item.i18nKey) continue;

                // 查找文本周围的引号
                const {
                    hasQuotes,
                    range
                } = utils.findQuotesAround(document, item);

                // 生成替换文本
                let replacement;
                if (hasQuotes) {
                    // 如果有引号，则替换文本不需要再带引号
                    replacement = `${functionName}(${codeQuote}${item.i18nKey}${codeQuote})`;
                } else {
                    // 没有引号，使用普通替换文本
                    replacement = utils.generateReplacementText(
                        item.text,
                        item.i18nKey,
                        functionName,
                        codeQuote,
                        document,
                        document.positionAt(item.start)
                    );
                }

                workspaceEdit.replace(document.uri, range, replacement);
                replacedCount++;
            }

            if (replacedCount > 0) {
                await vscode.workspace.applyEdit(workspaceEdit);
                vscode.window.showInformationMessage(`已自动替换 ${replacedCount} 处文本`);
            } else {
                vscode.window.showInformationMessage('未找到可自动替换的文本，请使用批量替换面板添加新的国际化键');
            }
        });
    } catch (error) {
        console.error('快速批量替换时出错:', error);
        vscode.window.showErrorMessage(`替换出错: ${error.message}`);
    }
}

module.exports = quickBatchReplace;