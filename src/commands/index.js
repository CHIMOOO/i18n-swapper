const replaceWithI18n = require('./replaceWithI18n');
const batchReplaceWithI18n = require('./batchReplaceWithI18n');
const quickBatchReplace = require('./quickBatchReplace');
const setLocalesPaths = require('./setLocalesPaths');
const openApiTranslationConfig = require('./openApiTranslationConfig');
const { registerOpenLanguageFileCommand } = require('./openLanguageFile');

module.exports = {
  replaceWithI18n,
  batchReplaceWithI18n,
  quickBatchReplace,
  setLocalesPaths,
  openApiTranslationConfig,
  initializeCommands: function(context) {
    registerOpenLanguageFileCommand(context);
  }
}; 