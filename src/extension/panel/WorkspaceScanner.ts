/**
 * 全局工作区扫描服务
 * 提供带进度反馈的工作区级扫描能力，供 WebView 面板使用
 */
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import type { TextScanner } from '../core/scanner/TextScanner';
import type { I18nMatch, ScanResultItem } from '../core/types';

export interface WorkspaceScanResult {
  filePath: string;
  fileName: string;
  existing: I18nMatch[];
  pending: ScanResultItem[];
}

export interface ScanProgress {
  current: number;
  total: number;
  currentFile: string;
  phase: 'scanning' | 'complete';
}

export class WorkspaceScanner {
  constructor(private scanner: TextScanner) {}

  setScanner(scanner: TextScanner): void {
    this.scanner = scanner;
  }

  async scanWorkspace(
    rootPath: string,
    fileExtensions: string[],
    excludeFiles: string[],
    includeFiles: string[],
    onProgress?: (progress: ScanProgress) => void
  ): Promise<WorkspaceScanResult[]> {
    const files = await this.collectFiles(rootPath, fileExtensions, excludeFiles, includeFiles);
    const results: WorkspaceScanResult[] = [];

    for (let i = 0; i < files.length; i++) {
      const filePath = files[i];
      const fileName = path.basename(filePath);

      onProgress?.({
        current: i + 1,
        total: files.length,
        currentFile: vscode.workspace.asRelativePath(filePath, false),
        phase: 'scanning',
      });

      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const result = this.scanner.scanText(content, filePath);

        if (result.existing.length > 0 || result.pending.length > 0) {
          results.push({
            filePath: vscode.workspace.asRelativePath(filePath, false),
            fileName,
            existing: result.existing,
            pending: result.pending.map((item) => ({
              ...item,
              filePath: vscode.workspace.asRelativePath(item.filePath || filePath, false),
            })),
          });
        }
      } catch {
        // skip unreadable files
      }
    }

    onProgress?.({
      current: files.length,
      total: files.length,
      currentFile: '',
      phase: 'complete',
    });

    return results;
  }

  async scanSingleFile(filePath: string): Promise<WorkspaceScanResult | null> {
    try {
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.join(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '', filePath);

      const content = fs.readFileSync(absolutePath, 'utf8');
      const result = this.scanner.scanText(content, absolutePath);

      if (result.existing.length === 0 && result.pending.length === 0) {
        return null;
      }

      return {
        filePath: vscode.workspace.asRelativePath(absolutePath, false),
        fileName: path.basename(absolutePath),
        existing: result.existing,
        pending: result.pending.map((item) => ({
          ...item,
          filePath: vscode.workspace.asRelativePath(item.filePath || absolutePath, false),
        })),
      };
    } catch {
      return null;
    }
  }

  private async collectFiles(
    rootPath: string,
    extensions: string[],
    excludes: string[],
    includes: string[]
  ): Promise<string[]> {
    if (includes.length > 0) {
      return this.collectFromIncludes(rootPath, includes, extensions);
    }
    return this.walkDirectory(rootPath, extensions, excludes);
  }

  private collectFromIncludes(
    rootPath: string,
    includes: string[],
    extensions: string[]
  ): Promise<string[]> {
    const files: string[] = [];
    for (const include of includes) {
      const fullPath = path.join(rootPath, include);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isFile() && extensions.includes(path.extname(fullPath))) {
          files.push(fullPath);
        } else if (stat.isDirectory()) {
          files.push(...this.walkDirectorySync(fullPath, extensions, []));
        }
      } catch {
        // skip non-existent
      }
    }
    return Promise.resolve(files);
  }

  private async walkDirectory(
    dirPath: string,
    extensions: string[],
    excludes: string[],
    maxDepth = 10,
    depth = 0
  ): Promise<string[]> {
    if (depth > maxDepth) return [];
    return this.walkDirectorySync(dirPath, extensions, excludes, maxDepth, depth);
  }

  private walkDirectorySync(
    dirPath: string,
    extensions: string[],
    excludes: string[],
    maxDepth = 10,
    depth = 0
  ): string[] {
    if (depth > maxDepth) return [];
    const files: string[] = [];

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (excludes.includes(entry.name)) continue;
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          files.push(...this.walkDirectorySync(fullPath, extensions, excludes, maxDepth, depth + 1));
        } else if (entry.isFile() && extensions.includes(path.extname(entry.name))) {
          files.push(fullPath);
        }
      }
    } catch {
      // skip on permission errors
    }

    return files;
  }
}
