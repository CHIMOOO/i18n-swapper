<script setup lang="ts">
import { ref } from 'vue';
import { useScanStore, type FileScanResult } from '../stores/scanStore';

const scanStore = useScanStore();
const expandedFiles = ref<Set<string>>(new Set());

function toggleFile(filePath: string) {
  if (expandedFiles.value.has(filePath)) {
    expandedFiles.value.delete(filePath);
  } else {
    expandedFiles.value.add(filePath);
  }
}

function isExpanded(filePath: string) {
  return expandedFiles.value.has(filePath);
}

function getFileIndex(filePath: string) {
  return scanStore.scanResults.findIndex((r) => r.filePath === filePath);
}

function handleReplace(filePath: string, item: FileScanResult['pending'][0]) {
  scanStore.replaceItem(filePath, item);
}

function handleBatchReplace(filePath: string, items: FileScanResult['pending']) {
  scanStore.batchReplace(filePath, items);
}

function handleLocate(filePath: string, item: FileScanResult['pending'][0]) {
  scanStore.highlightText(filePath, item.start, item.end);
}

function handleSelectAll(fileIndex: number, checked: boolean) {
  scanStore.selectAllInFile(fileIndex, checked);
}

function isAllSelected(file: FileScanResult) {
  return file.pending.length > 0 && file.pending.every((p) => p.selected);
}

function selectedCount(file: FileScanResult) {
  return file.pending.filter((p) => p.selected).length;
}
</script>

<template>
  <div class="flex-1 overflow-y-auto">
    <!-- 空状态 -->
    <div
      v-if="scanStore.filteredResults.length === 0 && !scanStore.scanning"
      class="flex flex-col items-center justify-center py-12 opacity-50"
    >
      <p class="text-sm mb-2">暂无扫描结果</p>
      <p class="text-xs">点击「扫描工作区」或「扫描当前文件」开始</p>
    </div>

    <!-- 扫描进度 -->
    <div
      v-if="scanStore.scanning && scanStore.scanProgress"
      class="px-4 py-3 border-b border-[var(--vscode-panel-border)]"
    >
      <div class="flex items-center justify-between text-xs mb-1.5">
        <span>正在扫描...</span>
        <span>{{ scanStore.scanProgress.current }} / {{ scanStore.scanProgress.total }}</span>
      </div>
      <div class="w-full h-1.5 bg-[var(--vscode-progressBar-background)] rounded-full overflow-hidden">
        <div
          class="h-full bg-[var(--vscode-progressBar-background)] rounded-full transition-all"
          :style="{
            width: `${(scanStore.scanProgress.current / Math.max(scanStore.scanProgress.total, 1)) * 100}%`,
            backgroundColor: 'var(--vscode-progressBar-background, #0078d4)',
          }"
        />
      </div>
      <p class="text-xs opacity-60 mt-1 truncate">{{ scanStore.scanProgress.currentFile }}</p>
    </div>

    <!-- 文件列表 -->
    <div
      v-for="file in scanStore.filteredResults"
      :key="file.filePath"
      class="border-b border-[var(--vscode-panel-border)]"
    >
      <!-- 文件头 -->
      <div
        class="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-[var(--vscode-list-hoverBackground)] select-none"
        @click="toggleFile(file.filePath)"
      >
        <span class="text-xs opacity-60">{{ isExpanded(file.filePath) ? '▼' : '▶' }}</span>
        <span class="text-xs font-medium flex-1 truncate" :title="file.filePath">
          {{ file.fileName }}
        </span>
        <span
          v-if="file.pending.length > 0"
          class="text-xs px-1.5 py-0.5 rounded"
          style="background: var(--vscode-badge-background); color: var(--vscode-badge-foreground)"
        >
          {{ file.pending.length }} 待处理
        </span>
        <span class="text-xs opacity-50">{{ file.existing.length }} 已有</span>
      </div>

      <!-- 展开内容 -->
      <div v-if="isExpanded(file.filePath)" class="px-3 pb-2">
        <!-- 文件路径 -->
        <div class="flex items-center gap-2 mb-2">
          <span
            class="text-xs opacity-40 truncate flex-1 cursor-pointer hover:opacity-70"
            :title="file.filePath"
            @click="scanStore.openFile(file.filePath)"
          >
            {{ file.filePath }}
          </span>
        </div>

        <!-- 待处理列表 -->
        <div v-if="file.pending.length > 0" class="space-y-1">
          <!-- 全选 & 批量操作 -->
          <div class="flex items-center gap-2 mb-1.5">
            <label class="flex items-center gap-1 text-xs cursor-pointer">
              <input
                type="checkbox"
                :checked="isAllSelected(file)"
                @change="handleSelectAll(getFileIndex(file.filePath), ($event.target as HTMLInputElement).checked)"
              />
              全选
            </label>
            <button
              v-if="selectedCount(file) > 0"
              class="text-xs px-2 py-0.5 rounded
                     bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)]
                     hover:bg-[var(--vscode-button-hoverBackground)]"
              @click="handleBatchReplace(file.filePath, file.pending)"
            >
              替换选中 ({{ selectedCount(file) }})
            </button>
          </div>

          <!-- 单项 -->
          <div
            v-for="(item, idx) in file.pending"
            :key="idx"
            class="flex items-center gap-2 py-1.5 px-2 rounded text-xs
                   bg-[var(--vscode-editor-background)] border border-[var(--vscode-panel-border)]"
          >
            <input
              type="checkbox"
              :checked="item.selected"
              @change="scanStore.toggleItemSelection(getFileIndex(file.filePath), idx)"
            />
            <span
              class="truncate flex-1 min-w-0 cursor-pointer hover:underline"
              :title="item.text"
              @click="handleLocate(file.filePath, item)"
            >
              {{ item.text }}
            </span>
            <input
              type="text"
              class="text-xs px-1.5 py-0.5 rounded w-[180px] min-w-0
                     bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)]
                     border border-[var(--vscode-input-border,transparent)]
                     focus:outline-none focus:border-[var(--vscode-focusBorder)]"
              :value="item.i18nKey"
              :placeholder="item.i18nKey ? '' : '无匹配键，可输入新键'"
              :title="item.i18nKey || '输入 i18n key'"
              @change="scanStore.updateItemKey(
                getFileIndex(file.filePath),
                idx,
                ($event.target as HTMLInputElement).value.trim()
              )"
            />
            <button
              v-if="item.i18nKey"
              class="shrink-0 px-1 py-0.5 rounded text-xs opacity-70 hover:opacity-100
                     hover:bg-[var(--vscode-toolbar-hoverBackground)]"
              title="复制 key"
              @click="scanStore.copyToClipboard(item.i18nKey)"
            >
              📋
            </button>
            <button
              v-if="item.i18nKey"
              class="shrink-0 px-1 py-0.5 rounded text-xs opacity-70 hover:opacity-100
                     hover:bg-[var(--vscode-toolbar-hoverBackground)]"
              title="翻译并写入所有语言文件"
              @click="scanStore.translateScanItem(item)"
            >
              🌐
            </button>
            <button
              v-if="item.i18nKey"
              class="shrink-0 px-1.5 py-0.5 rounded text-xs
                     bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)]
                     hover:bg-[var(--vscode-button-hoverBackground)]"
              @click="handleReplace(file.filePath, item)"
            >
              替换
            </button>
          </div>
        </div>

        <p v-else class="text-xs opacity-40 py-2">所有文本已国际化</p>
      </div>
    </div>
  </div>
</template>
