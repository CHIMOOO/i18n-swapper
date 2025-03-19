const fs = require('fs').promises;
const path = require('path');

/**
 * 更新语言文件中的特定键值
 * @param {string} filePath 语言文件路径
 * @param {string} i18nKey 国际化键（可以是嵌套键，如 'common.buttons.save'）
 * @param {string} newValue 新的翻译值
 * @returns {Promise<boolean>} 操作是否成功
 */
async function updateLanguageFile(filePath, i18nKey, newValue) {
    try {
        // 读取文件内容
        const fileContent = await fs.readFile(filePath, 'utf8');
        
        // 解析JSON内容
        let jsonData;
        try {
            jsonData = JSON.parse(fileContent);
        } catch (parseError) {
            console.error('无法解析JSON文件:', parseError);
            return false;
        }
        
        // 拆分键路径
        const keyParts = i18nKey.split('.');
        
        // 递归设置嵌套对象的值
        let current = jsonData;
        for (let i = 0; i < keyParts.length - 1; i++) {
            const part = keyParts[i];
            
            // 如果路径中的对象不存在，创建它
            if (!current[part] || typeof current[part] !== 'object') {
                current[part] = {};
            }
            
            current = current[part];
        }
        
        // 设置最终键的值
        const lastKey = keyParts[keyParts.length - 1];
        current[lastKey] = newValue;
        
        // 格式化JSON（使用2个空格缩进）
        const formattedJson = JSON.stringify(jsonData, null, 2);
        
        // 写回文件
        await fs.writeFile(filePath, formattedJson, 'utf8');
        
        return true;
    } catch (error) {
        console.error('更新语言文件时出错:', error);
        return false;
    }
}

module.exports = {
    updateLanguageFile
}; 