const vscode = require('vscode');

/**
 * 管理功能提示的显示和用户选择
 * 确保每个功能提示只向用户显示一次
 */
class PromptManager {
    /**
     * 检查并处理功能提示
     * @param {string} featureKey - 功能的唯一标识符
     * @param {Object} options - 提示选项
     * @param {string} options.title - 提示标题
     * @param {string} options.message - 提示消息
     * @param {Array<string>} options.items - 提示选项
     * @param {boolean} options.modal - 是否为模态对话框
     * @param {Object} options.config - 配置对象，如果提供则自动保存用户选择
     * @param {string} options.configKey - 配置键名
     * @returns {Promise<{choice: string, value: any}>} 用户选择的选项和对应的值
     */
    static async checkAndPrompt(featureKey, options) {
        const config = vscode.workspace.getConfiguration('i18n-swapper');
        let skipPromptList = config.get('SkipPrompt', []);
        
        // 如果用户已确认过此功能，则直接返回当前配置
        if (skipPromptList.includes(featureKey)) {
            return {
                choice: null,
                value: options.config ? config.get(options.configKey) : null
            };
        }
        
        // 准备提示选项
        const items = options.items.map(item => 
            typeof item === 'string' ? item : item.label || item.title
        );
        
        // 显示提示
        const result = await vscode.window.showInformationMessage(
            options.message,
            { modal: options.modal || false },
            ...items
        );
        
        // 处理用户选择
        let value = null;
        
        if (result) {
            // 找到用户选择的选项
            const selectedIndex = items.findIndex(item => item === result);
            const selectedOption = options.items[selectedIndex];
            
            // 如果提供了配置信息，则更新配置
            if (options.config && options.configKey) {
                value = typeof selectedOption === 'object' && 'value' in selectedOption 
                    ? selectedOption.value 
                    : selectedIndex === 0; // 默认第一个选项为true，第二个为false
                
                // 更新配置
                await config.update(options.configKey, value, vscode.ConfigurationTarget.Workspace);
            } else {
                value = selectedOption;
            }
            
            // 记住用户的选择，不再显示此提示
            skipPromptList.push(featureKey);
            await config.update('SkipPrompt', skipPromptList, vscode.ConfigurationTarget.Workspace);
        }
        
        return {
            choice: result,
            value: value
        };
    }
    
    /**
     * 检查并提示用户是否使用翻译API生成有意义的键名
     * @returns {Promise<boolean>} 用户是否选择使用翻译API
     */
    static async promptForKeyGeneration() {
        const result = await this.checkAndPrompt('autoGenerateKeyFromText', {
            message: '源语言库中未找到对应的值\n\n是否使用翻译API生成有意义的键名？\n\n本次操作将被保存配置，后续可在[右键菜单打开面板] → [配置设置] → [5、翻译功能设置]中修改此选项',
            modal: true,
            items: [
                { title: '使用翻译生成', value: true },
                { title: '使用简单键名', value: false }
            ],
            config: vscode.workspace.getConfiguration('i18n-swapper'),
            configKey: 'autoGenerateKeyFromText'
        });
        
        return result.value;
    }
    
    /**
     * 检查并提示用户是否自动翻译并保存到所有语言文件
     * @returns {Promise<boolean>} 用户是否选择自动翻译到所有语言
     */
    static async promptForAutoTranslate() {
        const result = await this.checkAndPrompt('autoTranslateAllLanguages', {
            message: '是否自动翻译并保存到[所有语言]文件？\n\n该操作需要在API翻译配置中添加语言映射\n\n本次操作将被保存配置，后续可在[右键菜单打开面板] → [配置设置] → [5、翻译功能设置]中修改此选项',
            modal: true,
            items: [
                { title: '翻译到所有语言', value: true },
                { title: '仅保存源语言', value: false }
            ],
            config: vscode.workspace.getConfiguration('i18n-swapper'),
            configKey: 'autoTranslateAllLanguages'
        });
        
        return result.value;
    }
}

module.exports = PromptManager; 