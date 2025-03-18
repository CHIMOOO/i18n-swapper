 const vscode = require('vscode');
 const BatchReplacementPanel = require('../panels/BatchReplacementPanel');
 const utils = require('../utils');

 /**
  * 批量替换国际化
  * @param {vscode.ExtensionContext} context 扩展上下文
  */
 async function batchReplaceWithI18n(context) {
     const editor = vscode.window.activeTextEditor;
     if (!editor) {
         vscode.window.showInformationMessage('没有打开的编辑器');
         return;
     }

     // 创建批量替换面板
     const panel = new BatchReplacementPanel(context);
     panel.createOrShow();
 }

 module.exports = batchReplaceWithI18n;