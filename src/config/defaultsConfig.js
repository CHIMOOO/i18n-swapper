/**
 * i18n-swapper 插件默认配置
 * 集中管理所有默认值，避免在代码中分散定义
 */
module.exports = {
    // 基本配置
    decorationStyle: 'suffix',          // 装饰样式: 'suffix' 或 'inline'
    defaultLocale: 'zh-CN',             // 默认语言
    functionName: 't',                  // 国际化函数名称
    quoteType: 'single',                // 引号类型: 'single' 或 'double'
    localesPaths: [],                   // 本地化文件路径
    showFullFormInEditMode: false,      // 编辑模式下是否显示完整形式
    
    // 扫描配置
    scanPatterns: [
        'label', 'value', 'placeholder', 'title', 'message', 'text'
    ],
    
    // 后缀样式
    suffixStyle: {
        color: '#6A9955',
        fontSize: '14px',
        fontWeight: '400',
        fontStyle: 'normal',
        margin: '0 0 0 3px'
    },
    
    // 内联样式
    inlineStyle: {
        color: '#CE9178',
        fontSize: '14px',
        fontWeight: '400',
        fontStyle: 'normal',
        margin: '0'
    },
    
    // 腾讯翻译配置
    tencentTranslation: {
        apiKey: '',
        apiSecret: '',
        region: 'ap-guangzhou',
        sourceLanguage: 'zh',
        languageMappings: []
    },
    
    // 消息文本
    messages: {
        noLocaleConfigured: '未配置源语言文件国际化词库路径（将用于国际化函数预览）',
        selectFile: '选择文件',
        ignoreTemporarily: '暂时忽略',
        workspaceNotFound: '未找到工作区文件夹',
        filesAdded: (count) => `已添加 ${count} 个国际化文件`
    }
}; 