const vscode = require('vscode');
const path = require('path');
const utils = require('../utils');
const { LANGUAGE_NAMES } = require('../utils/language-mappings');
const { generateLanguageHoverContent } = require('../utils/hover-content-generator');
const fs = require('fs');

// 存储所有待确认的替换项
let pendingReplacements = [];
// 装饰类型
let confirmDecorationType = null;
// CodeLens提供器
let codeLensProvider = null;
// 全局操作面板装饰
let globalActionDecoration = null;

/**
 * 快速批量替换
 */
async function quickBatchReplace() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showInformationMessage('没有打开的编辑器');
        return;
    }

    // 清除之前的装饰
    clearDecorations();

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
                message: "准备替换建议..."
            });

            // 过滤出已有国际化键的项目
            const validReplacements = replacements.filter(item => item.i18nKey);

            if (validReplacements.length === 0) {
                vscode.window.showInformationMessage('未找到可自动替换的文本，请使用批量替换面板添加新的国际化键');
                return;
            }

            // 注册命令
            registerCommands();

            // 为每个替换项添加装饰和按钮
            showConfirmationDecorations(editor, document, validReplacements, functionName, codeQuote);
            
            // 显示底部全局操作面板
            showGlobalActionPanel(editor, document, validReplacements.length);
        });
    } catch (error) {
        console.error('快速批量替换时出错:', error);
        vscode.window.showErrorMessage(`替换出错: ${error.message}`);
        clearDecorations();
    }
}

/**
 * 加载所有语言数据
 * @returns {Object} 包含语言数据和映射的对象
 */
function loadAllLanguageData() {
    const allLanguageData = {};
    
    // 获取配置
    const config = vscode.workspace.getConfiguration('i18n-swapper');
    const languageMappings = config.get('tencentTranslation.languageMappings', []);
    
    // 获取工作区根目录
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        return { allLanguageData, languageMappings };
    }
    
    const rootPath = workspaceFolders[0].uri.fsPath;
    
    // 为每个语言映射加载数据
    for (const mapping of languageMappings) {
        try {
            const languageCode = mapping.languageCode;
            const filePath = path.join(rootPath, mapping.filePath);
            
            if (fs.existsSync(filePath)) {
                let data;
                
                if (filePath.endsWith('.json')) {
                    const content = fs.readFileSync(filePath, 'utf8');
                    data = JSON.parse(content);
                } else if (filePath.endsWith('.js')) {
                    delete require.cache[require.resolve(filePath)];
                    data = require(filePath);
                }
                
                if (data) {
                    allLanguageData[languageCode] = data;
                }
            }
        } catch (error) {
            console.error(`加载语言文件失败 ${mapping.filePath}:`, error);
        }
    }
    
    // 如果没有找到语言映射，尝试加载localesPaths中的文件
    if (Object.keys(allLanguageData).length === 0) {
        const localesPaths = config.get('localesPaths', []);
        
        for (const localePath of localesPaths) {
            try {
                const filePath = path.join(rootPath, localePath);
                
                if (fs.existsSync(filePath)) {
                    let data;
                    
                    if (filePath.endsWith('.json')) {
                        const content = fs.readFileSync(filePath, 'utf8');
                        data = JSON.parse(content);
                    } else if (filePath.endsWith('.js')) {
                        delete require.cache[require.resolve(filePath)];
                        data = require(filePath);
                    }
                    
                    if (data) {
                        // 使用文件名作为语言代码
                        const langCode = path.basename(localePath, path.extname(localePath));
                        allLanguageData[langCode] = data;
                    }
                }
            } catch (error) {
                console.error(`加载国际化文件失败 ${localePath}:`, error);
            }
        }
    }
    
    return { allLanguageData, languageMappings };
}

/**
 * 显示确认装饰
 */
function showConfirmationDecorations(editor, document, replacements, functionName, codeQuote) {
    // 创建装饰类型 - 确保装饰显示在文本之后
    confirmDecorationType = vscode.window.createTextEditorDecorationType({
        after: {
            margin: '0 0 0 20px', // 设置左边距，确保与文本有一定间距
            textDecoration: 'none; display: inline-block; width: auto; background-color: rgba(120, 200, 120, 0.2);'
        },
    });

    // 存储所有替换项
    pendingReplacements = replacements.map(item => {
        // 查找文本周围的引号
        const { hasQuotes, range } = utils.findQuotesAround(document, item);

        // 生成替换文本
        let replacement;
        if (hasQuotes) {
            replacement = `${functionName}(${codeQuote}${item.i18nKey}${codeQuote})`;
        } else {
            replacement = utils.generateReplacementText(
                item.text,
                item.i18nKey,
                functionName,
                codeQuote,
                document,
                document.positionAt(item.start)
            );
        }

        return {
            ...item,
            range,
            replacement,
        };
    });

    // 使用抽取的函数加载语言数据
    const { allLanguageData, languageMappings } = loadAllLanguageData();
    
    // 创建装饰
    const decorations = pendingReplacements.map((item, index) => {
        // 获取位置
        const position = item.range.start;
        const line = position.line;
        const lineText = document.lineAt(line).text;
        const indentation = lineText.match(/^\s*/)[0];
        
        // 使用生成器函数生成悬停内容
        const hoverMessage = generateLanguageHoverContent({
            allLanguageData,
            languageMappings,
            i18nKey: item.i18nKey,
            index,
            showActions: true,
            useHideHoverCommand: false
        });
        
        // 显示替换建议 - 确保格式清晰
        const contentText = `${item.replacement}`;
        
        // 根据文本的位置创建范围 - 确保装饰显示在文本之后
        const decorationRange = new vscode.Range(
            item.range.end, // 使用文本的结束位置
            item.range.end  // 确保装饰显示在文本之后
        );
        
        return {
            range: decorationRange, // 使用文本结束位置作为装饰的起始位置
            renderOptions: {
                after: { // 指定装饰显示在文本之后
                    contentText: contentText,
                    backgroundColor: 'rgba(120, 200, 120, 0.2)',
                    margin: '0 0 0 10px', // 调整左边距使其更靠近原文本
                    width: 'auto',
                    fontStyle: 'normal',
                    color: '#e37933',
                    border: '1px solid rgba(120, 200, 120, 0.4)',
                    borderRadius: '3px',
                },
                light: {
                    after: {
                        contentIconPath: undefined,
                        backgroundColor: 'rgba(120, 200, 120, 0.2)',
                    }
                },
                dark: {
                    after: {
                        contentIconPath: undefined,
                        backgroundColor: 'rgba(120, 200, 120, 0.1)',
                    }
                }
            },
            hoverMessage: hoverMessage,
        };
    });

    // 应用装饰
    editor.setDecorations(confirmDecorationType, decorations);

    // 同时使用CodeLens提供更明显的按钮
    registerCodeLensActions(document);
}

/**
 * 注册CodeLens动作按钮
 */
function registerCodeLensActions(document) {
    // 如果已有CodeLens提供器，先释放
    if (codeLensProvider) {
        codeLensProvider.dispose();
    }
    
    // 创建新的CodeLens提供器
    codeLensProvider = vscode.languages.registerCodeLensProvider({ pattern: document.uri.fsPath }, {
        provideCodeLenses(document) {
            const codeLenses = [];
            
            pendingReplacements.forEach((item, index) => {
                // 确认按钮
                const acceptLens = new vscode.CodeLens(
                    item.range,
                    {
                        title: '✓ 接受',
                        command: 'i18n-swapper.confirmReplacement',
                        arguments: [{ index }]
                    }
                );
                
                // 取消按钮
                const cancelLens = new vscode.CodeLens(
                    item.range,
                    {
                        title: '✗ 取消',
                        command: 'i18n-swapper.cancelReplacement',
                        arguments: [{ index }]
                    }
                );
                
                codeLenses.push(acceptLens, cancelLens);
            });
            
            return codeLenses;
        }
    });
}

/**
 * 显示底部全局操作面板
 */
function showGlobalActionPanel(editor, document, replacementCount) {
    // 创建底部操作面板装饰类型
    globalActionDecoration = vscode.window.createTextEditorDecorationType({
        isWholeLine: true,
    });
    
    // 每次滚动时更新位置
    let updatePanelPosition = () => {
        if (editor.visibleRanges.length > 0) {
            // 获取当前可见范围的最后一行
            const lastVisibleLine = editor.visibleRanges[0].end.line;
            
            // 创建范围 - 使用行末位置而不是行首，以便悬停更自然
            const lineLength = document.lineAt(lastVisibleLine).text.length;
            const range = new vscode.Range(
                new vscode.Position(lastVisibleLine, Math.max(0, lineLength - 1)),
                new vscode.Position(lastVisibleLine, lineLength)
            );
            
            // 创建悬停消息，正确设置为可点击
            const hoverMessage = new vscode.MarkdownString(
                `### i18n-swapper 批量国际化替换操作\n\n` +
                `**[✓ 全部接受](command:i18n-swapper.applyAllReplacements)**  \n\n` +
                `**[✗ 全部取消](command:i18n-swapper.cancelAllReplacements)**`
            );
            // 关键：设置为可信任并启用命令
            hoverMessage.isTrusted = true;
            hoverMessage.supportHtml = true;
            
            // 应用装饰
            editor.setDecorations(globalActionDecoration, [{
                range,
                renderOptions: {
                    after: {
                        contentText: `找到 ${replacementCount} 处可替换的文本 —— 鼠标悬停可操作`,
                        fontStyle: 'normal',
                        fontWeight: 'bold',
                        color: '#e37933',
                        backgroundColor: 'rgba(120, 200, 120, 0.2)',
                        padding: '0px 10px',
                        margin: '0 0 0 auto',
                        border: '1px solid rgba(120, 200, 120, 0.4)',
                        borderRadius: '4px',
                    }
                },
                hoverMessage: hoverMessage
            }]);
        }
    };
    
    // 初始更新
    updatePanelPosition();
    
    // 注册滚动事件监听
    const scrollDisposable = vscode.window.onDidChangeTextEditorVisibleRanges(e => {
        if (e.textEditor === editor) {
            updatePanelPosition();
        }
    });
    
    // 保存监听器以便稍后清理
    if (!global.i18nSwapperEventDisposables) {
        global.i18nSwapperEventDisposables = [];
    }
    global.i18nSwapperEventDisposables.push(scrollDisposable);
    
    // 使用Hover Provider提供更精确的悬停位置控制
    registerCustomHoverProvider(document, replacementCount);
    
    // 在文档最后一行添加全局操作按钮的 CodeLens
    addGlobalActionCodeLens(document);
    
    // 同时增强状态栏显示
    enhanceStatusBarDisplay(replacementCount);
    
    // 添加通知提示以确保用户可以找到操作
    vscode.window.showInformationMessage(
        `找到 ${replacementCount} 处可替换的文本`,
        "全部接受",
        "全部取消"
    ).then(selection => {
        if (selection === "全部接受") {
            vscode.commands.executeCommand("i18n-swapper.applyAllReplacements");
        } else if (selection === "全部取消") {
            vscode.commands.executeCommand("i18n-swapper.cancelAllReplacements");
        }
    });
}

/**
 * 注册自定义悬停提供器
 */
function registerCustomHoverProvider(document, replacementCount) {
    if (global.i18nSwapperHoverProvider) {
        global.i18nSwapperHoverProvider.dispose();
    }
    
    // 使用抽取的函数加载语言数据
    const { allLanguageData, languageMappings } = loadAllLanguageData();
    
    global.i18nSwapperHoverProvider = vscode.languages.registerHoverProvider(
        { pattern: document.uri.fsPath }, 
        {
            provideHover(document, position, token) {
                // 检查是否悬停在全局操作文本上
                const lineText = document.lineAt(position.line).text;
                if (lineText.includes(`找到 ${replacementCount} 处可替换的文本`)) {
                    const hoverContent = new vscode.MarkdownString(
                        `### i18n-swapper 批量国际化替换操作\n\n` +
                        `**[✓ 全部接受](command:i18n-swapper.applyAllReplacements)**  \n\n` +
                        `**[✗ 全部取消](command:i18n-swapper.cancelAllReplacements)**`
                    );
                    hoverContent.isTrusted = true;
                    hoverContent.supportHtml = true;
                    
                    return new vscode.Hover(hoverContent, new vscode.Range(position, position));
                }
                
                // 检查是否悬停在单个替换项上
                for (let i = 0; i < pendingReplacements.length; i++) {
                    const item = pendingReplacements[i];
                    if (item.range.contains(position) || 
                        (position.line === item.range.end.line && 
                         position.character > item.range.end.character)) {
                        
                        // 使用生成器函数生成悬停内容
                        const hoverContent = generateLanguageHoverContent({
                            allLanguageData,
                            languageMappings,
                            i18nKey: item.i18nKey,
                            index: i,
                            showActions: true,
                            useHideHoverCommand: false
                        });
                        
                        return new vscode.Hover(hoverContent, item.range);
                    }
                }
                
                return null;
            }
        }
    );
    
    // 保存以便稍后清理
    if (!global.i18nSwapperCommandDisposables) {
        global.i18nSwapperCommandDisposables = [];
    }
    global.i18nSwapperCommandDisposables.push(global.i18nSwapperHoverProvider);
}

/**
 * 添加全局操作CodeLens
 */
function addGlobalActionCodeLens(document) {
    // 如果已有CodeLens提供器，在现有提供器上添加新的CodeLens
    const lastLine = document.lineCount - 1;
    const lastLineRange = new vscode.Range(
        new vscode.Position(lastLine, 0),
        new vscode.Position(lastLine, document.lineAt(lastLine).text.length)
    );
    
    // 创建新的CodeLens提供器或扩展现有的
    const globalActionCodeLensProvider = vscode.languages.registerCodeLensProvider(
        { pattern: document.uri.fsPath },
        {
            provideCodeLenses(document) {
                const codeLenses = [];
                
                // 添加全局操作按钮
                const acceptAllLens = new vscode.CodeLens(
                    lastLineRange,
                    {
                        title: '✓ 全部接受',
                        command: 'i18n-swapper.applyAllReplacements',
                        arguments: []
                    }
                );
                
                const cancelAllLens = new vscode.CodeLens(
                    lastLineRange,
                    {
                        title: '✗ 全部取消',
                        command: 'i18n-swapper.cancelAllReplacements',
                        arguments: []
                    }
                );
                
                codeLenses.push(acceptAllLens, cancelAllLens);
                
                return codeLenses;
            }
        }
    );
    
    // 保存提供器以便稍后清理
    if (!global.i18nSwapperCodeLensDisposables) {
        global.i18nSwapperCodeLensDisposables = [];
    }
    global.i18nSwapperCodeLensDisposables.push(globalActionCodeLensProvider);
}

/**
 * 增强状态栏显示
 */
function enhanceStatusBarDisplay(replacementCount) {
    // 清理现有状态栏项
    if (global.i18nSwapperStatusBarItems) {
        global.i18nSwapperStatusBarItems.forEach(item => item.dispose());
    }
    
    global.i18nSwapperStatusBarItems = [];
    
    // 创建更加突出的状态栏项
    const countItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1000);
    countItem.text = `$(megaphone) 国际化替换: ${replacementCount}项`;
    countItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    countItem.color = new vscode.ThemeColor('statusBarItem.warningForeground');
    countItem.show();
    
    const acceptAllButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 999);
    acceptAllButton.text = "$(check-all) 全部接受";
    acceptAllButton.tooltip = "接受所有替换建议";
    acceptAllButton.command = "i18n-swapper.applyAllReplacements";
    acceptAllButton.show();
    
    const cancelAllButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 998);
    cancelAllButton.text = "$(x) 全部取消";
    cancelAllButton.tooltip = "取消所有替换建议";
    cancelAllButton.command = "i18n-swapper.cancelAllReplacements";
    cancelAllButton.show();
    
    global.i18nSwapperStatusBarItems.push(countItem, acceptAllButton, cancelAllButton);
}

/**
 * 注册所有命令
 */
function registerCommands() {
    // 释放已有命令
    if (global.i18nSwapperCommandDisposables) {
        global.i18nSwapperCommandDisposables.forEach(d => d.dispose());
    }
    
    global.i18nSwapperCommandDisposables = [];

    // 确认单个替换
    const confirmCmd = vscode.commands.registerCommand('i18n-swapper.confirmReplacement', async (args) => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        // 查找对应的替换项并执行替换
        const index = args.index;
        if (index >= 0 && index < pendingReplacements.length) {
            const item = pendingReplacements[index];
            const edit = new vscode.WorkspaceEdit();
            edit.replace(editor.document.uri, item.range, item.replacement);
            await vscode.workspace.applyEdit(edit);
            
            // 从待处理列表中移除
            pendingReplacements.splice(index, 1);
            
            // 更新装饰
            updateDecorations(editor);
        }
    });
    global.i18nSwapperCommandDisposables.push(confirmCmd);

    // 取消单个替换
    const cancelCmd = vscode.commands.registerCommand('i18n-swapper.cancelReplacement', (args) => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        // 从待处理列表中移除
        const index = args.index;
        if (index >= 0 && index < pendingReplacements.length) {
            pendingReplacements.splice(index, 1);
            
            // 更新装饰
            updateDecorations(editor);
        }
    });
    global.i18nSwapperCommandDisposables.push(cancelCmd);

    // 确认替换并隐藏悬浮窗
    const confirmHideCmd = vscode.commands.registerCommand('i18n-swapper.confirmReplacementAndHideHover', async (args) => {
        // 先隐藏悬浮窗
        await vscode.commands.executeCommand('i18n-swapper.hideHover');
        // 再确认替换
        await vscode.commands.executeCommand('i18n-swapper.confirmReplacement', args);
    });
    global.i18nSwapperCommandDisposables.push(confirmHideCmd);

    // 取消替换并隐藏悬浮窗
    const cancelHideCmd = vscode.commands.registerCommand('i18n-swapper.cancelReplacementAndHideHover', async (args) => {
        // 先隐藏悬浮窗
        await vscode.commands.executeCommand('i18n-swapper.hideHover');
        // 再取消替换
        await vscode.commands.executeCommand('i18n-swapper.cancelReplacement', args);
    });
    global.i18nSwapperCommandDisposables.push(cancelHideCmd);

    // 应用所有替换
    const confirmAllCmd = vscode.commands.registerCommand('i18n-swapper.confirmAllReplacements', () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            applyAllReplacements(editor);
        }
    });
    global.i18nSwapperCommandDisposables.push(confirmAllCmd);

    // 取消所有替换
    const cancelAllCmd = vscode.commands.registerCommand('i18n-swapper.cancelAllReplacements', () => {
        clearDecorations();
        vscode.window.showInformationMessage('已取消所有替换');
    });
    global.i18nSwapperCommandDisposables.push(cancelAllCmd);

    // 添加隐藏当前悬浮命令
    const hideHoverCmd = vscode.commands.registerCommand('i18n-swapper.hideHover', () => {});
    global.i18nSwapperCommandDisposables.push(hideHoverCmd);

    // 移除openLanguageFile命令的注册，因为它现在由openLanguageFile.js模块注册
    // 使用新的方法，命令只会注册一次
}

/**
 * 更新装饰
 */
function updateDecorations(editor) {
    if (pendingReplacements.length === 0) {
        clearDecorations();
        vscode.window.showInformationMessage('所有替换已处理完成');
    } else {
        // 重新显示装饰和全局操作面板
        const document = editor.document;
        
        // 清除旧的装饰
        if (confirmDecorationType) {
            confirmDecorationType.dispose();
            confirmDecorationType = null;
        }
        
        if (codeLensProvider) {
            codeLensProvider.dispose();
            codeLensProvider = null;
        }
        
        if (globalActionDecoration) {
            globalActionDecoration.dispose();
            globalActionDecoration = null;
        }
        
        // 更新显示
        showConfirmationDecorations(editor, document, pendingReplacements, 't', "'");
        showGlobalActionPanel(editor, document, pendingReplacements.length);
    }
}

/**
 * 应用所有替换
 */
async function applyAllReplacements(editor) {
    if (pendingReplacements.length === 0) return;

    const workspaceEdit = new vscode.WorkspaceEdit();
    for (const item of pendingReplacements) {
        workspaceEdit.replace(editor.document.uri, item.range, item.replacement);
    }

    await vscode.workspace.applyEdit(workspaceEdit);
    clearDecorations();
    vscode.window.showInformationMessage(`已替换 ${pendingReplacements.length} 处文本`);
    pendingReplacements = [];
}

/**
 * 清除所有装饰
 */
function clearDecorations() {
    if (confirmDecorationType) {
        confirmDecorationType.dispose();
        confirmDecorationType = null;
    }
    
    if (codeLensProvider) {
        codeLensProvider.dispose();
        codeLensProvider = null;
    }
    
    if (globalActionDecoration) {
        globalActionDecoration.dispose();
        globalActionDecoration = null;
    }
    
    // 清理状态栏项
    if (global.i18nSwapperStatusBarItems) {
        global.i18nSwapperStatusBarItems.forEach(item => item.dispose());
        global.i18nSwapperStatusBarItems = null;
    }
    
    // 清理事件监听器
    if (global.i18nSwapperEventDisposables) {
        global.i18nSwapperEventDisposables.forEach(d => d.dispose());
        global.i18nSwapperEventDisposables = null;
    }
    
    // 清理CodeLens提供器
    if (global.i18nSwapperCodeLensDisposables) {
        global.i18nSwapperCodeLensDisposables.forEach(d => d.dispose());
        global.i18nSwapperCodeLensDisposables = null;
    }
    
    // 清理自定义悬停提供器
    if (global.i18nSwapperHoverProvider) {
        global.i18nSwapperHoverProvider.dispose();
        global.i18nSwapperHoverProvider = null;
    }
    
    pendingReplacements = [];
}

// 导出单个函数，避免循环依赖
module.exports = quickBatchReplace;