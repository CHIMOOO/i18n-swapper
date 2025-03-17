const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const defaultsConfig = require('../config/defaultsConfig');  // 引入默认配置，更改为明确的名称
const { generateLanguageHoverContent } = require('../utils/hover-content-generator');  // 引入悬浮内容生成器

/**
 * i18n装饰管理器，负责为编辑器中的i18n函数调用添加翻译预览
 */
class I18nDecorator {
    constructor(context) {
        this.context = context;
        const config = vscode.workspace.getConfiguration('i18n-swapper');
        this.missingKeyBorderWidth = config.get('missingKeyBorderWidth', defaultsConfig.missingKeyBorderWidth);
        this.missingKeyBorderStyle = config.get('missingKeyBorderStyle', defaultsConfig.missingKeyBorderStyle);
        this.missingKeyBorderColor = config.get('missingKeyBorderColor', defaultsConfig.missingKeyBorderColor);
        this.missingKeyBorderSpacing = config.get('missingKeyBorderSpacing', defaultsConfig.missingKeyBorderSpacing);

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
                color: 'red'
            },
            textDecoration: 'none; opacity: 0;display: none;', // 隐藏原始文本
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
        });

        // 添加用于临时显示原始键名的装饰器
        this.editModeDecorationType = vscode.window.createTextEditorDecorationType({
            before: {
                contentText: '',
            },
            textDecoration: 'none;',
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
        });

        // 添加线装饰器（用于标记源语言库中不存在的键）
        this.missingKeyDecorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'transparent',
            isWholeLine: false,
            overviewRulerLane: vscode.OverviewRulerLane.Right,
            borderWidth: this.missingKeyBorderWidth,
            borderStyle: this.missingKeyBorderStyle,
            borderColor: this.missingKeyBorderColor,
            borderSpacing: this.missingKeyBorderSpacing,
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
        });

        // 当前使用的装饰器类型
        this.decorationType = this.suffixDecorationType;

        this.localeData = {};
        this.activeEditor = vscode.window.activeTextEditor;
        this.localesPaths = [];
        this.defaultLocale = 'zh-CN'; // 默认语言
        this.decorationStyle = 'suffix'; // 默认装饰样式
        this.showFullFormInEditMode = false;
        this.functionName = 't';
        this.quoteType = 'single';

        // 跟踪当前编辑状态
        this.isInEditMode = false;
        this.editModeRange = null;
        this.editModeOriginalKey = null;

        // 添加所有语言数据存储
        this.allLanguageData = {};
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

            // 加载所有语言数据
            this.loadAllLanguageData();
            
            // 注册悬浮提供器，用于后缀文本的悬浮显示
            this.registerHoverProvider();

            // 如果有活动编辑器，立即更新装饰
            if (this.activeEditor) {
                this.updateDecorations();
            }
        }
    }

    /**
     * 注册自定义悬浮提供器，用于处理装饰文本的悬浮
     */
    registerHoverProvider() {
        // 存储装饰信息，用于悬浮检测
        this.decorationHoverMap = new Map();
        
        // 注册悬浮提供器
        this.hoverProviderDisposable = vscode.languages.registerHoverProvider('*', {
            provideHover: (document, position, token) => {
                if (this.activeEditor && document === this.activeEditor.document) {
                    // 检查是否在函数调用区域内
                    for (const [key, value] of this.decorationHoverMap.entries()) {
                        // 检查是否在i18n函数调用的范围内
                        if (value.range.contains(position)) {
                            return new vscode.Hover(value.hoverContent, value.range);
                        }
                        
                        // 检查后缀模式下是否在后缀文本范围内
                        if (this.decorationStyle === 'suffix') {
                            const offset = document.offsetAt(position);
                            const suffixStart = document.offsetAt(value.range.end);
                            const suffixEnd = suffixStart + value.suffixLength;
                            
                            if (offset >= suffixStart && offset <= suffixEnd) {
                                return new vscode.Hover(value.hoverContent, value.range);
                            }
                        }
                    }
                }
                return null;
            }
        });
        
        this.context.subscriptions.push(this.hoverProviderDisposable);
    }

    /**
     * 加载插件配置
     */
    loadConfig() {
        const config = vscode.workspace.getConfiguration('i18n-swapper');
        this.localesPaths = config.get('localesPaths', defaultsConfig.localesPaths);
        this.defaultLocale = config.get('defaultLocale', defaultsConfig.defaultLocale);
        this.decorationStyle = config.get('decorationStyle', defaultsConfig.decorationStyle);
        this.showFullFormInEditMode = config.get('showFullFormInEditMode', defaultsConfig.showFullFormInEditMode);
        this.functionName = config.get('functionName', defaultsConfig.functionName);
        this.quoteType = config.get('quoteType', defaultsConfig.quoteType);

        // 加载样式配置
        this.suffixStyle = config.get('suffixStyle', defaultsConfig.suffixStyle);
        this.inlineStyle = config.get('inlineStyle', defaultsConfig.inlineStyle);
        
        // 加载缺失键样式配置
        this.missingKeyBorderWidth = config.get('missingKeyBorderWidth', defaultsConfig.missingKeyBorderWidth);
        this.missingKeyBorderStyle = config.get('missingKeyBorderStyle', defaultsConfig.missingKeyBorderStyle);
        this.missingKeyBorderColor = config.get('missingKeyBorderColor', defaultsConfig.missingKeyBorderColor);
        this.missingKeyBorderSpacing = config.get('missingKeyBorderSpacing', defaultsConfig.missingKeyBorderSpacing);

        // 更新装饰器类型
        this.updateDecoratorTypes();

        // 根据配置选择装饰器类型
        this.decorationType = (this.decorationStyle === 'inline') ?
            this.inlineDecorationType :
            this.suffixDecorationType;

        // 重新加载所有语言数据
        this.loadAllLanguageData();
    }

    /**
     * 根据样式配置更新装饰器类型
     */
    updateDecoratorTypes() {
        // 释放旧装饰器
        if (this.suffixDecorationType) {
            this.suffixDecorationType.dispose();
        }
        if (this.inlineDecorationType) {
            this.inlineDecorationType.dispose();
        }
        if (this.missingKeyDecorationType) {
            this.missingKeyDecorationType.dispose();
        }

        // 处理字体大小 - 确保有单位
        let suffixFontSize = this.suffixStyle.fontSize;
        if (typeof suffixFontSize === 'number' || !suffixFontSize.includes('px')) {
            suffixFontSize = `${suffixFontSize}px`;
        }

        let inlineFontSize = this.inlineStyle.fontSize;
        if (typeof inlineFontSize === 'number' || !inlineFontSize.includes('px')) {
            inlineFontSize = `${inlineFontSize}px`;
        }

        // 后缀模式的装饰器
        this.suffixDecorationType = vscode.window.createTextEditorDecorationType({
            after: {
                margin: this.suffixStyle.margin || '0 0 0 3px',
                color: this.suffixStyle.color,
                fontStyle: this.suffixStyle.fontStyle || 'italic',
                fontSize: suffixFontSize,
                fontWeight: String(this.suffixStyle.fontWeight)
            }
        });

        // 内联模式的装饰器
        this.inlineDecorationType = vscode.window.createTextEditorDecorationType({
            before: {
                contentText: '',
                color: this.inlineStyle.color,
                fontSize: inlineFontSize,
                fontWeight: String(this.inlineStyle.fontWeight),
                fontStyle: this.inlineStyle.fontStyle || 'normal',
                margin: this.inlineStyle.margin || '0'
            },
            textDecoration: 'none; opacity: 0; display: none;', // 隐藏原始文本
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
        });

        // 更新缺失键装饰器
        this.missingKeyDecorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'transparent',
            isWholeLine: false,
            overviewRulerLane: vscode.OverviewRulerLane.Right,
            borderWidth: this.missingKeyBorderWidth,
            borderStyle: this.missingKeyBorderStyle,
            borderColor: this.missingKeyBorderColor,
            borderSpacing: this.missingKeyBorderSpacing,
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
        });
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

        // 添加鼠标点击事件，用于切换编辑模式
        vscode.window.onDidChangeTextEditorSelection(e => {
            if (this.activeEditor && e.textEditor === this.activeEditor) {
                this.handleSelectionChange(e);
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
                        this.localeData = {
                            ...this.localeData,
                            ...flattenedData
                        };

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
     * 加载所有语言数据，用于悬浮显示
     */
    loadAllLanguageData(lang) {
        this.allLanguageData = {};
        
        // 获取工作区根路径
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return;
        }
        const rootPath = workspaceFolders[0].uri.fsPath;
        
        // 获取配置的语言映射
        const config = vscode.workspace.getConfiguration('i18n-swapper');
        const languageMappings = config.get('tencentTranslation.languageMappings', []);
        
        // 加载每种语言的数据
        for (const mapping of languageMappings) {
            if (lang && mapping.languageCode != lang) return; // 如果是加载指定语言，那就只取指定语言
            try {
                if (mapping.filePath) {
                    const fullPath = path.join(rootPath, mapping.filePath);
                    
                    if (fs.existsSync(fullPath)) {
                        let data;
                        
                        if (fullPath.endsWith('.json')) {
                            const content = fs.readFileSync(fullPath, 'utf8');
                            if (content) {
                                
                                data = JSON.parse(content);
                            } else {
                                data={}
                            }
                        } else if (fullPath.endsWith('.js')) {
                            // 清除require缓存
                            delete require.cache[require.resolve(fullPath)];
                            data = require(fullPath);
                        }
                        
                        if (data) {
                            this.allLanguageData[mapping.languageCode] = data;
                        }
                    } else {
                        this.allLanguageData[mapping.languageCode] = {};
                    }
                }
            } catch (error) {
                console.error(`加载语言文件失败 (${mapping.languageCode}):`, error);
            }
        }
    }

    /**
     * 更新文档装饰
     */
    updateDecorations() {
        if (!this.activeEditor) {
            return;
        }

        // 重置装饰悬浮映射
        this.decorationHoverMap = new Map();
        
        const document = this.activeEditor.document;
        const text = document.getText();
        const suffixDecorations = [];
        const inlineDecorations = [];
        const missingKeyDecorations = []; // 添加不存在键的装饰数组
        this.currentInlineDecorations = []; // 重置当前内联装饰数组

        // 获取语言映射配置
        const config = vscode.workspace.getConfiguration('i18n-swapper');
        const languageMappings = config.get('tencentTranslation.languageMappings', []);

        // 正则表达式模式，匹配各种i18n函数调用格式
        const regexPatterns = [
            /t\(\s*['"]([^'"]+)['"]\s*\)/g, // t('key')
            /\$t\(\s*['"]([^'"]+)['"]\s*\)/g, // $t('key')
            /i18n\.t\(\s*['"]([^'"]+)['"]\s*\)/g, // i18n.t('key')
            /this\.\$t\(\s*['"]([^'"]+)['"]\s*\)/g // this.$t('key')
        ];

        // 匹配每个i18n函数调用
        for (const pattern of regexPatterns) {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                const key = match[1]; // 提取键名
                let translatedText = this.localeData[key];

                if (!translatedText) {
                    // 尝试解析嵌套键
                    translatedText = this.getNestedValue(key);
                }

                const fullMatch = match[0]; // 例如: t('key')
                // 找到开始和结束位置
                const startPos = document.positionAt(match.index);
                const endPos = document.positionAt(match.index + fullMatch.length);

                // 创建悬浮内容（无论键是否存在都创建悬浮内容）
                const hoverContent = generateLanguageHoverContent({
                    allLanguageData: this.allLanguageData,
                    languageMappings: languageMappings,
                    i18nKey: key,
                    showActions: false, // 不显示操作按钮
                    missingKey: !translatedText // 标记是否为缺失的键
                });

                // 存储函数调用的位置和悬浮内容
                const decorationId = `${match.index}:${key}`;
                this.decorationHoverMap.set(decorationId, {
                    range: new vscode.Range(startPos, endPos),
                    suffixLength: translatedText ? (2 + translatedText.length) : 0, // '(' + 翻译文本 + ')'
                    hoverContent: hoverContent
                });

                if (translatedText) {
                    // 如果有翻译内容，创建正常的装饰（但不包含hoverMessage属性）
                    
                    // 创建后缀样式的装饰
                    const suffixDecoration = {
                        range: new vscode.Range(startPos, endPos),
                        renderOptions: {
                            after: {
                                contentText: `(${translatedText})`,
                                margin: this.suffixStyle.margin || '0 0 0 3px',
                                color: this.suffixStyle.color,
                                fontSize: typeof this.suffixStyle.fontSize === 'number' || 
                                        !this.suffixStyle.fontSize.includes('px') ? 
                                        `${this.suffixStyle.fontSize}px` : this.suffixStyle.fontSize,
                                fontWeight: String(this.suffixStyle.fontWeight),
                                fontStyle: this.suffixStyle.fontStyle || 'italic'
                            }
                        }
                        // 移除hoverMessage属性
                    };
                    suffixDecorations.push(suffixDecoration);

                    // 为内联样式找到括号内的内容位置
                    const quoteStartIndex = fullMatch.indexOf("'", fullMatch.indexOf('('));
                    const quoteEndIndex = fullMatch.lastIndexOf("'");

                    if (quoteStartIndex !== -1 && quoteEndIndex !== -1 && quoteStartIndex < quoteEndIndex) {
                        // 精确定位键名所在位置（引号之间的内容）
                        const keyStartPos = document.positionAt(match.index + quoteStartIndex + 1);
                        const keyEndPos = document.positionAt(match.index + quoteEndIndex);

                        // 存储装饰范围和原始键用于点击功能
                        this.currentInlineDecorations.push({
                            range: new vscode.Range(keyStartPos, keyEndPos),
                            originalKey: key
                        });

                        // 创建内联样式装饰，仅替换引号内的内容（但不包含hoverMessage属性）
                        const inlineDecoration = {
                            range: new vscode.Range(keyStartPos, keyEndPos),
                            renderOptions: {
                                before: {
                                    contentText: translatedText,
                                    margin: this.inlineStyle.margin || '0',
                                    color: this.inlineStyle.color,
                                    fontSize: typeof this.inlineStyle.fontSize === 'number' || 
                                            !this.inlineStyle.fontSize.includes('px') ? 
                                            `${this.inlineStyle.fontSize}px` : this.inlineStyle.fontSize,
                                    fontWeight: String(this.inlineStyle.fontWeight),
                                    fontStyle: this.inlineStyle.fontStyle || 'normal'
                                },
                                textDecoration: 'none; display: none;'
                            }
                            // 移除hoverMessage属性
                        };
                        inlineDecorations.push(inlineDecoration);
                    }
                } else {
                    // 如果键不存在，添加蓝色波浪线装饰（但不包含hoverMessage属性）
                    const missingKeyDecoration = {
                        range: new vscode.Range(startPos, endPos)
                        // 移除hoverMessage属性
                    };
                    missingKeyDecorations.push(missingKeyDecoration);
                }
            }
        }

        // 创建专门用于悬浮提示的装饰器
        const hoverDecorationType = vscode.window.createTextEditorDecorationType({
            // 不改变外观，只用于悬浮
            textDecoration: 'none; opacity: 0;'
        });

        // 根据当前设置和编辑模式应用装饰
        if (this.isInEditMode) {
            // 编辑模式下保持当前状态
            if (this.showFullFormInEditMode) {
                this.activeEditor.setDecorations(this.suffixDecorationType, suffixDecorations);
                this.activeEditor.setDecorations(this.inlineDecorationType, []);
                this.activeEditor.setDecorations(this.editModeDecorationType, []);
                this.activeEditor.setDecorations(this.missingKeyDecorationType, []);
            }
        } else {
            // 正常显示模式
            if (this.decorationStyle === 'suffix') {
                // 后缀模式: t('key')(译文)
                this.activeEditor.setDecorations(this.suffixDecorationType, suffixDecorations);
                this.activeEditor.setDecorations(this.inlineDecorationType, []);
                this.activeEditor.setDecorations(this.editModeDecorationType, []);
                this.activeEditor.setDecorations(this.missingKeyDecorationType, missingKeyDecorations);
                // 不再应用悬浮装饰
            } else {
                // 内联模式: t(译文)
                this.activeEditor.setDecorations(this.suffixDecorationType, []);
                this.activeEditor.setDecorations(this.inlineDecorationType, inlineDecorations);
                this.activeEditor.setDecorations(this.editModeDecorationType, []);
                this.activeEditor.setDecorations(this.missingKeyDecorationType, missingKeyDecorations);
                // 不再应用悬浮装饰
            }
        }

        // 使用完毕后释放临时装饰器
        hoverDecorationType.dispose();
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
        this.editModeDecorationType.dispose();
        this.missingKeyDecorationType.dispose();
        
        // 清理悬浮提供器
        if (this.hoverProviderDisposable) {
            this.hoverProviderDisposable.dispose();
        }
    }

    /**
     * 检查并引导用户选择国际化文件
     */
    async checkAndSelectLocaleFile() {
        if (!this.localesPaths || this.localesPaths.length === 0) {
            // 使用轻量级提示代替模态对话框，使用默认配置中的消息文本
            const result = await vscode.window.showInformationMessage(
                defaultsConfig.messages.noLocaleConfigured,
                defaultsConfig.messages.selectFile,
                defaultsConfig.messages.ignoreTemporarily
            );
         

            if (result === defaultsConfig.messages.selectFile) {
                // 打开文件选择器
                const fileUris = await vscode.window.showOpenDialog({
                    canSelectMany: true,
                    filters: {
                        '国际化文件': ['json', 'js']
                    },
                    title: '选择国际化文件'
                });

                if (fileUris && fileUris.length > 0) {
                    // 获取语言名称映射
                    const { LANGUAGE_NAMES } = require('../utils/language-mappings');
                    
                    // 构建语言选择项
                    const languageOptions = Object.entries(LANGUAGE_NAMES).map(([code, name]) => ({
                        label: `${name} (${code})`,
                        code: code
                    }));
                    
                    // 添加"其他"选项
                    languageOptions.push({ label: '其他', code: 'other' });
                    
                    // 提示用户选择语言
                    const selectedLanguage = await vscode.window.showQuickPick(languageOptions, {
                        placeHolder: '请选择这个文件对应的语言（将用于翻译对齐）',
                        canPickMany: false
                    });
                    
                    if (selectedLanguage && selectedLanguage.code !== 'other') {
                        const config = vscode.workspace.getConfiguration('i18n-swapper');
                        
                        // 更新源语言设置
                        await config.update('tencentTranslation.sourceLanguage', selectedLanguage.code, vscode.ConfigurationTarget.Workspace);
                        
                        // 获取工作区根路径
                        const workspaceFolders = vscode.workspace.workspaceFolders;
                        if (!workspaceFolders) {
                            vscode.window.showErrorMessage('未找到工作区文件夹');
                            return false;
                        }
                        const rootPath = workspaceFolders[0].uri.fsPath;
                        
                        // 准备语言映射（使用相对路径）
                        const languageMappings = fileUris.map(uri => {
                            const absolutePath = uri.fsPath;
                            const relativePath = path.relative(rootPath, absolutePath).replace(/\\/g, '/');
                            return {
                                languageCode: selectedLanguage.code,
                                filePath: relativePath
                            };
                        });
                        
                        // 更新语言映射设置
                        await config.update('tencentTranslation.languageMappings', languageMappings,  vscode.ConfigurationTarget.Workspace);
                        
                        vscode.window.showInformationMessage(`已将 ${selectedLanguage.label} 设置为源语言，并更新了语言映射配置`);
                    }
                    
                    // 继续处理选择的文件...
                    // 转换为相对于工作区的路径
                    const workspaceFolders = vscode.workspace.workspaceFolders;
                    if (!workspaceFolders) {
                        vscode.window.showErrorMessage(defaultsConfig.messages.workspaceNotFound);
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

                    vscode.window.showInformationMessage(defaultsConfig.messages.filesAdded(relativePaths.length));
                    return true;
                }
            } else if (result === defaultsConfig.messages.ignoreTemporarily) {
                // 用户选择忽略，返回true允许操作继续进行
                return true;
            }
            // 用户取消或关闭通知，返回false
            return false;
        }
        return true;
    }

    /**
     * 处理选择变化事件
     */
    handleSelectionChange(e) {
        // 仅当处于内联模式且有点击事件时处理
        if (this.decorationStyle !== 'inline' || e.selections.length !== 1) {
            return;
        }

        const selection = e.selections[0];
        
        // 如果选择不为空，用户正在拖拽选择文本，此时不应切换模式
        if (!selection.isEmpty) {
            return;
        }

        // 检查是否点击了装饰文本区域
        if (this.isInEditMode) {
            // 如果已经在编辑模式，检查是否点击了其他区域
            if (!this.editModeRange.contains(selection.active)) {
                // 用户点击了其他区域，退出编辑模式
                this.exitEditMode();
            }
        } else {
            // 检查是否点击了装饰文本
            for (const decoration of this.currentInlineDecorations) {
                if (decoration.range.contains(selection.active)) {
                    // 找到了点击的装饰，进入编辑模式
                    this.enterEditMode(decoration.range, decoration.originalKey);
                    break;
                }
            }
        }
    }

    /**
     * 进入编辑模式，暂时停用所有装饰
     */
    enterEditMode(range, originalKey) {
        // 标记为编辑模式
        this.isInEditMode = true;
        this.editModeRange = range;

        // 暂时禁用所有装饰
        this.activeEditor.setDecorations(this.suffixDecorationType, []);
        this.activeEditor.setDecorations(this.inlineDecorationType, []);
        this.activeEditor.setDecorations(this.editModeDecorationType, []);
        
        // 重新应用装饰
        this.updateDecorations();

        // 显示提示
        vscode.window.setStatusBarMessage(`编辑键: ${originalKey}`, 2000);
    }

    /**
     * 退出编辑模式，恢复翻译显示
     */
    exitEditMode() {
        if (!this.isInEditMode) return;

        // 清除标记
        this.isInEditMode = false;
        this.editModeRange = null;
        this.editModeOriginalKey = null;

        // 清除所有装饰，然后重新应用正常装饰
        this.activeEditor.setDecorations(this.editModeDecorationType, []);
        this.activeEditor.setDecorations(this.inlineDecorationType, []);
        this.activeEditor.setDecorations(this.suffixDecorationType, []);

        // 重新应用装饰
        this.updateDecorations();

        // 显示提示
        vscode.window.setStatusBarMessage('已恢复翻译显示', 2000);
    }
}

module.exports = I18nDecorator;