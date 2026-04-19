<script setup lang="ts">
import { ref, computed } from 'vue';
import { useScanStore, type FileScanResult, type ScanFilter } from '../stores/scanStore';

const scanStore = useScanStore();
const expandedFiles = ref<Set<string>>(new Set());

const isCurrentMode = computed(() => scanStore.scanMode === 'current');

const FILTERS: Array<{ key: ScanFilter; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '未处理' },
  { key: 'existing', label: '已处理' },
  { key: 'missingTranslation', label: '缺失译文' },
];

const showPending = computed(
  () => scanStore.scanFilter === 'all' || scanStore.scanFilter === 'pending' || scanStore.scanFilter === 'missingTranslation'
);
const showExisting = computed(
  () => scanStore.scanFilter === 'all' || scanStore.scanFilter === 'existing'
);

function toggleFile(filePath: string) {
  if (expandedFiles.value.has(filePath)) expandedFiles.value.delete(filePath);
  else expandedFiles.value.add(filePath);
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
function handleLocate(filePath: string, start: number, end: number) {
  scanStore.highlightText(filePath, start, end);
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

/** all 模式下应用 scanFilter 的 pending 列表 */
function pendingOf(file: FileScanResult) {
  if (scanStore.scanFilter === 'existing') return [];
  if (scanStore.scanFilter !== 'missingTranslation') return file.pending;
  const codes = scanStore.languageCodes;
  return file.pending.filter((p) => {
    if (!p.i18nKey) return true;
    return codes.some((c) => !scanStore.flatData[`${c}.${p.i18nKey}`]);
  });
}

/** all 模式下应用 scanFilter 的 existing 列表 */
function existingOf(file: FileScanResult) {
  if (scanStore.scanFilter === 'pending' || scanStore.scanFilter === 'missingTranslation') return [];
  return file.existing;
}

/** current 模式下展示的"虚拟单文件结果" */
const currentVirtualFile = computed<FileScanResult | null>(() => {
  if (!isCurrentMode.value) return null;
  const cf = scanStore.currentFileResult;
  if (!cf) return null;
  return {
    ...cf,
    pending: scanStore.currentFilePending,
    existing: scanStore.currentFileExisting,
  };
});
</script>

<template>
  <div class="flex-1 overflow-y-auto">
    <!-- 顶部筛选条 -->
    <div class="flex items-center gap-1 px-3 py-1.5 border-b border-[var(--vscode-panel-border)]">
      <button
        v-for="f in FILTERS"
        :key="f.key"
        type="button"
        class="text-xs px-2 py-0.5 rounded transition-colors"
        :class="scanStore.scanFilter === f.key
          ? 'bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)]'
          : 'opacity-60 hover:opacity-100 hover:bg-[var(--vscode-list-hoverBackground)]'"
        @click="scanStore.setScanFilter(f.key)"
      >
        {{ f.label }}
      </button>
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
          class="h-full rounded-full transition-all"
          :style="{
            width: `${(scanStore.scanProgress.current / Math.max(scanStore.scanProgress.total, 1)) * 100}%`,
            backgroundColor: 'var(--vscode-progressBar-background, #0078d4)',
          }"
        />
      </div>
      <p class="text-xs opacity-60 mt-1 truncate">{{ scanStore.scanProgress.currentFile }}</p>
    </div>

    <!-- ── 当前文件模式：扁平展示 ─────────────────── -->
    <template v-if="isCurrentMode">
      <div
        v-if="!currentVirtualFile && !scanStore.scanning"
        class="flex flex-col items-center justify-center py-12 opacity-50"
      >
        <p class="text-sm mb-2">当前文件暂无扫描结果</p>
        <p class="text-xs">在编辑器中打开一个代码文件后，点击"扫描当前文件"</p>
      </div>

      <div v-else-if="currentVirtualFile" class="px-3 py-2">
        <!-- 文件路径条 -->
        <div class="flex items-center gap-2 mb-2">
          <span class="text-xs opacity-60 font-medium">{{ currentVirtualFile.fileName }}</span>
          <span
            v-if="currentVirtualFile.pending.length > 0"
            class="text-xs px-1.5 py-0.5 rounded"
            style="background: var(--vscode-badge-background); color: var(--vscode-badge-foreground)"
          >
            {{ currentVirtualFile.pending.length }} 待处理
          </span>
          <span class="text-xs opacity-50">{{ currentVirtualFile.existing.length }} 已国际化</span>
          <span class="flex-1" />
          <span
            class="text-xs opacity-40 truncate max-w-[40%] cursor-pointer hover:opacity-70"
            :title="currentVirtualFile.filePath"
            @click="scanStore.openFile(currentVirtualFile.filePath)"
          >
            {{ currentVirtualFile.filePath }}
          </span>
        </div>

        <!-- 未处理区块 -->
        <template v-if="showPending && currentVirtualFile.pending.length > 0">
          <div class="flex items-center gap-2 mb-1.5">
            <label class="flex items-center gap-1 text-xs cursor-pointer">
              <input
                type="checkbox"
                :checked="isAllSelected(currentVirtualFile)"
                @change="handleSelectAll(getFileIndex(currentVirtualFile.filePath), ($event.target as HTMLInputElement).checked)"
              />
              全选
            </label>
            <button
              v-if="selectedCount(currentVirtualFile) > 0"
              class="text-xs px-2 py-0.5 rounded
                     bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)]
                     hover:bg-[var(--vscode-button-hoverBackground)]"
              @click="handleBatchReplace(currentVirtualFile.filePath, currentVirtualFile.pending)"
            >
              替换选中 ({{ selectedCount(currentVirtualFile) }})
            </button>
          </div>
          <div
            v-for="(item, idx) in currentVirtualFile.pending"
            :key="'p-' + idx"
            class="flex items-center gap-2 py-1.5 px-2 mb-1 rounded text-xs cursor-pointer
                   bg-[var(--vscode-editor-background)] border border-[var(--vscode-panel-border)]
                   hover:bg-[var(--vscode-list-hoverBackground)]"
            @click="handleLocate(currentVirtualFile.filePath, item.start, item.end)"
          >
            <input
              type="checkbox"
              :checked="item.selected"
              @click.stop
              @change="scanStore.toggleItemSelection(getFileIndex(currentVirtualFile.filePath), idx)"
            />
            <span class="truncate flex-1 min-w-0" :title="item.text">{{ item.text }}</span>
            <input
              type="text"
              class="text-xs px-1.5 py-0.5 rounded w-[180px] min-w-0
                     bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)]
                     border border-[var(--vscode-input-border,transparent)]
                     focus:outline-none focus:border-[var(--vscode-focusBorder)]"
              :value="item.i18nKey"
              :placeholder="item.i18nKey ? '' : '无匹配键，可输入新键'"
              :title="item.i18nKey || '输入 i18n key'"
              @click.stop
              @change="scanStore.updateItemKey(
                getFileIndex(currentVirtualFile.filePath),
                idx,
                ($event.target as HTMLInputElement).value.trim()
              )"
            />
            <button
              v-if="item.i18nKey"
              class="shrink-0 px-1 py-0.5 rounded text-xs opacity-70 hover:opacity-100
                     hover:bg-[var(--vscode-toolbar-hoverBackground)]"
              title="复制 key"
              @click.stop="scanStore.copyToClipboard(item.i18nKey)"
            >
              📋
            </button>
            <button
              v-if="item.i18nKey"
              class="shrink-0 px-1 py-0.5 rounded text-xs opacity-70 hover:opacity-100
                     hover:bg-[var(--vscode-toolbar-hoverBackground)]"
              title="翻译并写入所有语言文件"
              @click.stop="scanStore.translateScanItem(item)"
            >
              🌐
            </button>
            <button
              v-if="item.i18nKey"
              class="shrink-0 px-1.5 py-0.5 rounded text-xs
                     bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)]
                     hover:bg-[var(--vscode-button-hoverBackground)]"
              @click.stop="handleReplace(currentVirtualFile.filePath, item)"
            >
              替换
            </button>
          </div>
        </template>

        <p
          v-else-if="showPending && (!showExisting || currentVirtualFile.existing.length === 0)"
          class="text-xs opacity-40 py-2"
        >无待处理项</p>

        <!-- 已国际化区块 -->
        <template v-if="showExisting && currentVirtualFile.existing.length > 0">
          <div class="flex items-center gap-2 mt-3 mb-1.5 pt-2 border-t border-[var(--vscode-panel-border)]">
            <span class="text-xs opacity-60 font-medium">已国际化</span>
            <span
              class="text-xs px-1.5 py-0.5 rounded"
              style="background: var(--vscode-badge-background); color: var(--vscode-badge-foreground)"
            >
              {{ currentVirtualFile.existing.length }}
            </span>
          </div>
          <div
            v-for="(em, eidx) in currentVirtualFile.existing"
            :key="'e-' + eidx"
            class="flex items-center gap-2 py-1 px-2 rounded text-xs cursor-pointer
                   hover:bg-[var(--vscode-list-hoverBackground)]"
            :title="em.fullMatch"
            @click="handleLocate(currentVirtualFile.filePath, em.startOffset, em.endOffset)"
          >
            <span class="text-[10px] shrink-0" style="color: var(--vscode-charts-green, #3fb950)">✓</span>
            <span
              class="text-[10px] shrink-0 px-1.5 py-0.5 rounded font-mono max-w-[40%] truncate"
              style="background: var(--vscode-badge-background); color: var(--vscode-badge-foreground)"
              :title="em.key"
            >{{ em.key }}</span>
            <span
              class="text-xs truncate flex-1 min-w-0"
              :class="em.existingValue ? '' : 'opacity-40 italic'"
              :title="em.existingValue || '（未在已加载语言文件中找到译文）'"
            >{{ em.existingValue || '未找到译文' }}</span>
            <button
              class="shrink-0 px-1 py-0.5 rounded text-xs opacity-60 hover:opacity-100
                     hover:bg-[var(--vscode-toolbar-hoverBackground)]"
              title="复制 key"
              @click.stop="scanStore.copyToClipboard(em.key)"
            >📋</button>
          </div>
        </template>
      </div>
    </template>

    <!-- ── 全工作区模式：保留文件折叠 ──────────────────────────── -->
    <template v-else>
      <div
        v-if="scanStore.filteredResults.length === 0 && !scanStore.scanning"
        class="flex flex-col items-center justify-center py-12 opacity-50"
      >
        <p class="text-sm mb-2">暂无扫描结果</p>
        <p class="text-xs">点击「扫描工作区」开始</p>
      </div>

      <div
        v-for="file in scanStore.filteredResults"
        :key="file.filePath"
        class="border-b border-[var(--vscode-panel-border)]"
      >
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
          <span class="text-xs opacity-50">{{ file.existing.length }} 已国际化</span>
        </div>

        <div v-if="isExpanded(file.filePath)" class="px-3 pb-2">
          <div class="flex items-center gap-2 mb-2">
            <span
              class="text-xs opacity-40 truncate flex-1 cursor-pointer hover:opacity-70"
              :title="file.filePath"
              @click="scanStore.openFile(file.filePath)"
            >
              {{ file.filePath }}
            </span>
          </div>

          <!-- 未处理 -->
          <template v-if="showPending && pendingOf(file).length > 0">
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
                @click="handleBatchReplace(file.filePath, pendingOf(file))"
              >
                替换选中 ({{ selectedCount(file) }})
              </button>
            </div>
            <div
              v-for="(item, idx) in pendingOf(file)"
              :key="'p-' + idx"
              class="flex items-center gap-2 py-1.5 px-2 mb-1 rounded text-xs cursor-pointer
                     bg-[var(--vscode-editor-background)] border border-[var(--vscode-panel-border)]
                     hover:bg-[var(--vscode-list-hoverBackground)]"
              @click="handleLocate(file.filePath, item.start, item.end)"
            >
              <input
                type="checkbox"
                :checked="item.selected"
                @click.stop
                @change="scanStore.toggleItemSelection(getFileIndex(file.filePath), idx)"
              />
              <span class="truncate flex-1 min-w-0" :title="item.text">{{ item.text }}</span>
              <input
                type="text"
                class="text-xs px-1.5 py-0.5 rounded w-[180px] min-w-0
                       bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)]
                       border border-[var(--vscode-input-border,transparent)]
                       focus:outline-none focus:border-[var(--vscode-focusBorder)]"
                :value="item.i18nKey"
                :placeholder="item.i18nKey ? '' : '无匹配键，可输入新键'"
                :title="item.i18nKey || '输入 i18n key'"
                @click.stop
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
                @click.stop="scanStore.copyToClipboard(item.i18nKey)"
              >
                📋
              </button>
              <button
                v-if="item.i18nKey"
                class="shrink-0 px-1 py-0.5 rounded text-xs opacity-70 hover:opacity-100
                       hover:bg-[var(--vscode-toolbar-hoverBackground)]"
                title="翻译并写入所有语言文件"
                @click.stop="scanStore.translateScanItem(item)"
              >
                🌐
              </button>
              <button
                v-if="item.i18nKey"
                class="shrink-0 px-1.5 py-0.5 rounded text-xs
                       bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)]
                       hover:bg-[var(--vscode-button-hoverBackground)]"
                @click.stop="handleReplace(file.filePath, item)"
              >
                替换
              </button>
            </div>
          </template>

          <!-- 已国际化 -->
          <template v-if="showExisting && existingOf(file).length > 0">
            <div class="flex items-center gap-2 mt-2 mb-1.5 pt-2 border-t border-[var(--vscode-panel-border)]">
              <span class="text-xs opacity-60 font-medium">已国际化</span>
              <span
                class="text-xs px-1.5 py-0.5 rounded"
                style="background: var(--vscode-badge-background); color: var(--vscode-badge-foreground)"
              >
                {{ existingOf(file).length }}
              </span>
            </div>
            <div
              v-for="(em, eidx) in existingOf(file)"
              :key="'e-' + eidx"
              class="flex items-center gap-2 py-1 px-2 rounded text-xs cursor-pointer
                     hover:bg-[var(--vscode-list-hoverBackground)]"
              :title="em.fullMatch"
              @click="handleLocate(file.filePath, em.startOffset, em.endOffset)"
            >
              <span class="text-[10px] shrink-0" style="color: var(--vscode-charts-green, #3fb950)">✓</span>
              <span
                class="text-[10px] shrink-0 px-1.5 py-0.5 rounded font-mono max-w-[40%] truncate"
                style="background: var(--vscode-badge-background); color: var(--vscode-badge-foreground)"
                :title="em.key"
              >{{ em.key }}</span>
              <span
                class="text-xs truncate flex-1 min-w-0"
                :class="em.existingValue ? '' : 'opacity-40 italic'"
                :title="em.existingValue || '（未在已加载语言文件中找到译文）'"
              >{{ em.existingValue || '未找到译文' }}</span>
              <button
                class="shrink-0 px-1 py-0.5 rounded text-xs opacity-60 hover:opacity-100
                       hover:bg-[var(--vscode-toolbar-hoverBackground)]"
                title="复制 key"
                @click.stop="scanStore.copyToClipboard(em.key)"
              >📋</button>
            </div>
          </template>

          <p
            v-if="(showPending && pendingOf(file).length === 0) && (!showExisting || existingOf(file).length === 0)"
            class="text-xs opacity-40 py-2"
          >
            无匹配项
          </p>
        </div>
      </div>
    </template>
  </div>
</template>
