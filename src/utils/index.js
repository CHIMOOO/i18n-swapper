const i18nHelper = require('./i18n-helper');
const textAnalyzer = require('./text-analyzer');
const textReplacer = require('./text-replacer');
const PromptManager = require('./prompt-manager');

const vscode = require('vscode');


function findI18nCalls(text, functionName = 't') {
  // 修改正则表达式以匹配任意引号
  const regex = new RegExp(
    `(\\$?\\b${functionName}\\b)\\s*\\(\\s*(['"])([^'"]+)\\2\\s*\\)`,
    'g'
  );
  // ...其余代码
}



module.exports = {
  ...i18nHelper,
  ...textAnalyzer,
  ...textReplacer,
  PromptManager,
}; 