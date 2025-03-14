const vscode = require('vscode');
const path = require('path');

/**
 * 设置国际化文件路径
 */
async function setLocalesPaths() {
    try {
        // 打开文件选择器
        const fileUris = await vscode.window.showOpenDialog({
            canSelectMany: true,
            filters: {
                '国际化文件': ['json', 'js']
            },
            title: '选择国际化文件'
        });

        if (fileUris && fileUris.length > 0) {
            // 转换为相对于工作区的路径
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                vscode.window.showErrorMessage('未找到工作区文件夹');
                return;
            }

            const rootPath = workspaceFolders[0].uri.fsPath;
            const relativePaths = fileUris.map(uri => {
                const filePath = uri.fsPath;
                return path.relative(rootPath, filePath).replace(/\\/g, '/');
            });

            // 更新配置
            const config = vscode.workspace.getConfiguration('i18n-swapper');
            await config.update('localesPaths', relativePaths, vscode.ConfigurationTarget.Workspace);

            vscode.window.showInformationMessage(`已设置 ${relativePaths.length} 个国际化文件路径`);
        }
    } catch (error) {
        console.error('设置国际化文件路径时出错:', error);
        vscode.window.showErrorMessage(`设置出错: ${error.message}`);
    }
}

module.exports = setLocalesPaths;