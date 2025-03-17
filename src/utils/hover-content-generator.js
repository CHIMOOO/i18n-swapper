const vscode = require('vscode');
const { LANGUAGE_NAMES } = require('./language-mappings');

/**
 * 生成多语言悬浮显示内容
 * @param {Object} params - 生成参数
 * @param {Object} params.allLanguageData - 所有语言的数据映射表
 * @param {Array} params.languageMappings - 语言映射配置
 * @param {String} params.i18nKey - 国际化键
 * @param {Number} params.index - 替换项索引
 * @param {Boolean} params.showActions - 是否显示操作按钮
 * @param {Boolean} params.useHideHoverCommand - 是否使用隐藏悬浮的命令
 * @returns {vscode.MarkdownString} MarkdownString对象
 */
function generateLanguageHoverContent(params) {
    const {
        allLanguageData,
        languageMappings,
        i18nKey,
        index,
        showActions = true,
        useHideHoverCommand = false
    } = params;
    
    let languageValuesMarkdown = '';
    
    if (i18nKey) {
        const keyPath = i18nKey.split('.');
        
        // 获取所有配置的语言，确保即使没有值也显示语言
        Object.keys(allLanguageData).forEach(langCode => {
            // 获取语言显示名称
            const langName = `${LANGUAGE_NAMES[langCode]}[${langCode}]` || langCode;
            
            if (!allLanguageData[langCode]) {
                // 语言文件不存在
                languageValuesMarkdown += `- **${langName}**: *文件未找到*\n`;
                return;
            }
            
            // 从语言数据中获取值
            let value = allLanguageData[langCode];
            let found = true;
            
            for (const key of keyPath) {
                if (value && typeof value === 'object' && key in value) {
                    value = value[key];
                } else {
                    found = false;
                    break;
                }
            }
            
            // 无论是否找到值，都添加可点击的语言名称链接
            const mappingObj = languageMappings.find(m => m.languageCode === langCode);
            if (mappingObj && mappingObj.filePath) {
                // 为所有语言添加可点击链接，不管键是否存在
                languageValuesMarkdown += 
                    `- **[${langName}](command:i18n-swapper.openLanguageFile?` + 
                    `${encodeURIComponent(JSON.stringify({ 
                        filePath: mappingObj.filePath, 
                        langCode: langCode,
                        i18nKey: i18nKey,
                        shouldLocateKey: found // 添加一个标志，指示是否应该定位到键
                    }))})**` +
                    `: ${found && value !== undefined ? (typeof value === 'object' ? JSON.stringify(value) : value) : '* 键不存在 *'}\n`;
            } else {
                languageValuesMarkdown += `- **${langName}**: ${found && value !== undefined ? (typeof value === 'object' ? JSON.stringify(value) : value) : '* 键不存在 *'}\n`;
            }
        });
    }
    
    // 如果没有配置任何语言
    if (!languageValuesMarkdown) {
        languageValuesMarkdown = '- *未配置其他语言*\n';
    }
    
    // 创建Markdown内容
    let content = '';
    
    // 添加操作按钮
    if (showActions) {
        const confirmCommand = useHideHoverCommand ? 
            'i18n-swapper.confirmReplacementAndHideHover' : 
            'i18n-swapper.confirmReplacement';
            
        const cancelCommand = useHideHoverCommand ? 
            'i18n-swapper.cancelReplacementAndHideHover' : 
            'i18n-swapper.cancelReplacement';
            
        content += `**[✓ 接受此替换](command:${confirmCommand}?${encodeURIComponent(JSON.stringify({ index }))})**\n` +
                  `**[✗ 取消此替换](command:${cancelCommand}?${encodeURIComponent(JSON.stringify({ index }))})**\n`;
    }
    
    // 添加语言值部分
    content += `##### 其他语言值\n\n${languageValuesMarkdown}\n`;
    
    // 创建MarkdownString对象
    const markdownContent = new vscode.MarkdownString(content);
    markdownContent.isTrusted = true;
    markdownContent.supportHtml = true;
    
    return markdownContent;
}

module.exports = {
    generateLanguageHoverContent
}; 