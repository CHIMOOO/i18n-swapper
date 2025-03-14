const vscode = require('vscode');
const utils = require('../utils');
const path = require('path');
const fs = require('fs');
const https = require('https');
const crypto = require('crypto');

/**
 * API翻译配置面板
 */
class ApiTranslationPanel {
    constructor(context) {
        this.subscriptions = context.subscriptions;
        this.panel = undefined;
        this.context = context;
        this.state = {
            apiKey: '',
            apiSecret: '',
            region: 'ap-guangzhou', // 默认区域
            languageMappings: [],
            sourceLanguage: 'zh' // 默认源语言
        };

        // 从配置中加载设置
        this.loadConfiguration();
    }

    /**
     * 加载配置
     */
    loadConfiguration() {
        const config = vscode.workspace.getConfiguration('i18n-swapper');
        this.state.apiKey = config.get('tencentTranslation.apiKey', '');
        this.state.apiSecret = config.get('tencentTranslation.apiSecret', '');
        this.state.region = config.get('tencentTranslation.region', 'ap-guangzhou');
        this.state.languageMappings = config.get('tencentTranslation.languageMappings', []);
        this.state.sourceLanguage = config.get('tencentTranslation.sourceLanguage', 'zh');
    }

    /**
     * 保存配置
     */
    async saveConfiguration() {
        const config = vscode.workspace.getConfiguration('i18n-swapper');
        
        // 使用await确保每个配置项都完成更新
        await config.update('tencentTranslation.apiKey', this.state.apiKey, vscode.ConfigurationTarget.Global);
        await config.update('tencentTranslation.apiSecret', this.state.apiSecret, vscode.ConfigurationTarget.Global);
        await config.update('tencentTranslation.region', this.state.region, vscode.ConfigurationTarget.Global);
        await config.update('tencentTranslation.sourceLanguage', this.state.sourceLanguage, vscode.ConfigurationTarget.Workspace);
        
        // 确保深度复制数组以避免引用问题
        const mappingsCopy = JSON.parse(JSON.stringify(this.state.languageMappings));
        
        // 过滤掉空的映射
        const filteredMappings = mappingsCopy.filter(mapping => 
            mapping.languageCode && mapping.languageCode.trim() && 
            mapping.filePath && mapping.filePath.trim()
        );
        
        // 保存有效的映射
        await config.update('tencentTranslation.languageMappings', filteredMappings, vscode.ConfigurationTarget.Workspace);
    }

    /**
     * 创建或显示面板
     */
    createOrShow() {
        // 如果已有面板，显示它
        if (this.panel) {
            this.panel.reveal();
            return;
        }

        // 创建一个新的WebView面板
        this.panel = vscode.window.createWebviewPanel(
            'i18nSwapperApiConfig',
            'API翻译配置',
            vscode.ViewColumn.Beside, {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: []
            }
        );

        // 当面板被销毁时，清理资源
        this.panel.onDidDispose(() => {
            this.panel = undefined;
        }, null, this.subscriptions);

        // 处理来自WebView的消息
        this.panel.webview.onDidReceiveMessage(this.handleWebviewMessage.bind(this));

        // 更新面板内容
        this.updatePanelContent();
    }

    /**
     * 更新面板内容
     */
    updatePanelContent() {
        if (!this.panel) return;

        this.panel.webview.html = this.getWebviewContent();
    }

    /**
     * 获取WebView内容
     */
    getWebviewContent() {
        const mappingsHtml = this.state.languageMappings.map((mapping, index) => `
            <div class="mapping-item" data-index="${index}">
                <div class="mapping-content">
                    <div class="mapping-language">
                        <input type="text" class="language-code" value="${mapping.languageCode}" placeholder="语言代码" maxlength="10">
                    </div>
                    <div class="mapping-file">
                        <input type="text" class="file-path" value="${mapping.filePath}" placeholder="国际化文件路径">
                        <button class="browse-btn">浏览...</button>
                    </div>
                </div>
                <button class="delete-mapping-btn">删除</button>
            </div>
        `).join('');

        const tutorialHtml = `
        <div class="tutorial">
            <h3>如何获取腾讯云API密钥</h3>
            <ol>
                <li>访问 <a href="https://console.cloud.tencent.com/" target="_blank">腾讯云控制台</a></li>
                <li>注册并登录您的账户</li>
                <li>在顶部导航栏点击【访问管理】</li>
                <li>在左侧菜单中选择【访问密钥】→【API密钥管理】</li>
                <li>点击【新建密钥】按钮创建新的API密钥</li>
                <li>复制生成的 SecretId 和 SecretKey 填入上方表单</li>
                <li>在【机器翻译】控制台开通机器翻译服务</li>
            </ol>
            <p>目标语言映射请参考 <a href="https://cloud.tencent.com/document/product/551/40566" target="_blank">批量文本翻译接口参数文档</a></p>
            <p>更多信息请参考 <a href="https://cloud.tencent.com/document/product/551/15611" target="_blank">腾讯云机器翻译文档</a></p>
        </div>`;

        return `
            <!DOCTYPE html>
            <html lang="zh-CN">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>API翻译配置</title>
                <style>
                    :root {
                        --primary-color: #4285f4;
                        --secondary-color: #34a853;
                        --danger-color: #ea4335;
                        --warning-color: #fbbc05;
                        --gray-100: #f8f9fa;
                        --gray-200: #e9ecef;
                        --gray-300: #dee2e6;
                        --gray-600: #6c757d;
                        --gray-800: #343a40;
                        --shadow: 0 2px 5px rgba(0,0,0,0.1);
                    }
                    body { 
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif; 
                        margin: 0; 
                        padding: 16px; 
                        color: var(--gray-800);
                        background-color: var(--gray-100);
                    }
                    .container {
                        background-color: white;
                        border-radius: 8px;
                        box-shadow: var(--shadow);
                        overflow: hidden;
                    }
                    h2 {
                        margin: 0;
                        padding: 16px;
                        background-color: var(--primary-color);
                        color: white;
                        font-size: 18px;
                    }
                    .content {
                        padding: 16px;
                    }
                    .api-config, .language-mappings, .translation-actions {
                        margin-bottom: 24px;
                    }
                    .api-config h3, .language-mappings h3, .translation-actions h3 {
                        margin-top: 0;
                        margin-bottom: 16px;
                        color: var(--gray-800);
                        font-size: 16px;
                    }
                    .form-group {
                        margin-bottom: 16px;
                    }
                    label {
                        display: block;
                        margin-bottom: 8px;
                        font-weight: 500;
                    }
                    input[type="text"], select {
                        width: 100%;
                        padding: 8px 12px;
                        border: 1px solid var(--gray-300);
                        border-radius: 4px;
                        font-size: 14px;
                        box-sizing: border-box;
                    }
                    input[type="text"]:focus, select:focus {
                        outline: none;
                        border-color: var(--primary-color);
                        box-shadow: 0 0 0 2px rgba(66, 133, 244, 0.2);
                    }
                    .btn-primary {
                        background-color: var(--primary-color);
                        color: white;
                        border: none;
                        border-radius: 4px;
                        padding: 8px 16px;
                        font-size: 14px;
                        cursor: pointer;
                        transition: background-color 0.2s;
                    }
                    .btn-primary:hover {
                        background-color: #3367d6;
                    }
                    .btn-secondary {
                        background-color: var(--gray-300);
                        color: var(--gray-800);
                        border: none;
                        border-radius: 4px;
                        padding: 8px 16px;
                        font-size: 14px;
                        cursor: pointer;
                        transition: background-color 0.2s;
                    }
                    .btn-secondary:hover {
                        background-color: var(--gray-200);
                    }
                    .btn-danger {
                        background-color: var(--danger-color);
                        color: white;
                        border: none;
                        border-radius: 4px;
                        padding: 8px 16px;
                        font-size: 14px;
                        cursor: pointer;
                        transition: background-color 0.2s;
                    }
                    .btn-danger:hover {
                        background-color: #d62516;
                    }
                    .button-group {
                        display: flex;
                        justify-content: flex-end;
                        gap: 8px;
                        margin-top: 16px;
                    }
                    .mapping-list {
                        margin-bottom: 16px;
                    }
                    .mapping-item {
                        display: flex;
                        align-items: center;
                        border: 1px solid var(--gray-300);
                        border-radius: 4px;
                        padding: 12px;
                        margin-bottom: 8px;
                        background-color: var(--gray-100);
                    }
                    .mapping-content {
                        flex: 1;
                        display: flex;
                        gap: 12px;
                    }
                    .mapping-language {
                        width: 80px;
                    }
                    .mapping-file {
                        flex: 1;
                        display: flex;
                        gap: 8px;
                    }
                    .browse-btn {
                        white-space: nowrap;
                        padding: 4px 8px;
                        border: 1px solid var(--gray-300);
                        background-color: var(--gray-200);
                        border-radius: 4px;
                        cursor: pointer;
                    }
                    .delete-mapping-btn {
                        background-color: transparent;
                        color: var(--danger-color);
                        border: none;
                        cursor: pointer;
                        padding: 4px 8px;
                        margin-left: 8px;
                    }
                    .add-mapping-btn {
                        background-color: var(--secondary-color);
                        color: white;
                        border: none;
                        border-radius: 4px;
                        padding: 8px 16px;
                        margin-top: 8px;
                        font-size: 14px;
                        cursor: pointer;
                        transition: background-color 0.2s;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    .add-mapping-btn:hover {
                        background-color: #2d9549;
                    }
                    .tutorial {
                        margin-top: 24px;
                        padding: 16px;
                        background-color: var(--gray-100);
                        border-radius: 4px;
                        border-left: 4px solid var(--warning-color);
                    }
                    .tutorial h3 {
                        margin-top: 0;
                        color: var(--gray-800);
                    }
                    .tutorial ol {
                        margin: 0;
                        padding-left: 20px;
                    }
                    .tutorial li {
                        margin-bottom: 8px;
                    }
                    .tutorial a {
                        color: var(--primary-color);
                        text-decoration: none;
                    }
                    .tutorial a:hover {
                        text-decoration: underline;
                    }
                    .divider {
                        height: 1px;
                        background-color: var(--gray-300);
                        margin: 24px 0;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h2>API翻译配置</h2>
                    <div class="content">
                        <div class="api-config">
                            <h3>腾讯云翻译API配置</h3>
                            <div class="form-group">
                                <label for="api-key">API密钥 ID (SecretId)</label>
                                <input type="text" id="api-key" value="${this.state.apiKey}" placeholder="输入腾讯云 SecretId">
                            </div>
                            <div class="form-group">
                                <label for="api-secret">API密钥 (SecretKey)</label>
                                <input type="text" id="api-secret" value="${this.state.apiSecret}" placeholder="输入腾讯云 SecretKey">
                            </div>
                            <div class="form-group">
                                <label for="api-region">API区域</label>
                                <select id="api-region">
                                    <option value="ap-guangzhou" ${this.state.region === 'ap-guangzhou' ? 'selected' : ''}>广州 (ap-guangzhou)</option>
                                    <option value="ap-shanghai" ${this.state.region === 'ap-shanghai' ? 'selected' : ''}>上海 (ap-shanghai)</option>
                                    <option value="ap-beijing" ${this.state.region === 'ap-beijing' ? 'selected' : ''}>北京 (ap-beijing)</option>
                                    <option value="ap-hongkong" ${this.state.region === 'ap-hongkong' ? 'selected' : ''}>香港 (ap-hongkong)</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="source-language">源语言代码</label>
                                <input type="text" id="source-language" value="${this.state.sourceLanguage}" placeholder="例如: zh">
                            </div>
                        </div>
                        
                        <div class="divider"></div>
                        
                        <div class="language-mappings">
                            <h3>语言映射配置</h3>
                            <p>设置目标语言代码与对应的国际化文件路径</p>
                            
                            <div class="mapping-list">
                                ${mappingsHtml}
                            </div>
                            
                            <button class="add-mapping-btn">
                                <span>添加语言映射</span>
                            </button>
                        </div>
                        
                        <div class="divider"></div>
                        
                        <div class="translation-actions">
                            <h3>翻译操作</h3>
                            <p>将源语言国际化文件翻译到所有目标语言文件中</p>
                            <button id="start-translation" class="btn-primary">开始翻译</button>
                        </div>
                        
                        <div class="button-group">
                            <button id="save-config" class="btn-primary">保存配置</button>
                            <button id="close-panel" class="btn-secondary">关闭</button>
                        </div>
                        
                        ${tutorialHtml}
                    </div>
                </div>
                
                <script>
                    (function() {
                        const vscode = acquireVsCodeApi();
                        
                        // 保存配置
                        document.getElementById('save-config').addEventListener('click', () => {
                            const apiKey = document.getElementById('api-key').value.trim();
                            const apiSecret = document.getElementById('api-secret').value.trim();
                            const region = document.getElementById('api-region').value;
                            const sourceLanguage = document.getElementById('source-language').value.trim();
                            
                            // 收集语言映射
                            const mappingItems = document.querySelectorAll('.mapping-item');
                            const languageMappings = [];
                            
                            mappingItems.forEach(item => {
                                const languageCode = item.querySelector('.language-code').value.trim();
                                const filePath = item.querySelector('.file-path').value.trim();
                                
                                if (languageCode && filePath) {
                                    languageMappings.push({
                                        languageCode: languageCode,
                                        filePath: filePath
                                    });
                                }
                            });
                            
                            vscode.postMessage({
                                command: 'saveConfig',
                                apiKey,
                                apiSecret,
                                region,
                                sourceLanguage,
                                languageMappings
                            });
                        });
                        
                        // 关闭面板
                        document.getElementById('close-panel').addEventListener('click', () => {
                            vscode.postMessage({
                                command: 'closePanel'
                            });
                        });
                        
                        // 添加语言映射
                        document.querySelector('.add-mapping-btn').addEventListener('click', () => {
                            vscode.postMessage({
                                command: 'addMapping'
                            });
                        });
                        
                        // 删除语言映射
                        document.querySelectorAll('.delete-mapping-btn').forEach(btn => {
                            btn.addEventListener('click', () => {
                                const mappingItem = btn.closest('.mapping-item');
                                const index = mappingItem.dataset.index;
                                
                                vscode.postMessage({
                                    command: 'deleteMapping',
                                    index: parseInt(index)
                                });
                            });
                        });
                        
                        // 浏览文件
                        document.querySelectorAll('.browse-btn').forEach(btn => {
                            btn.addEventListener('click', () => {
                                const mappingItem = btn.closest('.mapping-item');
                                const index = mappingItem.dataset.index;
                                
                                vscode.postMessage({
                                    command: 'browseFile',
                                    index: parseInt(index)
                                });
                            });
                        });
                        
                        // 开始翻译
                        document.getElementById('start-translation').addEventListener('click', () => {
                            vscode.postMessage({
                                command: 'startTranslation'
                            });
                        });
                    })();
                </script>
            </body>
            </html>
        `;
    }

    /**
     * 处理面板消息
     */
    async handleWebviewMessage(message) {
        switch (message.command) {
            case 'testConnection':
                await this.testConnection(message.apiKey, message.apiSecret, message.region);
                break;
            case 'saveConfig':
                try {
                    // 更新状态
                    this.state.apiKey = message.apiKey;
                    this.state.apiSecret = message.apiSecret;
                    this.state.region = message.region;
                    this.state.sourceLanguage = message.sourceLanguage;
                    
                    // 确保深拷贝languageMappings数组，避免引用问题
                    this.state.languageMappings = JSON.parse(JSON.stringify(message.languageMappings));
                    
                    // 保存配置
                    await this.saveConfiguration();
                    
                    vscode.window.showInformationMessage('API翻译配置已保存');
                } catch (error) {
                    console.error('保存配置时出错:', error);
                    vscode.window.showErrorMessage(`保存配置失败: ${error.message}`);
                }
                break;
            case 'updateSourceLanguage':
                this.state.sourceLanguage = message.sourceLanguage;
                await this.saveConfiguration();
                break;
            case 'addMapping':
                await this.addLanguageMapping();
                break;
            case 'removeMapping':
                await this.removeLanguageMapping(message.index);
                break;
            case 'updateMapping':
                await this.updateLanguageMapping(message.index, message.languageCode, message.filePath);
                break;
            case 'runTranslation':
                await this.runTranslation();
                break;
            case 'openApiTranslation':
                vscode.commands.executeCommand('i18n-swapper.openApiTranslationConfig');
                break;
        }
    }

    /**
     * 测试API连接
     */
    async testConnection(apiKey, apiSecret, region) {
        try {
            // 使用一个简单的翻译请求测试连接
            const result = await this.translateText('你好', 'zh', 'en', apiKey, apiSecret, region);

            if (result && result.Response && result.Response.TargetText) {
                this.panel.webview.postMessage({
                    command: 'connectionResult',
                    success: true,
                    message: `连接成功! 翻译测试: "你好" => "${result.Response.TargetText}"`
                });
            } else {
                throw new Error('翻译请求失败');
            }
        } catch (error) {
            console.error('测试连接出错:', error);
            this.panel.webview.postMessage({
                command: 'connectionResult',
                success: false,
                message: `连接失败: ${error.message}`
            });
        }
    }

    /**
     * 添加语言映射
     */
    async addLanguageMapping() {
        const localesPaths = vscode.workspace.getConfiguration('i18n-swapper').get('localesPaths', []);

        if (!localesPaths || localesPaths.length === 0) {
            vscode.window.showWarningMessage('请先配置国际化文件路径');
            return;
        }

        // 添加一个新的映射项
        this.state.languageMappings.push({
            languageCode: 'en', // 默认目标语言为英文
            filePath: localesPaths[0] // 默认使用第一个国际化文件
        });

        await this.saveConfiguration();
        this.updatePanelContent();
    }

    /**
     * 移除语言映射
     */
    async removeLanguageMapping(index) {
        if (index >= 0 && index < this.state.languageMappings.length) {
            this.state.languageMappings.splice(index, 1);
            await this.saveConfiguration();
            this.updatePanelContent();
        }
    }

    /**
     * 更新语言映射
     */
    async updateLanguageMapping(index, languageCode, filePath) {
        if (index >= 0 && index < this.state.languageMappings.length) {
            this.state.languageMappings[index] = {
                languageCode,
                filePath
            };

            await this.saveConfiguration();
        }
    }

    /**
     * 执行翻译
     */
    async runTranslation() {
        try {
            if (!this.state.apiKey || !this.state.apiSecret) {
                vscode.window.showErrorMessage('请先配置API密钥');
                return;
            }

            if (!this.state.languageMappings || this.state.languageMappings.length === 0) {
                vscode.window.showErrorMessage('请先配置语言映射');
                return;
            }

            // 获取当前工作区
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                vscode.window.showErrorMessage('未找到工作区文件夹');
                return;
            }

            const rootPath = workspaceFolders[0].uri.fsPath;

            // 获取源语言文件
            const sourceFiles = this.state.languageMappings.filter(m =>
                m.languageCode === this.state.sourceLanguage
            );

            if (sourceFiles.length === 0) {
                // 如果没有明确的源语言映射，使用localesPaths中的第一个文件
                const localesPaths = vscode.workspace.getConfiguration('i18n-swapper').get('localesPaths', []);
                if (localesPaths.length > 0) {
                    sourceFiles.push({
                        languageCode: this.state.sourceLanguage,
                        filePath: localesPaths[0]
                    });
                } else {
                    vscode.window.showErrorMessage('未找到源语言文件');
                    return;
                }
            }

            // 加载源语言文件
            const sourceFilePath = path.join(rootPath, sourceFiles[0].filePath);
            const sourceLocaleData = utils.loadLocaleFile(sourceFilePath);

            if (!sourceLocaleData) {
                vscode.window.showErrorMessage(`无法加载源语言文件: ${sourceFiles[0].filePath}`);
                return;
            }

            // 显示进度
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "正在执行翻译...",
                cancellable: true
            }, async (progress, token) => {
                // 收集需要翻译的键和值
                const keysToTranslate = this.flattenObject(sourceLocaleData);
                const totalKeys = Object.keys(keysToTranslate).length;
                const targetLanguages = this.state.languageMappings.filter(m =>
                    m.languageCode !== this.state.sourceLanguage
                );

                // 对每个目标语言进行翻译
                for (const targetLang of targetLanguages) {
                    if (token.isCancellationRequested) {
                        vscode.window.showInformationMessage('翻译已取消');
                        return;
                    }

                    progress.report({
                        message: `正在翻译 ${this.getLanguageName(targetLang.languageCode)}...`
                    });

                    // 加载目标语言文件
                    const targetFilePath = path.join(rootPath, targetLang.filePath);
                    let targetLocaleData = {};

                    try {
                        // 尝试加载现有文件
                        const existingData = utils.loadLocaleFile(targetFilePath);
                        if (existingData) {
                            targetLocaleData = existingData;
                        }
                    } catch (error) {
                        console.warn(`创建新的目标语言文件: ${targetLang.filePath}`);
                    }

                    // 逐个翻译键值
                    let processedCount = 0;
                    for (const [key, value] of Object.entries(keysToTranslate)) {
                        if (token.isCancellationRequested) break;

                        // 计算进度百分比
                        processedCount++;
                        const progressPercent = Math.round((processedCount / totalKeys) * 100);
                        progress.report({
                            message: `${this.getLanguageName(targetLang.languageCode)}: ${progressPercent}% (${processedCount}/${totalKeys})`,
                            increment: 100 / (totalKeys * targetLanguages.length)
                        });

                        // 检查目标文件中是否已有该键的翻译
                        const existingTranslation = this.getValueByPath(targetLocaleData, key);

                        // 如果已有翻译且不为空，则跳过
                        if (existingTranslation && typeof existingTranslation === 'string' && existingTranslation.trim() !== '') {
                            continue;
                        }

                        // 调用API翻译
                        try {
                            const translationResult = await this.translateText(
                                value,
                                this.state.sourceLanguage,
                                targetLang.languageCode,
                                this.state.apiKey,
                                this.state.apiSecret,
                                this.state.region
                            );

                            if (translationResult && translationResult.Response && translationResult.Response.TargetText) {
                                // 更新目标对象
                                this.setValueByPath(targetLocaleData, key, translationResult.Response.TargetText);
                            }

                            // 添加一个小延迟，以避免API速率限制
                            await new Promise(resolve => setTimeout(resolve, 100));
                        } catch (error) {
                            console.error(`翻译键 ${key} 出错:`, error);
                        }
                    }

                    // 保存更新后的目标语言文件
                    try {
                        if (!fs.existsSync(path.dirname(targetFilePath))) {
                            fs.mkdirSync(path.dirname(targetFilePath), {
                                recursive: true
                            });
                        }

                        if (targetFilePath.endsWith('.json')) {
                            fs.writeFileSync(targetFilePath, JSON.stringify(targetLocaleData, null, 2), 'utf8');
                        } else if (targetFilePath.endsWith('.js')) {
                            const jsContent = `module.exports = ${JSON.stringify(targetLocaleData, null, 2)};`;
                            fs.writeFileSync(targetFilePath, jsContent, 'utf8');
                        }

                        vscode.window.showInformationMessage(`已更新 ${this.getLanguageName(targetLang.languageCode)} 翻译文件: ${targetLang.filePath}`);
                    } catch (error) {
                        console.error(`保存目标语言文件 ${targetLang.filePath} 出错:`, error);
                        vscode.window.showErrorMessage(`保存翻译文件失败: ${error.message}`);
                    }
                }
            });

            vscode.window.showInformationMessage('翻译完成!');
        } catch (error) {
            console.error('执行翻译出错:', error);
            vscode.window.showErrorMessage(`翻译失败: ${error.message}`);
        }
    }

    /**
     * 获取语言名称
     */
    getLanguageName(code) {
        const languages = {
            'zh': '中文',
            'en': '英文',
            'ja': '日文',
            'ko': '韩文',
            'fr': '法文',
            'de': '德文',
            'es': '西班牙文',
            'ru': '俄文'
        };

        return languages[code] || code;
    }

    /**
     * 将嵌套对象扁平化为键值对
     * @param {Object} obj 嵌套对象
     * @param {string} prefix 键前缀
     * @returns {Object} 扁平化后的对象
     */
    flattenObject(obj, prefix = '') {
        let result = {};

        for (const key in obj) {
            const newKey = prefix ? `${prefix}.${key}` : key;
            if (typeof obj[key] === 'object' && obj[key] !== null) {
                // 递归处理嵌套对象
                Object.assign(result, this.flattenObject(obj[key], newKey));
            } else {
                // 只处理字符串值
                if (typeof obj[key] === 'string' && obj[key].trim() !== '') {
                    result[newKey] = obj[key];
                }
            }
        }

        return result;
    }

    /**
     * 根据路径获取对象中的值
     */
    getValueByPath(obj, path) {
        const keys = path.split('.');
        let current = obj;

        for (const key of keys) {
            if (current === undefined || current === null) return undefined;
            current = current[key];
        }

        return current;
    }

    /**
     * 根据路径设置对象中的值
     */
    setValueByPath(obj, path, value) {
        const keys = path.split('.');
        let current = obj;

        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (current[key] === undefined || current[key] === null || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }

        current[keys[keys.length - 1]] = value;
    }

    /**
     * 调用腾讯云翻译API
     */
    translateText(text, sourceLanguage, targetLanguage, secretId, secretKey, region) {
        return new Promise((resolve, reject) => {
            try {
                // 确保参数有效
                if (!text || !sourceLanguage || !targetLanguage || !secretId || !secretKey) {
                    return reject(new Error('翻译参数不完整'));
                }
                
                const endpoint = 'tmt.tencentcloudapi.com';
                const service = 'tmt';
                const action = 'TextTranslate';
                const version = '2018-03-21';
                const timestamp = Math.round(new Date().getTime() / 1000);
                
                // 请求参数
                const requestParams = {
                    SourceText: text,
                    Source: sourceLanguage,
                    Target: targetLanguage,
                    ProjectId: 0
                };
                
                // 参数签名
                const requestParamString = JSON.stringify(requestParams);
                
                // 生成签名所需参数
                const hashedRequestPayload = crypto
                    .createHash('sha256')
                    .update(requestParamString)
                    .digest('hex');
                
                const canonicalRequest = [
                    'POST',
                    '/',
                    '',
                    'content-type:application/json; charset=utf-8',
                    'host:' + endpoint,
                    '',
                    'content-type;host',
                    hashedRequestPayload
                ].join('\n');
                
                const date = new Date(timestamp * 1000).toISOString().split('T')[0];
                const stringToSign = [
                    'TC3-HMAC-SHA256',
                    timestamp,
                    `${date}/${service}/tc3_request`,
                    crypto
                        .createHash('sha256')
                        .update(canonicalRequest)
                        .digest('hex')
                ].join('\n');
                
                // 计算签名
                const secretDate = crypto
                    .createHmac('sha256', 'TC3' + secretKey)
                    .update(date)
                    .digest();
                
                const secretService = crypto
                    .createHmac('sha256', secretDate)
                    .update(service)
                    .digest();
                
                const secretSigning = crypto
                    .createHmac('sha256', secretService)
                    .update('tc3_request')
                    .digest();
                
                const signature = crypto
                    .createHmac('sha256', secretSigning)
                    .update(stringToSign)
                    .digest('hex');
                
                // 构造授权信息
                const authorization = [
                    'TC3-HMAC-SHA256',
                    `Credential=${secretId}/${date}/${service}/tc3_request`,
                    `SignedHeaders=content-type;host`,
                    `Signature=${signature}`
                ].join(', ');
                
                // 配置请求头
                const headers = {
                    Authorization: authorization,
                    'Content-Type': 'application/json; charset=utf-8',
                    Host: endpoint,
                    'X-TC-Action': action,
                    'X-TC-Timestamp': timestamp.toString(),
                    'X-TC-Version': version,
                    'X-TC-Region': region
                };
                
                // 请求配置
                const options = {
                    hostname: endpoint,
                    method: 'POST',
                    headers: headers,
                    protocol: 'https:'
                };
                
                const req = https.request(options, (res) => {
                    const chunks = [];
                    
                    res.on('data', (chunk) => {
                        chunks.push(chunk);
                    });
                    
                    res.on('end', () => {
                        try {
                            const response = JSON.parse(Buffer.concat(chunks).toString());
                            if (response.Response && response.Response.Error) {
                                reject(new Error(`${response.Response.Error.Code}: ${response.Response.Error.Message}`));
                            } else if (response.Response && response.Response.TargetText) {
                                // 直接返回翻译后的文本字符串
                                resolve(response.Response.TargetText);
                            } else {
                                reject(new Error('无效的API响应'));
                            }
                        } catch (error) {
                            reject(error);
                        }
                    });
                });
                
                req.on('error', (error) => {
                    reject(error);
                });
                
                req.write(requestParamString);
                req.end();
            } catch (error) {
                reject(error);
            }
        });
    }
}

module.exports = ApiTranslationPanel; 