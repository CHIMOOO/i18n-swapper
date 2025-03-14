const i18nHelper = require('./i18n-helper');
const textAnalyzer = require('./text-analyzer');
const textReplacer = require('./text-replacer');

module.exports = {
  ...i18nHelper,
  ...textAnalyzer,
  ...textReplacer
}; 