const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

/**
 * i18n装饰管理器，负责为编辑器中的i18n函数调用添加翻译预览
 */
class I18nDecorator {
    constructor(context) {
        this.context = context;
        
        // 后缀模式的装饰器
        this.suffixDecorationType = vscode.window.createTextEditorDecorationType({
            after: {
                margin: '0 0 0 3px',
                color: new vscode.ThemeColor('editorCodeLens.foreground'),
                fontStyle: 'italic'
            }
        });
        
        // 内联模式的装饰器
        this.inlineDecorationType = vscode.window.createTextEditorDecorationType({
            before: {
                contentText: '',
            },
            textDecoration: 'none; opacity: 0;', // 隐藏原始文本
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
        });
        
        // 当前使用的装饰器类型
        this.decorationType = this.suffixDecorationType;
        
        this.localeData = {};
        this.activeEditor = vscode.window.activeTextEditor;
        this.localesPaths = [];
        this.defaultLocale = 'zh-CN'; // 默认语言
        this.decorationStyle = 'suffix'; // 默认装饰样式
    }

    /**
     * 初始化装饰器
     */
    async initialize() {
        // 加载配置的本地化文件路径
        this.loadConfig();
        
        // 检查并引导用户选择国际化文件
        const hasLocalesFiles = await this.checkAndSelectLocaleFile();
        
        if (hasLocalesFiles) {
            // 注册编辑器事件监听
            this.registerEvents();
            
            // 加载本地化数据
            this.loadLocaleData();

            // 如果有活动编辑器，立即更新装饰
            if (this.activeEditor) {
                this.updateDecorations();
            }
        }
    }

    /**
     * 加载插件配置
     */
    loadConfig() {
        const config = vscode.workspace.getConfiguration('i18n-swapper');
        this.localesPaths = config.get('localesPaths', []);
        this.defaultLocale = config.get('defaultLocale', 'zh-CN');
        this.decorationStyle = config.get('decorationStyle', 'suffix');
        
        // 根据配置选择装饰器类型
        this.decorationType = (this.decorationStyle === 'inline') 
            ? this.inlineDecorationType 
            : this.suffixDecorationType;
    }

    /**
     * 注册编辑器事件监听
     */
    registerEvents() {
        // 当活动编辑器变化时更新装饰
        vscode.window.onDidChangeActiveTextEditor(editor => {
            this.activeEditor = editor;
            if (editor) {
                this.updateDecorations();
            }
        }, null, this.context.subscriptions);

        // 当文档内容变化时更新装饰
        vscode.workspace.onDidChangeTextDocument(event => {
            if (this.activeEditor && event.document === this.activeEditor.document) {
                this.updateDecorations();
            }
        }, null, this.context.subscriptions);
        
        // 当配置变化时重新加载
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('i18n-swapper')) {
                this.loadConfig();
                this.loadLocaleData();
                this.updateDecorations();
            }
        }, null, this.context.subscriptions);
    }

    /**
     * 加载本地化数据文件
     */
    loadLocaleData() {
        this.localeData = {};
        
        // 获取工作区根路径
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('未找到工作区文件夹');
            return;
        }
        const rootPath = workspaceFolders[0].uri.fsPath;
        
        if (!this.localesPaths || this.localesPaths.length === 0) {
            vscode.window.showWarningMessage('i18n本地化文件路径未配置，请在设置中配置。');
            return;
        }

        for (const localePath of this.localesPaths) {
            try {
                // 构建完整路径
                const fullPath = path.join(rootPath, localePath);
                
                if (fs.existsSync(fullPath)) {
                    let data;
                    
                    if (fullPath.endsWith('.json')) {
                        const content = fs.readFileSync(fullPath, 'utf8');
                        data = JSON.parse(content);
                    } else if (fullPath.endsWith('.js')) {
                        // 清除require缓存
                        delete require.cache[require.resolve(fullPath)];
                        data = require(fullPath);
                    }
                    
                    if (data) {
                        // 扁平化对象并合并到本地化数据中
                        const flattenedData = this.flattenObject(data);
                        this.localeData = { ...this.localeData, ...flattenedData };
                        
                        console.log(`已加载国际化数据: ${localePath}, 键数量: ${Object.keys(flattenedData).length}`);
                    }
                } else {
                    console.warn(`本地化文件不存在: ${fullPath}`);
                }
            } catch (error) {
                console.error(`加载本地化文件 ${localePath} 失败:`, error);
            }
        }
        
        console.log(`总计加载 ${Object.keys(this.localeData).length} 个国际化键值`);
    }

    /**
     * 更新文档装饰
     */
    updateDecorations() {
        if (!this.activeEditor) {
            return;
        }

        const document = this.activeEditor.document;
        const text = document.getText();
        const decorations = [];
        const inlineDecorations = []; // 用于内联模式的装饰

        // 正则表达式模式
        const regexPatterns = [
            /t\(\s*['"]([^'"]+)['"]\s*\)/g,       // t('key')
            /\$t\(\s*['"]([^'"]+)['"]\s*\)/g,      // $t('key')
            /i18n\.t\(\s*['"]([^'"]+)['"]\s*\)/g,  // i18n.t('key')
            /this\.\$t\(\s*['"]([^'"]+)['"]\s*\)/g // this.$t('key')
        ];

        // 对每种模式进行匹配
        for (const pattern of regexPatterns) {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                const key = match[1]; // 提取键名
                let translatedText = this.localeData[key];
                
                if (!translatedText) {
                    translatedText = this.getNestedValue(key);
                }

                if (translatedText) {
                    const fullMatch = match[0]; // 例如: t('key')
                    const startPos = document.positionAt(match.index);
                    const endPos = document.positionAt(match.index + fullMatch.length);
                    
                    if (this.decorationStyle === 'suffix') {
                        // 后缀样式: t('key')(译文)
                        const decoration = {
                            range: new vscode.Range(startPos, endPos),
                            renderOptions: {
                                after: {
                                    contentText: `(${translatedText})`,
                                }
                            }
                        };
                        decorations.push(decoration);
                    } else {
                        // 内联样式: t(译文)
                        const funcNameEndIndex = fullMatch.indexOf('(');
                        const funcName = fullMatch.substring(0, funcNameEndIndex);
                        
                        // 函数名称的装饰
                        const funcDecoration = {
                            range: new vscode.Range(
                                startPos,
                                document.positionAt(match.index + funcNameEndIndex + 1)
                            ),
                            renderOptions: {
                                after: {
                                    contentText: '',
                                }
                            }
                        };
                        
                        // 整个函数调用的隐藏与重建
                        const replaceDecoration = {
                            range: new vscode.Range(startPos, endPos),
                            renderOptions: {
                                before: {
                                    contentText: `${funcName}(${translatedText})`,
                                },
                                textDecoration: 'none; opacity: 0;', // 隐藏原始文本
                            },
                            hoverMessage: `原始键: '${key}'`
                        };
                        
                        inlineDecorations.push(replaceDecoration);
                    }
                }
            }
        }

        // 应用装饰
        if (this.decorationStyle === 'suffix') {
            this.activeEditor.setDecorations(this.suffixDecorationType, decorations);
            this.activeEditor.setDecorations(this.inlineDecorationType, []); // 清除另一种装饰
        } else {
            this.activeEditor.setDecorations(this.inlineDecorationType, inlineDecorations);
            this.activeEditor.setDecorations(this.suffixDecorationType, []); // 清除另一种装饰
        }
    }

    /**
     * 获取嵌套键的值
     * @param {string} key 嵌套键名，如 'common.button.save'
     * @returns {string|undefined} 翻译值或undefined
     */
    getNestedValue(key) {
        // 如果已经在扁平化数据中找到，直接返回
        if (this.localeData[key]) {
            return this.localeData[key];
        }
        
        // 检查是否是嵌套键
        const parts = key.split('.');
        if (parts.length <= 1) return undefined;
        
        // 递归检查原始数据中的嵌套值
        try {
            // 获取工作区根路径
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) return undefined;
            
            const rootPath = workspaceFolders[0].uri.fsPath;
            
            // 尝试从每个本地化文件中查找
            for (const localePath of this.localesPaths) {
                try {
                    const fullPath = path.join(rootPath, localePath);
                    if (!fs.existsSync(fullPath)) continue;
                    
                    let data;
                    if (fullPath.endsWith('.json')) {
                        const content = fs.readFileSync(fullPath, 'utf8');
                        data = JSON.parse(content);
                    } else if (fullPath.endsWith('.js')) {
                        delete require.cache[require.resolve(fullPath)];
                        data = require(fullPath);
                    }
                    
                    if (!data) continue;
                    
                    // 递归查找嵌套键值
                    let value = data;
                    for (const part of parts) {
                        if (!value || typeof value !== 'object') return undefined;
                        value = value[part];
                    }
                    
                    if (typeof value === 'string') {
                        // 找到值后更新缓存
                        this.localeData[key] = value;
                        return value;
                    }
                } catch (error) {
                    console.error(`解析文件 ${localePath} 时出错:`, error);
                }
            }
        } catch (error) {
            console.error('获取嵌套值时出错:', error);
        }
        
        return undefined;
    }

    /**
     * 扁平化嵌套对象，将 {a: {b: 'value'}} 转换为 {'a.b': 'value'}
     * @param {Object} obj 嵌套对象
     * @param {string} prefix 前缀
     * @returns {Object} 扁平化后的对象
     */
    flattenObject(obj, prefix = '') {
        let result = {};
        
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                const value = obj[key];
                const newKey = prefix ? `${prefix}.${key}` : key;
                
                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    // 递归处理嵌套对象
                    Object.assign(result, this.flattenObject(value, newKey));
                } else if (typeof value === 'string') {
                    // 只保留字符串值
                    result[newKey] = value;
                }
            }
        }
        
        return result;
    }

    /**
     * 清除所有装饰
     */
    dispose() {
        this.suffixDecorationType.dispose();
        this.inlineDecorationType.dispose();
    }

    /**
     * 检查并引导用户选择国际化文件
     */
    async checkAndSelectLocaleFile() {
        if (!this.localesPaths || this.localesPaths.length === 0) {
            // 提示用户选择国际化文件
            const result = await vscode.window.showInformationMessage(
                '未配置源语言文件国际化词库路径（将用于国际化函数预览）（*.json 或 *.js）',
                { modal: true },
                '选择文件'
            );
            
            if (result === '选择文件') {
                // 打开文件选择器
                const fileUris = await vscode.window.showOpenDialog({
                    canSelectMany: true,
                    filters: {
                        '国际化文件': ['json', 'js']
                    },
                    title: '选择国际化文件'
                });
                
                if (fileUris && fileUris.length > 0) {
                    // 转换为相对于工作区的路径
                    const workspaceFolders = vscode.workspace.workspaceFolders;
                    if (!workspaceFolders) {
                        vscode.window.showErrorMessage('未找到工作区文件夹');
                        return false;
                    }
                    
                    const rootPath = workspaceFolders[0].uri.fsPath;
                    const relativePaths = fileUris.map(uri => {
                        const filePath = uri.fsPath;
                        return path.relative(rootPath, filePath).replace(/\\/g, '/');
                    });
                    
                    // 更新配置
                    const config = vscode.workspace.getConfiguration('i18n-swapper');
                    await config.update('localesPaths', relativePaths, vscode.ConfigurationTarget.Workspace);
                    
                    // 更新本地变量
                    this.localesPaths = relativePaths;
                    
                    vscode.window.showInformationMessage(`已添加 ${relativePaths.length} 个国际化文件`);
                    return true;
                }
            }
            return false;
        }
        return true;
    }
}

module.exports = I18nDecorator; 