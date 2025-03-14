const vscode = require('vscode');

const utils = require('../utils');

const path = require('path');

const fs = require('fs');

const https = require('https');

const crypto = require('crypto');

const {
    SUPPORTED_LANGUAGE_MAPPINGS,
    LANGUAGE_NAMES
} = require('../utils/language-mappings');



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

        // 如果已有面板，直接显示

        if (this.panel) {

            this.panel.reveal();

            return;

        }



        // 创建新面板

        this.panel = vscode.window.createWebviewPanel(

            'i18nApiConfig',

            'API翻译配置',

            vscode.ViewColumn.One,

            {

                enableScripts: true,

                retainContextWhenHidden: true

            }

        );



        // 处理面板关闭

        this.panel.onDidDispose(() => {

            this.panel = undefined;

        }, null, this.subscriptions);



        // 处理面板消息

        this.panel.webview.onDidReceiveMessage(

            this.handleWebviewMessage.bind(this),

            null,

            this.subscriptions

        );



        // 更新内容

        this.updatePanelContent();

    }



    /**

     * 更新面板内容

     */

    updatePanelContent() {

        if (this.panel) {

            this.panel.webview.html = this.getWebviewContent();

        }

    }



    /**

     * 获取WebView内容

     */

 /**
  * 获取WebView内容
  */
 getWebviewContent() {
     const {
         apiKey,
         apiSecret,
         region,
         languageMappings,
         sourceLanguage
     } = this.state;

     // 获取语言映射列表的 HTML
     const mappingsHtml = this.getMappingsHTML(languageMappings);

     // 获取可用语言选项的 HTML
     const languageOptions = Object.keys(LANGUAGE_NAMES).map(code =>
         `<option value="${code}" ${code === sourceLanguage ? 'selected' : ''}>${LANGUAGE_NAMES[code]} (${code})</option>`
     ).join('');

     return `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>API翻译配置</title>
        <style>
            :root {
                --primary-color: #0052d9;
                --primary-hover: #0046be;
                --secondary-color: #0ea5e9;
                --text-color: #1e293b;
                --text-light: #64748b;
                --border-color: #e2e8f0;
                --bg-color: #f8fafc;
                --card-bg: #ffffff;
                --card-border: #eaecf0;
                --success-color: #10b981;
                --error-color: #ef4444;
                --input-bg: #f9fafb;
                --border-radius: 6px;
                --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
                --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            }
            
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
                padding: 0;
                margin: 0;
                background-color: var(--bg-color);
                color: var(--text-color);
                line-height: 1.5;
            }
            
            .container {
                max-width: 900px;
                margin: 0 auto;
                padding: 24px;
            }
            
            .header {
                text-align: center;
                margin-bottom: 32px;
            }
            
            .header h1 {
                font-size: 24px;
                font-weight: 600;
                margin: 0;
                color: var(--text-color);
            }
            
            .card {
                background-color: var(--card-bg);
                border-radius: var(--border-radius);
                box-shadow: var(--shadow-sm);
                border: 1px solid var(--card-border);
                margin-bottom: 24px;
                overflow: hidden;
            }
            
            .card-header {
                padding: 16px 20px;
                display: flex;
                align-items: center;
                border-bottom: 1px solid var(--border-color);
                background-color: rgba(0, 82, 217, 0.03);
            }
            
            .card-icon {
                width: 22px;
                height: 22px;
                background-color: var(--primary-color);
                color: white;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                margin-right: 12px;
                font-size: 14px;
                flex-shrink: 0;
            }
            
            .card-title {
                font-size: 16px;
                font-weight: 600;
                color: var(--text-color);
                margin: 0;
            }
            
            .card-body {
                padding: 20px;
            }
                .ten-card .form-group label{
                    width: 200px;
                }
            
            .form-group {
                margin-bottom: 16px;
         display: flex;
    align-items: center;
            }
            
            .form-group label {
                display: block;
                margin-right: 16px;
                font-weight: 500;
                font-size: 14px;
                color: var(--text-color);
                    width: 70px;
                        display: flex;
    align-items: center;
            }
            
            input[type="text"], 
            input[type="password"],
            select {
                width: 100%;
                padding: 10px 12px;
                border: 1px solid var(--border-color);
                background-color: var(--input-bg);
                color: var(--text-color);
                border-radius: var(--border-radius);
                box-sizing: border-box;
                font-size: 14px;
                transition: border-color 0.2s ease, box-shadow 0.2s ease;
            }
            
            input[type="text"]:focus, 
            input[type="password"]:focus,
            select:focus {
                outline: none;
                border-color: var(--primary-color);
                box-shadow: 0 0 0 3px rgba(0, 82, 217, 0.2);
            }
            
            select {
                height: 40px;
                cursor: pointer;
                appearance: none;
                background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%231e293b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E");
                background-repeat: no-repeat;
                background-position: right 10px center;
                background-size: 16px;
                padding-right: 40px;
            }
            
            .file-path-row {
                display: flex;
                gap: 8px;
                align-items: center;
                width: 100%;
            }
            
            .file-path-row input {
                flex: 1;
            }
            
            button {
                background-color: var(--primary-color);
                color: white;
                border: none;
                padding: 10px 16px;
                border-radius: var(--border-radius);
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                transition: background-color 0.2s ease;
            }
            
            button:hover {
                background-color: var(--primary-hover);
            }
            
            button:disabled {
                opacity: 0.6;
                cursor: not-allowed;
            }
            
            button.secondary {
                background-color: #f1f5f9;
                color: var(--text-color);
                border: 1px solid var(--border-color);
            }
            
            button.secondary:hover {
                background-color: #e2e8f0;
            }
            
            .browse-button {
                flex-shrink: 0;
                padding: 8px 12px;
            }
            
            .button-group {
                display: flex;
                gap: 10px;
                justify-content: flex-start;
                margin-top: 15px;
                margin-bottom: 5px;
            }
            
            .mapping-container {
                margin-top: 15px;
            }
            
            .mapping-item {
                background-color: var(--card-bg);
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius);
                margin-bottom: 12px;
            }
            
            .mapping-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px 16px;
                border-bottom: 1px solid var(--border-color);
                background-color: rgba(0, 82, 217, 0.03);
            }
            
            .mapping-title {
                font-weight: 500;
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            .mapping-title input {
                width: 60px;
                padding: 4px 8px;
                font-size: 14px;
            }
            
            .mapping-fields {
                padding: 12px 16px;
            }
            
            .delete-mapping {
                background: none;
                border: none;
                color: var(--error-color);
                cursor: pointer;
                font-size: 18px;
                padding: 0 5px;
                background-color: transparent;
            }
            
            .delete-mapping:hover {
                background-color: rgba(239, 68, 68, 0.1);
                border-radius: 50%;
            }
            
            .empty-message {
                text-align: center;
                padding: 20px;
                color: var(--text-light);
            }
            
            /* 学习资源和帮助部分 */
            .tutorial {
                background-color: white;
                padding: 20px;
                border-radius: var(--border-radius);
                margin-top: 24px;
                border: 1px solid #e5e7eb;
            }
            
            .tutorial h3 {
                margin-top: 0;
                font-size: 16px;
                color: var(--text-color);
            }
            
            .tutorial ol {
                padding-left: 20px;
                margin-bottom: 15px;
            }
            
            .tutorial li {
                margin-bottom: 6px;
                font-size: 14px;
            }
            
            .tutorial p {
                margin: 8px 0;
                font-size: 14px;
            }
            
            .tutorial a {
                color: var(--primary-color);
                text-decoration: none;
            }
            
            .tutorial a:hover {
                text-decoration: underline;
            }
            
            /* 快速创建部分 */
            .language-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 10px;
                margin-top: 16px;
            }
            
            .language-item {
                display: flex;
                align-items: center;
                padding: 8px 10px;
                background-color: var(--input-bg);
                border-radius: var(--border-radius);
                border: 1px solid var(--border-color);
            }
            
            .language-item input[type="checkbox"] {
                margin-right: 8px;
            }
            
            .language-item label {
                margin: 0;
                font-size: 14px;
                font-weight: normal;
                cursor: pointer;
            }
            
            .folder-display {
                display: none;
                align-items: center;
                gap: 10px;
                margin-top: 15px;
                padding: 10px 12px;
                background-color: var(--input-bg);
                border-radius: var(--border-radius);
                border: 1px solid var(--border-color);
            }
            
            .folder-path {
                font-family: monospace;
                font-size: 14px;
                color: var(--text-color);
            }
            
            /* 消息通知 */
            .toast {
                position: fixed;
                top: 20px;
                right: 20px;
                background-color: var(--success-color);
                color: white;
                padding: 12px 20px;
                border-radius: var(--border-radius);
                box-shadow: var(--shadow);
                opacity: 0;
                transform: translateX(30px);
                transition: opacity 0.3s, transform 0.3s;
                z-index: 1000;
            }
            
            .toast.error {
                background-color: var(--error-color);
            }
            
            .toast.show {
                opacity: 1;
                transform: translateX(0);
            }
            
            @media (max-width: 768px) {
                .language-grid {
                    grid-template-columns: repeat(2, 1fr);
                }
            }
            
            @media (max-width: 480px) {
                .language-grid {
                    grid-template-columns: 1fr;
                }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>API 翻译配置</h1>
            </div>
            
            <div class="card ten-card">
                <div class="card-header">
                    <div class="card-icon">🔑</div>
                    <h2 class="card-title">腾讯云翻译 API 设置</h2>
                </div>
                <div class="card-body">
                    <div class="form-group">
                        <label for="apiKey">API Key (SecretId)</label>
                        <input type="text" id="apiKey" value="${this.escapeHtml(apiKey)}" placeholder="请输入 SecretId">
                    </div>
                    <div class="form-group">
                        <label for="apiSecret">API Secret (SecretKey)</label>
                        <input type="password" id="apiSecret" value="${this.escapeHtml(apiSecret)}" placeholder="请输入 SecretKey">
                    </div>
                    <div class="form-group">
                        <label for="apiRegion">API 地区</label>
                        <select id="apiRegion">
                            <option value="ap-beijing" ${region === 'ap-beijing' ? 'selected' : ''}>北京</option>
                            <option value="ap-guangzhou" ${region === 'ap-guangzhou' ? 'selected' : ''}>广州</option>
                            <option value="ap-hongkong" ${region === 'ap-hongkong' ? 'selected' : ''}>香港</option>
                            <option value="ap-shanghai" ${region === 'ap-shanghai' ? 'selected' : ''}>上海</option>
                            <option value="ap-singapore" ${region === 'ap-singapore' ? 'selected' : ''}>新加坡</option>
                        </select>
                    </div>
                    <div class="button-group">
                        <button id="save-config">保存配置</button>
                        <button id="test-connection" class="secondary">测试连接</button>
                    </div>
                </div>
            </div>
            
            <div class="card">
                <div class="card-header">
                    <div class="card-icon">🌐</div>
                    <h2 class="card-title">语言映射设置</h2>
                </div>
                <div class="card-body">
                    <div class="form-group">
                        <label for="sourceLanguage">您的源语言</label>
                        <select id="sourceLanguage">
                            ${languageOptions}
                        </select>
                    </div>
                    
                    <h3 style="margin-top: 24px; font-size: 16px;">语言映射</h3>
                    <p style="font-size: 14px; color: var(--text-light); margin-top: 8px;">
                        配置每种语言对应的国际化文件路径。文件路径应相对于工作区根目录。
                    </p>
                    
                    <div id="mappings-container" class="mapping-container">
                        ${mappingsHtml}
                    </div>
                    
                    <div class="button-group">
                        <button id="add-mapping" class="secondary">添加语言映射</button>
                    </div>
                    
                    <h3 style="margin-top: 32px; font-size: 16px;">快速创建多语言文件</h3>
                    <p style="font-size: 14px; color: var(--text-light); margin-top: 8px;">
                        选择源语言和目标语言，一键创建多语言文件和映射配置。
                    </p>
                    
                    <div class="form-group">
                        <label style="width: 150px;" for="quick-source-language">快速创建的源语言</label>
                        <select id="quick-source-language">
                            ${languageOptions}
                        </select>
                    </div>
                    
                    <label style="font-weight: 500; font-size: 14px; display: block; margin-bottom: 8px;">
                        目标语言（多选）
                    </label>
                    <div id="target-languages" class="language-grid">
                        <!-- 这里将由JS动态生成目标语言选项 -->
                    </div>
                    
                    <div class="button-group">
                        <button id="select-folder" class="secondary">选择当前国际化存储文件夹</button>
                        <button id="create-language-files" disabled>创建选中的语言文件</button>
                    </div>
                    
                    <div id="folder-display" class="folder-display">
                        <span>选择的文件夹:</span>
                        <span id="folder-path" class="folder-path"></span>
                    </div>
                </div>
            </div>
            
            <!-- 腾讯云说明部分 -->
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
            </div>
            
            <!-- 消息通知 -->
            <div id="toast" class="toast">
                <span class="toast-message"></span>
            </div>
        </div>
        
        <script>
            (function() {
                const vscode = acquireVsCodeApi();
                
                // 缓存当前配置
                let currentConfig = {
                    apiKey: '${this.escapeHtml(apiKey)}',
                    apiSecret: '${this.escapeHtml(apiSecret)}',
                    region: '${region}',
                    sourceLanguage: '${sourceLanguage}',
                    languageMappings: ${JSON.stringify(languageMappings)}
                };
                
                // 文件夹选择状态
                let selectedFolder = null;
                let selectedLanguages = [];
                
                // 绑定保存按钮事件
                document.getElementById('save-config').addEventListener('click', function() {
                    // 获取API设置
                    const apiKey = document.getElementById('apiKey').value;
                    const apiSecret = document.getElementById('apiSecret').value;
                    const region = document.getElementById('apiRegion').value;
                    const sourceLanguage = document.getElementById('sourceLanguage').value;
                    
                    // 获取语言映射
                    const mappingsContainer = document.getElementById('mappings-container');
                    const mappingItems = mappingsContainer.querySelectorAll('.mapping-item');
                    
                    const languageMappings = Array.from(mappingItems).map(item => {
                        return {
                            languageCode: item.querySelector('.language-code').value,
                            filePath: item.querySelector('.file-path').value
                        };
                    }).filter(mapping => mapping.languageCode && mapping.filePath);
                    
                    const config = {
                        apiKey,
                        apiSecret,
                        region,
                        sourceLanguage,
                        languageMappings
                    };
                    
                    // 发送到扩展
                    vscode.postMessage({
                        command: 'saveConfig',
                        config: config
                    });
                    
                    // 更新缓存的配置
                    currentConfig = config;
                });
                
                // 绑定测试连接按钮事件
                document.getElementById('test-connection').addEventListener('click', function() {
                    vscode.postMessage({
                        command: 'testConnection'
                    });
                });
                
                // 添加语言映射按钮事件
                document.getElementById('add-mapping').addEventListener('click', function() {
                    const mappingsContainer = document.getElementById('mappings-container');
                    
                    const newMappingItem = document.createElement('div');
                    newMappingItem.className = 'mapping-item';
                    newMappingItem.innerHTML = \`
                        <div class="mapping-header">
                            <div class="mapping-title">
                                <span>国际化语言</span>
                                <input type="text" class="language-code" placeholder="语言代码">
                            </div>
                            <button class="delete-mapping" title="删除此映射">×</button>
                        </div>
                        <div class="mapping-fields">
                            <div class="form-group" style="margin-bottom: 0;">
                                <label>文件路径</label>
                                <div class="file-path-row">
                                    <input type="text" class="file-path" placeholder="相对于工作区的路径">
                                    <button class="browse-button secondary">浏览</button>
                                </div>
                            </div>
                        </div>
                    \`;
                    
                    mappingsContainer.appendChild(newMappingItem);
                    
                    // 绑定删除按钮事件
                    newMappingItem.querySelector('.delete-mapping').addEventListener('click', function() {
                        mappingsContainer.removeChild(newMappingItem);
                    });
                    
                    // 绑定浏览按钮事件
                    newMappingItem.querySelector('.browse-button').addEventListener('click', function() {
                        vscode.postMessage({
                            command: 'selectLocaleFile',
                            index: Array.from(mappingsContainer.querySelectorAll('.mapping-item')).indexOf(newMappingItem)
                        });
                    });
                });
                
                // 绑定所有浏览按钮事件
                document.querySelectorAll('.browse-button').forEach(button => {
                    button.addEventListener('click', function() {
                        const item = this.closest('.mapping-item');
                        const index = Array.from(document.querySelectorAll('.mapping-item')).indexOf(item);
                        
                        vscode.postMessage({
                            command: 'selectLocaleFile',
                            index: index
                        });
                    });
                });
                
                // 绑定所有删除按钮事件
                document.querySelectorAll('.delete-mapping').forEach(button => {
                    button.addEventListener('click', function() {
                        const item = this.closest('.mapping-item');
                        if (item) {
                            item.parentNode.removeChild(item);
                        }
                    });
                });
                
                // 绑定快速创建相关事件
                const quickSourceLanguage = document.getElementById('quick-source-language');
                quickSourceLanguage.addEventListener('change', updateTargetLanguages);
                
                // 初始加载目标语言选项
                updateTargetLanguages();
                
                // 选择文件夹按钮
                document.getElementById('select-folder').addEventListener('click', function() {
                    vscode.postMessage({
                        command: 'selectFolder'
                    });
                });
                
                // 创建语言文件按钮
                document.getElementById('create-language-files').addEventListener('click', function() {
                    if (!selectedFolder || selectedLanguages.length === 0) return;
                    
                    vscode.postMessage({
                        command: 'createLanguageFiles',
                        sourceLanguage: quickSourceLanguage.value,
                        targetLanguages: selectedLanguages,
                        folder: selectedFolder
                    });
                    
                    showToast('开始创建语言文件...', 'success');
                });
                
                // 更新目标语言选项
                function updateTargetLanguages() {
                    const sourceLanguage = document.getElementById('quick-source-language').value;
                    const container = document.getElementById('target-languages');
                    container.innerHTML = '<div style="text-align:center;width:100%;padding:10px;">正在加载语言选项...</div>';
                    
                    // 获取语言映射数据
                    const languageMappings = ${JSON.stringify(SUPPORTED_LANGUAGE_MAPPINGS)};
                    const targetLanguages = languageMappings[sourceLanguage] || [];
                    
                    // 清空容器
                    container.innerHTML = '';
                    
                    if (targetLanguages.length === 0) {
                        container.innerHTML = '<p style="text-align:center;width:100%;padding:10px;">该源语言没有可用的目标语言</p>';
                        return;
                    }
                    
                    // 清空选中状态
                    selectedLanguages = [];
                    
                    // 创建目标语言复选框
                    targetLanguages.forEach(langCode => {
                        const langName = getLanguageName(langCode);
                        
                        const item = document.createElement('div');
                        item.className = 'language-item';
                        item.innerHTML = \`
                            <input type="checkbox" id="lang-\${langCode}" value="\${langCode}">
                            <label for="lang-\${langCode}">\${langName} (\${langCode})</label>
                        \`;
                        
                        container.appendChild(item);
                        
                        // 添加复选框事件
                        const checkbox = item.querySelector('input[type="checkbox"]');
                        checkbox.addEventListener('change', function() {
                            if (this.checked) {
                                if (!selectedLanguages.includes(this.value)) {
                                    selectedLanguages.push(this.value);
                                }
                            } else {
                                selectedLanguages = selectedLanguages.filter(l => l !== this.value);
                            }
                            
                            updateCreateButtonState();
                        });
                    });
                }
                
                // 更新创建按钮状态
                function updateCreateButtonState() {
                    const createButton = document.getElementById('create-language-files');
                    createButton.disabled = !selectedFolder || selectedLanguages.length === 0;
                }
                
                // 获取语言名称
                function getLanguageName(code) {
                    const names = ${JSON.stringify(LANGUAGE_NAMES)};
                    return names[code] || code;
                }
                
                // 显示通知
                function showToast(message, type = 'success') {
                    const toast = document.getElementById('toast');
                    const toastMessage = toast.querySelector('.toast-message');
                    
                    toast.className = type === 'error' ? 'toast error' : 'toast';
                    toastMessage.textContent = message;
                    
                    // 显示通知
                    setTimeout(() => {
                        toast.classList.add('show');
                        
                        // 3秒后隐藏
                        setTimeout(() => {
                            toast.classList.remove('show');
                        }, 3000);
                    }, 100);
                }
                
                // 接收来自扩展的消息
                window.addEventListener('message', event => {
                    const message = event.data;
                    
                    switch (message.command) {
                        case 'folderSelected':
                            selectedFolder = message.folder;
                            document.getElementById('folder-display').style.display = 'flex';
                            document.getElementById('folder-path').textContent = message.displayPath || message.folder;
                            updateCreateButtonState();
                            break;
                            
                        case 'updateLocaleFile':
                            const fileInputs = document.querySelectorAll('.file-path');
                            if (fileInputs[message.index]) {
                                fileInputs[message.index].value = message.path;
                            }
                            break;
                            
                        case 'showMessage':
                            showToast(message.text, message.type || 'success');
                            break;
                    }
                });
            })();
        </script>
    </body>
    </html>
    `;
 }

 /**
  * 获取语言映射的HTML内容
  * @param {Array} mappings 语言映射数组
  * @returns {string} 映射的HTML内容
  */
 getMappingsHTML(mappings) {
     if (!mappings || mappings.length === 0) {
         return `
            <div class="empty-message">
                尚未配置语言映射，请点击"添加语言映射"按钮添加。
            </div>
        `;
     }

     return mappings.map((mapping, index) => {
         const languageName = this.getLanguageName(mapping.languageCode);
         return `
            <div class="mapping-item" data-index="${index}">
                <div class="mapping-header">
                    <div class="mapping-title">
                        <span>${languageName}</span>
                        <input type="text" class="language-code" style="width:100px;"  value="${this.escapeHtml(mapping.languageCode || '')}" placeholder="语言代码">
                    </div>
                    <button class="delete-mapping" data-index="${index}" title="删除此映射">×</button>
                </div>
                <div class="mapping-fields">
                    <div class="form-group" style="margin-bottom: 0;">
                        <label>文件路径</label>
                        <div class="file-path-row">
                            <input type="text" class="file-path" value="${this.escapeHtml(mapping.filePath || '')}" placeholder="相对于工作区的路径">
                            <button class="browse-button secondary">浏览</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
     }).join('');
 }


    /**

     * 获取语言映射的HTML内容

     * @param {Array} mappings 语言映射数组

     * @returns {string} 映射的HTML内容

     */

    getMappingsHTML(mappings) {

        if (!mappings || mappings.length === 0) {

            return `

                <div class="empty-message">

                    尚未配置语言映射，请点击"添加语言映射"按钮添加。

                </div>

            `;

        }



        return mappings.map((mapping, index) => {

            const languageName = this.getLanguageName(mapping.languageCode);

            return `

                <div class="mapping-item" data-index="${index}">

                    <div class="mapping-header">

                        <div class="mapping-title">${languageName} (${mapping.languageCode})   <input type="text" class="language-code" value="${this.escapeHtml(mapping.languageCode || '')}" placeholder="如: en, zh, ja"></div>

                        <button class="delete-mapping" data-index="${index}" title="删除此映射">×</button>

                    </div>

                    <div class="mapping-fields">

                 

                        <div class="form-group">

                            <label>文件路径</label>

                            <div class="file-path-row">

                                <input type="text" class="file-path" value="${this.escapeHtml(mapping.filePath || '')}" placeholder="相对于工作区的路径">

                                <button class="browse-button" data-index="${index}">浏览</button>

                            </div>

                        </div>

                    </div>

                </div>

            `;

        }).join('');

    }



    /**

     * 转义HTML特殊字符

     */

    escapeHtml(text) {

        if (!text) return '';

        return text

            .replace(/&/g, '&amp;')

            .replace(/</g, '&lt;')

            .replace(/>/g, '&gt;')

            .replace(/"/g, '&quot;')

            .replace(/'/g, '&#039;');

    }



    /**

     * 处理面板消息

     */

    async handleWebviewMessage(message) {

        try {

            console.log('收到WebView消息:', message.command);



            switch (message.command) {

                case 'saveConfig':

                    await this.saveConfig(message.config);

                    break;



                case 'testConnection':

                    await this.testConnection();

                    break;



                case 'closePanel':

                    this.panel.dispose();

                    break;



                case 'selectLocaleFile':

                    await this.selectLocaleFile(message.index);

                    break;



                case 'selectFolder':

                    await this.selectFolder();

                    break;



                case 'createLanguageFiles':

                    await this.createLanguageFiles(

                        message.sourceLanguage,

                        message.targetLanguages,

                        message.folder

                    );

                    break;



                default:

                    console.log('未处理的命令:', message.command);

            }

        } catch (error) {

            console.error('处理WebView消息出错:', error);

            vscode.window.showErrorMessage(`操作失败: ${error.message}`);

        }

    }



    /**

     * 测试API连接

     */

    async testConnection() {

        try {

            // 使用一个简单的翻译请求测试连接

            const result = await this.translateText('你好', 'zh', 'en', this.state.apiKey, this.state.apiSecret, this.state.region);



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

        return LANGUAGE_NAMES[code] || code;

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



    /**

     * 选择文件夹

     */

    async selectFolder() {

        try {

            // 获取工作区根目录作为默认值

            let defaultUri = undefined;

            if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {

                defaultUri = vscode.workspace.workspaceFolders[0].uri;

            }



            const options = {

                canSelectFiles: false,

                canSelectFolders: true,

                canSelectMany: false,

                openLabel: '选择保存国际化文件的文件夹',

                defaultUri: defaultUri

            };



            const folderUris = await vscode.window.showOpenDialog(options);

            if (!folderUris || folderUris.length === 0) return;



            const folderPath = folderUris[0].fsPath;



            // 获取工作区相对路径用于显示

            let displayPath = folderPath;

            if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {

                const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;

                const relativePath = path.relative(rootPath, folderPath);

                if (relativePath) {

                    displayPath = relativePath;

                }

            }



            // 通知WebView已选择文件夹

            if (this.panel) {

                this.panel.webview.postMessage({

                    command: 'folderSelected',

                    folder: folderPath,

                    displayPath: displayPath

                });

            }

        } catch (error) {

            console.error('选择文件夹出错:', error);

            vscode.window.showErrorMessage(`选择文件夹失败: ${error.message}`);

        }

    }



    /**

     * 创建语言文件

     */

    async createLanguageFiles(sourceLanguage, targetLanguages, folderPath) {

        try {

            if (!sourceLanguage || !targetLanguages || targetLanguages.length === 0 || !folderPath) {

                vscode.window.showErrorMessage('创建语言文件的参数无效');

                return;

            }



            // 获取工作区根路径

            const workspaceFolders = vscode.workspace.workspaceFolders;

            if (!workspaceFolders || workspaceFolders.length === 0) {

                vscode.window.showErrorMessage('未找到工作区文件夹');

                return;

            }

            const rootPath = workspaceFolders[0].uri.fsPath;



            // 选择文件格式

            const fileFormat = await vscode.window.showQuickPick(

                ['JSON (.json)', 'JavaScript (.js)'],

                {

                    title: '选择文件格式',

                    placeHolder: '请选择国际化文件格式'

                }

            );



            if (!fileFormat) return;



            const extension = fileFormat.includes('JSON') ? '.json' : '.js';



            // 创建文件和更新映射

            const createdFiles = [];

            const newMappings = [];



            // 创建源语言文件

            const sourceFileName = `${sourceLanguage}${extension}`;

            const sourceFilePath = path.join(folderPath, sourceFileName);



            if (!fs.existsSync(sourceFilePath)) {

                // 创建空对象

                if (extension === '.json') {

                    fs.writeFileSync(sourceFilePath, '{}', 'utf8');

                } else {

                    fs.writeFileSync(sourceFilePath, 'module.exports = {};', 'utf8');

                }

                createdFiles.push(sourceFilePath);

            }



            // 添加源语言映射

            const relativeSourcePath = path.relative(rootPath, sourceFilePath).replace(/\\/g, '/');

            newMappings.push({

                languageCode: sourceLanguage,

                filePath: relativeSourcePath

            });



            // 创建目标语言文件

            for (const langCode of targetLanguages) {

                const fileName = `${langCode}${extension}`;

                const filePath = path.join(folderPath, fileName);



                if (!fs.existsSync(filePath)) {

                    // 创建空对象

                    if (extension === '.json') {

                        fs.writeFileSync(filePath, '{}', 'utf8');

                    } else {

                        fs.writeFileSync(filePath, 'module.exports = {};', 'utf8');

                    }

                    createdFiles.push(filePath);

                }



                // 添加映射

                const relativePath = path.relative(rootPath, filePath).replace(/\\/g, '/');

                newMappings.push({

                    languageCode: langCode,

                    filePath: relativePath

                });

            }



            // 合并映射并去重

            const existingCodes = this.state.languageMappings.map(m => m.languageCode);

            const mappingsToAdd = newMappings.filter(m => !existingCodes.includes(m.languageCode));



            this.state.languageMappings = [...this.state.languageMappings, ...mappingsToAdd];



            // 保存配置

            await this.saveConfiguration();



            // 刷新面板

            this.updatePanelContent();



            vscode.window.showInformationMessage(

                `已创建 ${createdFiles.length} 个语言文件并添加 ${mappingsToAdd.length} 个映射`

            );

        } catch (error) {

            console.error('创建语言文件出错:', error);

            vscode.window.showErrorMessage(`创建语言文件失败: ${error.message}`);

        }

    }



    /**

     * 保存翻译到文件

     */

    async saveTranslationToFile(filePath, key, value) {

        try {

            const backupPath = `${filePath}.bak`;



            // 确保目录存在

            const dirPath = path.dirname(filePath);

            if (!fs.existsSync(dirPath)) {

                fs.mkdirSync(dirPath, {
                    recursive: true
                });

            }



            // 加载现有文件或创建新对象

            let data = {};

            if (fs.existsSync(filePath)) {

                try {

                    if (filePath.endsWith('.json')) {

                        const content = fs.readFileSync(filePath, 'utf8');

                        data = JSON.parse(content);

                    } else if (filePath.endsWith('.js')) {

                        // 创建备份

                        fs.copyFileSync(filePath, backupPath);



                        // 尝试加载JS模块

                        delete require.cache[require.resolve(filePath)];

                        data = require(filePath);

                    }

                } catch (err) {

                    console.error(`加载文件失败: ${err.message}`);

                    data = {};

                }

            }



            // 设置键值

            utils.setValueByPath(data, key, value);



            // 保存文件

            if (filePath.endsWith('.json')) {

                fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');

            } else if (filePath.endsWith('.js')) {

                fs.writeFileSync(filePath, `module.exports = ${JSON.stringify(data, null, 2)};`, 'utf8');

            }



            // 删除备份文件

            if (fs.existsSync(backupPath)) {

                fs.unlinkSync(backupPath);

            }



            return true;

        } catch (error) {

            console.error(`保存翻译失败: ${error.message}`);

            throw error;

        }

    }



    /**

     * 保存配置

     */

    async saveConfig(config) {

        try {

            // 更新状态

            this.state.apiKey = config.apiKey;

            this.state.apiSecret = config.apiSecret;

            this.state.region = config.region;

            this.state.sourceLanguage = config.sourceLanguage;



            // 确保深拷贝languageMappings数组，避免引用问题

            this.state.languageMappings = JSON.parse(JSON.stringify(config.languageMappings));



            // 保存配置

            await this.saveConfiguration();



            vscode.window.showInformationMessage('API翻译配置已保存');

        } catch (error) {

            console.error('保存配置时出错:', error);

            vscode.window.showErrorMessage(`保存配置失败: ${error.message}`);

        }

    }



    /**

     * 选择国际化文件

     */

    async selectLocaleFile(index) {

        try {

            // 获取工作区根目录作为默认值

            let defaultUri = undefined;

            if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {

                defaultUri = vscode.workspace.workspaceFolders[0].uri;

            }



            const options = {

                canSelectMany: false,

                filters: {

                    '国际化文件': ['js', 'json']

                },

                openLabel: '选择国际化文件',

                defaultUri: defaultUri

            };



            const fileUris = await vscode.window.showOpenDialog(options);

            if (!fileUris || fileUris.length === 0) return;



            const filePath = fileUris[0].fsPath;



            // 转换为相对路径

            let relativePath = filePath;

            if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {

                const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;

                relativePath = path.relative(rootPath, filePath).replace(/\\/g, '/');

            }



            // 通知WebView更新

            if (this.panel) {

                this.panel.webview.postMessage({

                    command: 'updateLocaleFile',

                    index: index,

                    path: relativePath

                });

            }

        } catch (error) {

            console.error('选择国际化文件出错:', error);

            vscode.window.showErrorMessage(`选择文件失败: ${error.message}`);

        }

    }



    /**

     * 批量翻译所有未翻译的项目

     */

    async batchTranslate() {

        try {

            // 获取待翻译项目

            const itemsToTranslate = await this.getUntranslatedItems();


            if (!itemsToTranslate || itemsToTranslate.length === 0) {

                vscode.window.showInformationMessage('没有找到需要翻译的项目');

                return;

            }


            // 显示进度条

            await vscode.window.withProgress({

                location: vscode.ProgressLocation.Notification,

                title: "正在进行批量翻译",

                cancellable: true

            }, async (progress, token) => {

                const total = itemsToTranslate.length * this.state.languageMappings.length;

                let completed = 0;


                // 添加取消功能

                token.onCancellationRequested(() => {

                    throw new Error('用户取消了翻译');

                });


                for (const item of itemsToTranslate) {

                    const {
                        key,
                        text
                    } = item;


                    for (const mapping of this.state.languageMappings) {

                        try {

                            // 跳过源语言

                            if (mapping.languageCode === this.state.sourceLanguage) {

                                completed++;

                                progress.report({
                                    increment: (1 / total) * 100,
                                    message: `已完成 ${completed}/${total}`
                                });

                                continue;

                            }


                            // 获取文件路径

                            const filePath = this.resolveFilePath(mapping.filePath);

                            if (!filePath) continue;


                            // 翻译文本

                            const translation = await this.translateText(

                                text,

                                this.state.sourceLanguage,

                                mapping.languageCode,

                                this.state.apiKey,

                                this.state.apiSecret,

                                this.state.region

                            );


                            // 更新翻译文件

                            if (translation && translation.Response && translation.Response.TargetText) {

                                await this.saveTranslationToFile(filePath, key, translation.Response.TargetText);

                            }


                            // 更新进度

                            completed++;

                            progress.report({
                                increment: (1 / total) * 100,
                                message: `已完成 ${completed}/${total}`
                            });


                            // 添加延迟，避免 API 请求过快

                            await new Promise(resolve => setTimeout(resolve, 300));

                        } catch (err) {

                            console.error(`翻译失败 [${key}] 到 [${mapping.languageCode}]:`, err);

                        }

                    }

                }


                return completed;

            });


            vscode.window.showInformationMessage('批量翻译完成');

        } catch (error) {

            console.error('批量翻译出错:', error);

            vscode.window.showErrorMessage(`批量翻译失败: ${error.message}`);

        }

    }



    /**

     * 获取需要翻译的项目列表

     */

    async getUntranslatedItems() {

        try {

            // 从源语言文件中加载键和文本

            const sourceMapping = this.state.languageMappings.find(m => m.languageCode === this.state.sourceLanguage);

            if (!sourceMapping) {

                throw new Error('未找到源语言映射');

            }


            const sourceFilePath = this.resolveFilePath(sourceMapping.filePath);

            if (!sourceFilePath || !fs.existsSync(sourceFilePath)) {

                throw new Error(`源语言文件不存在: ${sourceMapping.filePath}`);

            }


            // 加载源文件

            const sourceData = utils.loadLocaleFile(sourceFilePath);

            if (!sourceData) return [];


            // 转换为扁平结构的键值对

            return utils.flattenObject(sourceData).map(({
                key,
                value
            }) => ({

                key,

                text: value

            }));

        } catch (error) {

            console.error('获取未翻译项目出错:', error);

            throw error;

        }

    }



    /**

     * 解析文件的绝对路径

     */

    resolveFilePath(relativePath) {

        try {

            if (!relativePath) return null;


            // 如果是绝对路径，直接返回

            if (path.isAbsolute(relativePath)) {

                return relativePath;

            }


            // 转换为绝对路径

            const workspaceFolders = vscode.workspace.workspaceFolders;

            if (!workspaceFolders || workspaceFolders.length === 0) {

                throw new Error('未找到工作区文件夹');

            }


            const rootPath = workspaceFolders[0].uri.fsPath;

            return path.join(rootPath, relativePath);

        } catch (error) {

            console.error('解析文件路径出错:', error);

            return null;

        }

    }

}



module.exports = ApiTranslationPanel;