const vscode = require('vscode');

/**
 * 刷新i18n装饰的命令
 * @param {Object} i18nDecorator i18n装饰器实例
 */
function registerRefreshI18nDecorations(context, i18nDecorator) {
    const disposable = vscode.commands.registerCommand('i18n-swapper.refreshI18nDecorations', () => {
        i18nDecorator.loadLocaleData();
        i18nDecorator.loadAllLanguageData(); // 刷新语言
        i18nDecorator.updateDecorations(); // 刷新面板
        
        // vscode.window.showInformationMessage('已刷新i18n装饰，手动返回代码页面激活生效。');
    });
    
    context.subscriptions.push(disposable);
}

module.exports = registerRefreshI18nDecorations; 