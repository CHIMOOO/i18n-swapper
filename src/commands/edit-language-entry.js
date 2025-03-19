const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { updateLanguageFile } = require('../utils/language-file-manager');

/**
 * 编辑特定语言中的国际化条目
 * @param {Object} params 编辑参数
 * @param {string} params.langCode 语言代码
 * @param {string} params.i18nKey 国际化键
 * @param {string} params.filePath 语言文件路径
 * @param {string} params.currentValue 当前值
 */
async function editLanguageEntry(params) {
    try {
        const { langCode, i18nKey, filePath, currentValue = '' } = params;
        
        if (!i18nKey || !filePath) {
            vscode.window.showErrorMessage('缺少必要的参数');
            return;
        }
        
        // 显示输入框让用户编辑值
        const inputOptions = {
            prompt: `编辑 ${i18nKey} (${langCode})`,
            value: currentValue,
            placeHolder: '输入翻译文本'
        };
        
        const newValue = await vscode.window.showInputBox(inputOptions);
        
        // 如果用户取消了输入或没有改变值，就不执行更新
        if (newValue === undefined || newValue === currentValue) {
            return;
        }
        
        // 检查文件是否存在
        if (!fs.existsSync(filePath)) {
            vscode.window.showErrorMessage(`找不到语言文件: ${filePath}`);
            return;
        }
        
        // 更新语言文件
        const success = await updateLanguageFile(filePath, i18nKey, newValue);
        
        if (success) {
            vscode.window.showInformationMessage(`已更新 ${langCode} 中的 "${i18nKey}"`);
        } else {
            vscode.window.showErrorMessage(`无法更新 ${langCode} 中的 "${i18nKey}"`);
        }
    } catch (error) {
        vscode.window.showErrorMessage(`编辑失败: ${error.message}`);
        console.error('编辑语言条目时出错:', error);
    }
}

module.exports = {
    editLanguageEntry
}; 