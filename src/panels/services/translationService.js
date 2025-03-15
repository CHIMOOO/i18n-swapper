const vscode = require('vscode');
const crypto = require('crypto');
const https = require('https');
const { LANGUAGE_NAMES } = require('../../utils/language-mappings');

/**
 * 从文本生成键名
 * @param {string} text 原文本
 * @returns {string} 生成的键名
 */
function generateKeyFromText(text) {
  if (!text) return '';
  
  // 移除标点符号和特殊字符
  let key = text
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, ' ')  // 保留中文、英文和数字
    .replace(/\s+/g, ' ')                        // 合并空格
    .trim();
  
  // 限制长度
  if (key.length > 20) {
    key = key.substring(0, 20);
  }
  
  // 如果是纯中文，提取首字母作为键名
  if (/^[\u4e00-\u9fa5]+$/.test(key)) {
    const pinyinKey = key
      .split('')
      .map(char => char.charAt(0))
      .join('');
    return pinyinKey;
  }
  
  // 驼峰命名
  return key
    .split(' ')
    .map((word, index) => {
      if (!word) return '';
      return index === 0 
        ? word.toLowerCase() 
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join('');
}

/**
 * 调用腾讯云翻译API
 * @param {string} text 要翻译的文本
 * @param {string} sourceLanguage 源语言
 * @param {string} targetLanguage 目标语言
 * @param {string} secretId API密钥ID
 * @param {string} secretKey API密钥
 * @param {string} region 区域
 * @returns {Promise<string>} 翻译结果
 */
async function translateText(text, sourceLanguage, targetLanguage, secretId, secretKey, region) {
  return new Promise((resolve, reject) => {
    try {
      const endpoint = 'tmt.tencentcloudapi.com';
      const service = 'tmt';
      const action = 'TextTranslate';
      const version = '2018-03-21';
      const timestamp = Math.round(new Date().getTime() / 1000);

      // 请求参数
      const requestParams = {
        SourceText: text,
        Source: sourceLanguage,
        Target: targetLanguage,
        ProjectId: 0
      };

      console.log(`[API请求] 参数:`, requestParams);

      // 参数签名
      const requestParamString = JSON.stringify(requestParams);

      // 生成签名所需参数
      const hashedRequestPayload = crypto
        .createHash('sha256')
        .update(requestParamString)
        .digest('hex');

      const canonicalRequest = [
        'POST',
        '/',
        '',
        'content-type:application/json; charset=utf-8',
        'host:' + endpoint,
        '',
        'content-type;host',
        hashedRequestPayload
      ].join('\n');

      const date = new Date(timestamp * 1000).toISOString().split('T')[0];
      const stringToSign = [
        'TC3-HMAC-SHA256',
        timestamp,
        `${date}/${service}/tc3_request`,
        crypto
          .createHash('sha256')
          .update(canonicalRequest)
          .digest('hex')
      ].join('\n');

      // 计算签名
      const secretDate = crypto
        .createHmac('sha256', 'TC3' + secretKey)
        .update(date)
        .digest();

      const secretService = crypto
        .createHmac('sha256', secretDate)
        .update(service)
        .digest();

      const secretSigning = crypto
        .createHmac('sha256', secretService)
        .update('tc3_request')
        .digest();

      const signature = crypto
        .createHmac('sha256', secretSigning)
        .update(stringToSign)
        .digest('hex');

      // 构造授权信息
      const authorization =
        'TC3-HMAC-SHA256 ' +
        `Credential=${secretId}/${date}/${service}/tc3_request, ` +
        'SignedHeaders=content-type;host, ' +
        `Signature=${signature}`;

      const options = {
        hostname: endpoint,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Host': endpoint,
          'Authorization': authorization,
          'X-TC-Action': action,
          'X-TC-Timestamp': timestamp.toString(),
          'X-TC-Version': version,
          'X-TC-Region': region
        }
      };

      const req = https.request(options, (res) => {
        const chunks = [];
        
        res.on('data', (chunk) => {
          chunks.push(chunk);
        });
        
        res.on('end', () => {
          const responseBody = Buffer.concat(chunks).toString();
          
          try {
            const parsed = JSON.parse(responseBody);
            
            if (parsed.Response && parsed.Response.Error) {
              reject(new Error(
                `API错误: ${parsed.Response.Error.Code} - ${parsed.Response.Error.Message}`
              ));
              return;
            }
            
            if (parsed.Response && parsed.Response.TargetText) {
              resolve(parsed.Response.TargetText);
            } else {
              reject(new Error('API返回结果缺少翻译文本'));
            }
          } catch (error) {
            reject(new Error(`解析API响应出错: ${error.message}`));
          }
        });
      });
      
      req.on('error', (error) => {
        reject(new Error(`发送请求出错: ${error.message}`));
      });
      
      req.write(requestParamString);
      req.end();
    } catch (error) {
      reject(new Error(`准备翻译请求出错: ${error.message}`));
    }
  });
}

/**
 * 获取语言名称
 * @param {string} code 语言代码
 * @returns {string} 语言名称
 */
function getLanguageName(code) {
  return LANGUAGE_NAMES[code] || code;
}

module.exports = {
  generateKeyFromText,
  translateText,
  getLanguageName
}; 