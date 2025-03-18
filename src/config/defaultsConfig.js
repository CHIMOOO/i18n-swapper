/**
 * i18n-swapper 插件默认配置
 * 集中管理所有默认值，避免在代码中分散定义
 */
module.exports = {
    // 基本配置
    decorationStyle: 'inline', // 装饰样式: 'suffix' 或 'inline'
    defaultLocale: 'zh-CN',             // 默认语言
    functionName: 't',                  // 输出国际化函数名称
    IdentifyTheCurrentName: ['t', '$t'], // 识别当前页面上的国际化函数方法
    quoteType: 'single',                // 引号类型: 'single' 或 'double'
    localesPaths: [],                   // 本地化文件路径
    showFullFormInEditMode: true,      // 编辑模式下是否显示完整形式
    
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
    },
    
    // 自动生成键名配置
    autoGenerateKeyFromText: true, // 默认开启自动生成键名功能
    autoTranslateAllLanguages: true, // 默认开启自动翻译所有语言功能
    autoGenerateKeyPrefix: '_iw', // 自动生成键名的前缀
    missingKeyBorderWidth: '0 0 2px 0',
    missingKeyBorderStyle: 'solid',
    missingKeyBorderColor: '#ff6900',
    missingKeyBorderSpacing: '2px',
}; 