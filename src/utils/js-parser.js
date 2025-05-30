const fs = require('fs');

/**
 * 解析JS文件内容，支持多种导出格式
 * @param {string} filePath JS文件路径
 * @returns {Object|null} 解析后的对象或null
 */
function parseJsFile(filePath) {
    try {
        // 读取文件内容
        const fileContent = fs.readFileSync(filePath, 'utf8');
        let data = null;
        
        // 检查导出格式
        if (fileContent.includes('export default')) {
            // 提取 export default {...} 的内容 - 使用平衡括号匹配方法
            let exportContent = '';
            const exportMatch = fileContent.match(/export\s+default\s*(\{)/);
            
            if (exportMatch) {
                const startIndex = exportMatch.index + exportMatch[0].length - 1; // 第一个左花括号的位置
                let braceCount = 1; // 已找到一个左花括号
                let i = startIndex + 1;
                
                // 遍历查找匹配的右花括号
                while (i < fileContent.length && braceCount > 0) {
                    if (fileContent[i] === '{') braceCount++;
                    else if (fileContent[i] === '}') braceCount--;
                    i++;
                }
                
                if (braceCount === 0) {
                    // 提取完整的对象内容，包括最外层的花括号
                    exportContent = fileContent.substring(startIndex, i);
                    
                    try {
                        // 使用安全的对象计算方式
                        try {
                            // 避免生成带尾部逗号的对象
                            const jsCode = `(${exportContent.replace(/,(\s*[}\]])/g, '$1')})`;
                            data = eval(jsCode);
                        } catch (e) {
                            console.error(`直接解析对象失败, 尝试后备方案: ${e.message}`);
                            // 如果直接解析失败，使用更激进的方法，移除尾随逗号并确保属性名有引号
                            const jsonText = exportContent
                                .replace(/\/\/.*?(\r?\n|$)/g, '$1') // 移除单行注释
                                .replace(/\/\*[\s\S]*?\*\//g, '') // 移除多行注释
                                .replace(/,(\s*[}\]])/g, '$1') // 修复尾随逗号
                                .trim();
                            
                            // 将无引号的属性名添加引号
                            const withQuotedProps = jsonText.replace(/([{,]\s*)([a-zA-Z0-9_$]+)\s*:/g, '$1"$2":');
                            
                            // 检查并修复不完整的JSON对象
                            let fixedJson = withQuotedProps;
                            // 计算左右花括号数量
                            const leftBraces = (fixedJson.match(/{/g) || []).length;
                            const rightBraces = (fixedJson.match(/}/g) || []).length;
                            
                            // 如果左右花括号数量不匹配，添加缺少的右花括号
                            if (leftBraces > rightBraces) {
                                const missingBraces = leftBraces - rightBraces;
                                fixedJson += '}'.repeat(missingBraces);
                                console.log(`修复了不完整的JSON对象，添加了${missingBraces}个右花括号`);
                            }
                            
                            try {
                                data = JSON.parse(fixedJson);
                            } catch (jsonError) {
                                console.error(`JSON解析失败，尝试最后的修复方法: ${jsonError.message}`);
                                // 最后的尝试：使用Function构造函数创建一个安全的求值环境
                                try {
                                    const safeEval = new Function('return ' + exportContent + ';');
                                    data = safeEval();
                                } catch (finalError) {
                                    console.error(`所有解析方法均失败: ${finalError.message}`);
                                    data = {};
                                }
                            }
                        }
                    } catch (parseError) {
                        console.error(`解析export default对象失败: ${parseError.message}`);
                        return {};
                    }
                }
            }
        } else if (fileContent.match(/export\s+(const|let|var)/)) {
            // 处理命名导出的情况
            const match = fileContent.match(/export\s+(const|let|var)\s+(\w+)\s*=\s*(\{[\s\S]*?\}\s*;?)/);
            if (match && match[3]) {
                try {
                    try {
                        const jsCode = `(${match[3].replace(/,(\s*[}\]])/g, '$1')})`;
                        data = eval(jsCode);
                    } catch (e) {
                        console.error(`直接解析命名导出对象失败, 尝试后备方案: ${e.message}`);
                        const jsonText = match[3]
                            .replace(/\/\/.*?(\r?\n|$)/g, '$1')
                            .replace(/\/\*[\s\S]*?\*\//g, '')
                            .replace(/,(\s*[}\]])/g, '$1')
                            .trim();
                        
                        const withQuotedProps = jsonText.replace(/([{,]\s*)([a-zA-Z0-9_$]+)\s*:/g, '$1"$2":');
                        
                        // 检查并修复不完整的JSON对象
                        let fixedJson = withQuotedProps;
                        // 计算左右花括号数量
                        const leftBraces = (fixedJson.match(/{/g) || []).length;
                        const rightBraces = (fixedJson.match(/}/g) || []).length;
                        
                        // 如果左右花括号数量不匹配，添加缺少的右花括号
                        if (leftBraces > rightBraces) {
                            const missingBraces = leftBraces - rightBraces;
                            fixedJson += '}'.repeat(missingBraces);
                            console.log(`修复了不完整的JSON对象，添加了${missingBraces}个右花括号`);
                        }
                        
                        try {
                            data = JSON.parse(fixedJson);
                        } catch (jsonError) {
                            console.error(`JSON解析失败，尝试最后的修复方法: ${jsonError.message}`);
                            // 最后的尝试：使用Function构造函数创建一个安全的求值环境
                            try {
                                const safeEval = new Function('return ' + match[3] + ';');
                                data = safeEval();
                            } catch (finalError) {
                                console.error(`所有解析方法均失败: ${finalError.message}`);
                                data = {};
                            }
                        }
                    }
                } catch (evalError) {
                    console.error(`解析命名导出对象失败: ${evalError.message}`);
                    data = {};
                }
            } else {
                console.warn('无法匹配export语法，将使用空对象');
                data = {};
            }
        } else {
            // 尝试使用 require
            try {
                // 清除require缓存
                delete require.cache[require.resolve(filePath)];
                data = require(filePath);
            } catch (moduleError) {
                console.error(`加载JS模块失败: ${moduleError.message}`);
                // 尝试用正则解析 module.exports
                const match = fileContent.match(/module\.exports\s*=\s*(\{[\s\S]*?\}\s*;?)/);
                if (match && match[1]) {
                    try {
                        try {
                            const jsCode = `(${match[1].replace(/,(\s*[}\]])/g, '$1')})`;
                            data = eval(jsCode);
                        } catch (e) {
                            console.error(`直接解析module.exports对象失败, 尝试后备方案: ${e.message}`);
                            const jsonText = match[1]
                                .replace(/\/\/.*?(\r?\n|$)/g, '$1')
                                .replace(/\/\*[\s\S]*?\*\//g, '')
                                .replace(/,(\s*[}\]])/g, '$1')
                                .trim();
                            
                            const withQuotedProps = jsonText.replace(/([{,]\s*)([a-zA-Z0-9_$]+)\s*:/g, '$1"$2":');
                            
                            // 检查并修复不完整的JSON对象
                            let fixedJson = withQuotedProps;
                            // 计算左右花括号数量
                            const leftBraces = (fixedJson.match(/{/g) || []).length;
                            const rightBraces = (fixedJson.match(/}/g) || []).length;
                            
                            // 如果左右花括号数量不匹配，添加缺少的右花括号
                            if (leftBraces > rightBraces) {
                                const missingBraces = leftBraces - rightBraces;
                                fixedJson += '}'.repeat(missingBraces);
                                console.log(`修复了不完整的JSON对象，添加了${missingBraces}个右花括号`);
                            }
                            
                            try {
                                data = JSON.parse(fixedJson);
                            } catch (jsonError) {
                                console.error(`JSON解析失败，尝试最后的修复方法: ${jsonError.message}`);
                                // 最后的尝试：使用Function构造函数创建一个安全的求值环境
                                try {
                                    const safeEval = new Function('return ' + match[1] + ';');
                                    data = safeEval();
                                } catch (finalError) {
                                    console.error(`所有解析方法均失败: ${finalError.message}`);
                                    data = {};
                                }
                            }
                        }
                    } catch (evalError) {
                        console.error(`解析module.exports对象失败: ${evalError.message}`);
                        data = {};
                    }
                } else {
                    data = {};
                }
            }
        }
        
        return data || {};
    } catch (error) {
        console.error(`解析JS文件失败: ${error.message}`);
        return {};
    }
}

module.exports = {
    parseJsFile
}; 