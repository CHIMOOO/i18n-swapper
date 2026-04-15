/**
 * 单体替换命令
 * 选中文本 → 查找/生成 i18n 键 → 替换为 t('key') 调用
 */
import * as vscode from 'vscode';
import { TextReplacer, type ReplaceContext } from '../core/replacer/TextReplacer';
import { ConfigManager } from '../core/config/ConfigManager';

export function createReplaceWithI18nCommand(
  textReplacer: TextReplacer,
  configManager: ConfigManager,
  getRootPath: () => string | undefined
): (...args: unknown[]) => Promise<void> {
  return async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('请先打开一个代码文件');
      return;
    }

    const selection = editor.selection;
    if (selection.isEmpty) {
      vscode.window.showWarningMessage('请先选中需要替换的文本');
      return;
    }

    const rootPath = getRootPath();
    if (!rootPath) {
      vscode.window.showWarningMessage('未找到工作区文件夹');
      return;
    }

    const ctx: ReplaceContext = {
      functionName: configManager.functionName,
      quoteChar: configManager.quoteChar,
      autoGenerateKeyFromText: configManager.autoGenerateKeyFromText,
      autoGenerateKeyPrefix: configManager.autoGenerateKeyPrefix,
      autoTranslateAllLanguages: configManager.autoTranslateAllLanguages,
      languageMappings: configManager.languageMappings,
      sourceLanguage: configManager.sourceLanguage,
      rootPath,
    };

    await textReplacer.replaceText(editor, selection, ctx);
  };
}
