const vscode = require('vscode');

/**
 * 打开装饰样式设置
 */
function openDecorationsStyleSettings() {
    vscode.commands.executeCommand('workbench.action.openSettings', 'i18n-swapper.suffixStyle');
}

module.exports = openDecorationsStyleSettings; 