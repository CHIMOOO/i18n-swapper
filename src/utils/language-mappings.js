/**
 * 支持的语言映射配置
 * 每种源语言支持翻译到哪些目标语言
 */
const SUPPORTED_LANGUAGE_MAPPINGS = {
  'zh': ['en', 'ja', 'ko', 'fr', 'es', 'it', 'de', 'tr', 'ru', 'pt', 'vi', 'id', 'th', 'ms', 'ar'],
  'zh-TW': ['en', 'ja', 'ko', 'fr', 'es', 'it', 'de', 'tr', 'ru', 'pt', 'vi', 'id', 'th', 'ms', 'ar'],
  'en': ['zh', 'zh-TW', 'ja', 'ko', 'fr', 'es', 'it', 'de', 'tr', 'ru', 'pt', 'vi', 'id', 'th', 'ms', 'ar', 'hi'],
  'ja': ['zh', 'zh-TW', 'en', 'ko'],
  'ko': ['zh', 'zh-TW', 'en', 'ja'],
  'fr': ['zh', 'zh-TW', 'en', 'es', 'it', 'de', 'tr', 'ru', 'pt'],
  'es': ['zh', 'zh-TW', 'en', 'fr', 'it', 'de', 'tr', 'ru', 'pt'],
  'it': ['zh', 'zh-TW', 'en', 'fr', 'es', 'de', 'tr', 'ru', 'pt'],
  'de': ['zh', 'zh-TW', 'en', 'fr', 'es', 'it', 'tr', 'ru', 'pt'],
  'tr': ['zh', 'zh-TW', 'en', 'fr', 'es', 'it', 'de', 'ru', 'pt'],
  'ru': ['zh', 'zh-TW', 'en', 'fr', 'es', 'it', 'de', 'tr', 'pt'],
  'pt': ['zh', 'zh-TW', 'en', 'fr', 'es', 'it', 'de', 'tr', 'ru'],
  'vi': ['zh', 'zh-TW', 'en'],
  'id': ['zh', 'zh-TW', 'en'],
  'th': ['zh', 'zh-TW', 'en'],
  'ms': ['zh', 'zh-TW', 'en'],
  'ar': ['zh', 'zh-TW', 'en'],
  'hi': ['en']
};

/**
 * 语言代码到名称的映射
 */
const LANGUAGE_NAMES = {
  'zh': '简体中文',
  'zh-TW': '繁体中文',
  'en': '英语',
  'ja': '日语',
  'ko': '韩语',
  'fr': '法语',
  'es': '西班牙语',
  'it': '意大利语',
  'de': '德语',
  'tr': '土耳其语',
  'ru': '俄语',
  'pt': '葡萄牙语',
  'vi': '越南语',
  'id': '印尼语',
  'th': '泰语',
  'ms': '马来语',
  'ar': '阿拉伯语',
  'hi': '印地语'
};

module.exports = {
  SUPPORTED_LANGUAGE_MAPPINGS,
  LANGUAGE_NAMES
}; 