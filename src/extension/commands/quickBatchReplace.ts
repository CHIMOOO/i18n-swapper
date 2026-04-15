/**
 * 快速批量替换命令
 * 扫描当前文件 → 显示替换建议 → 逐个/全部接受
 */
import * as vscode from 'vscode';
import { TextScanner } from '../core/scanner/TextScanner';
import { TextReplacer, type ReplaceContext } from '../core/replacer/TextReplacer';
import { ConfigManager } from '../core/config/ConfigManager';
import type { ScanResultItem } from '../core/types';
import { CodeLensManager } from '../editor/CodeLensProvider';
import { HighlightService } from '../editor/HighlightService';

/** 当前文件的待替换列表 */
let pendingReplacements: ScanResultItem[] = [];
let activeCodeLens: CodeLensManager | null = null;
let confirmDecorationType: vscode.TextEditorDecorationType | null = null;

export function getPendingReplacements(): ScanResultItem[] {
  return pendingReplacements;
}

export function createQuickBatchReplaceCommand(
  textScanner: TextScanner,
  textReplacer: TextReplacer,
  configManager: ConfigManager,
  highlightService: HighlightService,
  getRootPath: () => string | undefined
): (...args: unknown[]) => Promise<void> {
  return async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('请先打开一个代码文件');
      return;
    }

    const rootPath = getRootPath();
    if (!rootPath) {
      vscode.window.showWarningMessage('未找到工作区文件夹');
      return;
    }

    const document = editor.document;
    const text = document.getText();
    const filePath = document.uri.fsPath;

    const { pending } = textScanner.scanText(text, filePath);
    const withKeys = pending.filter((item) => item.i18nKey);

    if (withKeys.length === 0) {
      vscode.window.showInformationMessage('当前文件未找到可替换的文本（需要先有对应的 i18n 键）');
      clearBatchState(editor);
      return;
    }

    pendingReplacements = withKeys;
    showConfirmationDecorations(editor, pendingReplacements, configManager);

    vscode.window.showInformationMessage(
      `找到 ${withKeys.length} 处可替换文本`,
      '全部替换',
      '取消'
    ).then((choice) => {
      if (choice === '全部替换') {
        applyAllReplacements(editor, textReplacer, configManager, getRootPath);
      } else if (choice === '取消') {
        clearBatchState(editor);
      }
    });
  };
}

/**
 * 确认单项替换命令
 */
export function createConfirmReplacementCommand(
  textReplacer: TextReplacer,
  configManager: ConfigManager,
  getRootPath: () => string | undefined,
  refreshCallback: () => void
): (...args: unknown[]) => Promise<void> {
  return async (arg: unknown) => {
    const params = arg as { index: number } | undefined;
    if (!params || typeof params.index !== 'number') return;

    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const item = pendingReplacements[params.index];
    if (!item || !item.i18nKey) return;

    const rootPath = getRootPath();
    if (!rootPath) return;

    const ctx: ReplaceContext = {
      functionName: configManager.functionName,
      quoteChar: configManager.quoteChar,
      autoGenerateKeyFromText: false,
      autoGenerateKeyPrefix: '',
      autoTranslateAllLanguages: false,
      languageMappings: [],
      sourceLanguage: configManager.sourceLanguage,
      rootPath,
    };

    const count = await textReplacer.batchReplace(
      editor.document,
      [{ start: item.start, end: item.end, key: item.i18nKey, text: item.text }],
      ctx
    );

    if (count > 0) {
      pendingReplacements.splice(params.index, 1);
      recalculatePositions(editor.document);
      showConfirmationDecorations(editor, pendingReplacements, configManager);
      refreshCallback();

      if (pendingReplacements.length === 0) {
        clearBatchState(editor);
        vscode.window.showInformationMessage('所有替换已完成');
      }
    }
  };
}

/**
 * 取消单项替换命令
 */
export function createCancelReplacementCommand(
  refreshCallback: () => void
): (...args: unknown[]) => Promise<void> {
  return async (arg: unknown) => {
    const params = arg as { index: number } | undefined;
    if (!params || typeof params.index !== 'number') return;

    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    pendingReplacements.splice(params.index, 1);
    showConfirmationDecorations(editor, pendingReplacements, configManager_ref);
    refreshCallback();

    if (pendingReplacements.length === 0) {
      clearBatchState(editor);
    }
  };
}

let configManager_ref: ConfigManager;

export function setConfigManagerRef(cm: ConfigManager): void {
  configManager_ref = cm;
}

/**
 * 全部替换
 */
async function applyAllReplacements(
  editor: vscode.TextEditor,
  textReplacer: TextReplacer,
  configManager: ConfigManager,
  getRootPath: () => string | undefined
): Promise<void> {
  const rootPath = getRootPath();
  if (!rootPath) return;

  const items = pendingReplacements
    .filter((item) => item.i18nKey)
    .map((item) => ({
      start: item.start,
      end: item.end,
      key: item.i18nKey,
      text: item.text,
    }));

  if (items.length === 0) return;

  const ctx: ReplaceContext = {
    functionName: configManager.functionName,
    quoteChar: configManager.quoteChar,
    autoGenerateKeyFromText: false,
    autoGenerateKeyPrefix: '',
    autoTranslateAllLanguages: false,
    languageMappings: [],
    sourceLanguage: configManager.sourceLanguage,
    rootPath,
  };

  const count = await textReplacer.batchReplace(editor.document, items, ctx);
  clearBatchState(editor);
  vscode.window.showInformationMessage(`已完成 ${count} 处替换`);
}

/**
 * 显示确认装饰（行末绿色标签 + CodeLens）
 */
function showConfirmationDecorations(
  editor: vscode.TextEditor,
  items: ScanResultItem[],
  configManager: ConfigManager
): void {
  // 清理旧装饰
  confirmDecorationType?.dispose();
  activeCodeLens?.dispose();

  confirmDecorationType = vscode.window.createTextEditorDecorationType({
    isWholeLine: false,
  });

  const decorations: vscode.DecorationOptions[] = items.map((item, index) => {
    const startPos = editor.document.positionAt(item.start);
    const endPos = editor.document.positionAt(item.end);
    const range = new vscode.Range(startPos, endPos);

    const replacementText = `${configManager.functionName}(${configManager.quoteChar}${item.i18nKey}${configManager.quoteChar})`;

    return {
      range,
      renderOptions: {
        after: {
          contentText: ` → ${replacementText}`,
          backgroundColor: '#008236cc',
          color: '#ffffff',
          borderRadius: '3px',
          margin: '0 0 0 10px',
          padding: '1px 6px',
        },
      },
    };
  });

  editor.setDecorations(confirmDecorationType, decorations);

  activeCodeLens = new CodeLensManager(editor.document, items);
  activeCodeLens.register();
}

/**
 * 替换后重新计算剩余项的位置
 */
function recalculatePositions(document: vscode.TextDocument): void {
  const text = document.getText();
  for (const item of pendingReplacements) {
    const idx = text.indexOf(item.text, Math.max(0, item.start - 50));
    if (idx >= 0) {
      item.start = idx;
      item.end = idx + item.text.length;
    }
  }
}

/**
 * 清理批量替换状态
 */
function clearBatchState(editor: vscode.TextEditor): void {
  pendingReplacements = [];
  confirmDecorationType?.dispose();
  confirmDecorationType = null;
  activeCodeLens?.dispose();
  activeCodeLens = null;
}
