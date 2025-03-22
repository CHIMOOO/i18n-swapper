const vscode = require('vscode');
const {
    LANGUAGE_NAMES
} = require('./language-mappings');

/**
 * HTML转义函数，防止特殊字符造成渲染问题
 * @param {string} str 需要转义的字符串
 * @returns {string} 转义后的字符串
 */
function escapeHtml(str) {
    if (typeof str !== 'string') {
        return '';
    }
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * 从指定语言中获取源文本
 * @param {string} i18nKey 国际化键
 * @param {Object} allLanguageData 所有语言数据
 * @param {string} sourceLanguageCode 源语言代码
 * @returns {string} 源语言文本
 */
function getSourceText(i18nKey, allLanguageData, sourceLanguageCode) {
    if (!i18nKey || !allLanguageData || !sourceLanguageCode) {
        return '';
    }

    // 确保源语言数据存在
    if (!allLanguageData[sourceLanguageCode]) {
        return '';
    }

    // 获取源语言的值
    const keyPath = i18nKey.split('.');
    let value = allLanguageData[sourceLanguageCode];

    for (const key of keyPath) {
        if (value && typeof value === 'object' && key in value) {
            value = value[key];
        } else {
            return '';
        }
    }

    return typeof value === 'string' ? value : '';
}

/**
 * 生成多语言悬浮显示内容（HTML格式）
 * @param {Object} params - 生成参数
 * @param {Object} params.allLanguageData - 所有语言的数据映射表
 * @param {Array} params.languageMappings - 语言映射配置
 * @param {String} params.i18nKey - 国际化键
 * @param {Number} params.index - 替换项索引
 * @param {Boolean} params.showActions - 是否显示操作按钮
 * @param {Boolean} params.useHideHoverCommand - 是否使用隐藏悬浮的命令
 * @returns {vscode.MarkdownString} MarkdownString对象（包含HTML内容）
 */
function generateLanguageHoverContent(params) {
    const config = vscode.workspace.getConfiguration('i18n-swapper');
    const {
        allLanguageData,
        languageMappings,
        i18nKey,
        index,
        showActions = true,
        useHideHoverCommand = false
    } = params;

    // CSS样式
    // const styles = `
    //     <style>

    //     </style>
    // `;

    // 构建HTML内容
    let htmlContent = `<div>`;

    // 添加操作按钮
    if (showActions) {
        const confirmCommand = useHideHoverCommand ?
            'i18n-swapper.confirmReplacementAndHideHover' :
            'i18n-swapper.confirmReplacement';

        const cancelCommand = useHideHoverCommand ?
            'i18n-swapper.cancelReplacementAndHideHover' :
            'i18n-swapper.cancelReplacement';

        const confirmParams = encodeURIComponent(JSON.stringify({
            index
        }));
        const cancelParams = encodeURIComponent(JSON.stringify({
            index
        }));

        htmlContent += `
            <div>
                <a href="command:${confirmCommand}?${confirmParams}">✅ 接受此替换</a>
                <a href="command:${cancelCommand}?${cancelParams}">❌ 取消此替换</a>
            </div>
        `;
    }

    // 如果有i18nKey，添加标题
    if (i18nKey) {
        htmlContent += `<div>国际化键: <code>${escapeHtml(i18nKey)}</code></div>`;
    }

    // 添加语言值部分
    htmlContent += `<table>
        <thead>
            <tr>
                <th align="right"></th>
                <th></th>
                <th></th>
                <th></th>
            </tr>
        </thead>
        <tbody>`;

    let languageRowsHtml = '';

    if (i18nKey) {
        const keyPath = i18nKey.split('.');

        // 获取源语言代码和文本
        const sourceLanguageCode = config.get('tencentTranslation.sourceLanguage', 'zh');
        const sourceText = getSourceText(i18nKey, allLanguageData, sourceLanguageCode);

        // 获取所有配置的语言，确保即使没有值也显示语言
        Object.keys(allLanguageData).forEach(langCode => {
            // 获取语言显示名称
            const langName = `${LANGUAGE_NAMES[langCode]}[${langCode}]` || langCode;

            if (!allLanguageData[langCode]) {
                // 语言文件不存在
                languageRowsHtml += `
                    <tr>
                        <td align="right">${escapeHtml(langName)}</td>
                        <td colspan="2"><em>文件未找到</em></td>
                    </tr>
                `;
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

            // 格式化值显示
            let valueDisplay = '';
            if (found && value !== undefined) {
                valueDisplay = typeof value === 'object' ?
                    escapeHtml(JSON.stringify(value)) :
                    escapeHtml(String(value));
            } else {
                valueDisplay = '<em></em>';
            }

            // 构建语言行HTML
            const mappingObj = languageMappings.find(m => m.languageCode === langCode);

            if (mappingObj && mappingObj.filePath) {
                // 创建参数对象
                const openFileParams = encodeURIComponent(JSON.stringify({
                    filePath: mappingObj.filePath,
                    langCode: langCode,
                    i18nKey: i18nKey,
                    shouldLocateKey: found
                }));

                // 语言名称单元格（带链接）
                let langNameCell = `
                    <td align="right">
                        <a href="command:i18n-swapper.openLanguageFile?${openFileParams}">
                            <strong>${escapeHtml(langName)}</strong>
                        </a>
                    </td>
                     <td></td>
                `;

                // 语言值单元格
                let langValueCell = `<td>${valueDisplay}</td>`;

                // 操作按钮单元格（可能包含翻译按钮）
                let actionCell = '<td>';
                // 添加编辑按钮，无论是什么语言都允许编辑
                const editParams = encodeURIComponent(JSON.stringify({
                    langCode: langCode,
                    i18nKey: i18nKey,
                    filePath: mappingObj.filePath,
                    currentValue: typeof value === 'string' ? value : ''
                }));
                // 只有源语言文本存在且不是当前语言时才添加翻译按钮
                if (sourceText && mappingObj.languageCode !== sourceLanguageCode) {
                    const translateParams = encodeURIComponent(JSON.stringify({
                        text: sourceText,
                        targetLang: langCode,
                        i18nKey: i18nKey,
                        filePath: mappingObj.filePath
                    }));

                    actionCell += `
                        <a href="command:i18n-swapper.translateText?${translateParams}" 
                           title="翻译">🌏</a><a href="command:i18n-swapper.editLanguageEntry?${editParams}" 
                       title="编辑此翻译">✏️</a>
                    `;
                } else {
                    actionCell += `&nbsp;&nbsp;&nbsp;&nbsp;
                        <a href="command:i18n-swapper.editLanguageEntry?${editParams}" 
                       title="编辑此翻译">✏️</a>
                    `;
                }




                actionCell += `</td>`;


                // 添加完整的表格行
                languageRowsHtml += `<tr>${langNameCell}${langValueCell}${actionCell}</tr>`;
            } else {
                // 没有映射对象的简单行
                languageRowsHtml += `
                    <tr>
                        <td align="right">${escapeHtml(langName)}</td>
                         <td></td>
                        <td>${valueDisplay}</td>
                        <td></td>
                    </tr>
                `;
            }
        });
    }

    // 如果没有配置任何语言
    if (!languageRowsHtml) {
        languageRowsHtml = `
            <tr>
                <td colspan="3"><em>未配置其他语言</em></td>
            </tr>
        `;
    }
    const sourceLanguageCode = config.get('tencentTranslation.sourceLanguage', 'zh');
    const sourceText = getSourceText(i18nKey, allLanguageData, sourceLanguageCode);
    // 添加底部按钮
    languageRowsHtml += `
        <tr>
            <td>
            <a title="翻译到所有语言" href="command:i18n-swapper.translateHover?${encodeURIComponent(JSON.stringify({ text: sourceText, key: i18nKey }))}">✨翻译</a></td>
            <td></td>
            <td></td>
            <td>
                <a href="command:i18n-swapper.openApiTranslationConfig">配置翻译API</a>
            </td>
        </tr>
    `;
    htmlContent += languageRowsHtml;
    htmlContent += `</tbody></table>`;



    htmlContent += `</div>`;

    // 获取源语言代码和文本


    // 在HTML内容的最后，修改翻译按钮，传递正确的参数
    // 替换现有的翻译按钮代码


    // 创建MarkdownString对象
    const markdownContent = new vscode.MarkdownString(htmlContent);
    markdownContent.isTrusted = true;
    markdownContent.supportHtml = true;

    return markdownContent;
}

module.exports = {
    generateLanguageHoverContent
};