<script setup lang="ts">
import { computed } from 'vue';
import { useScanStore } from '../stores/scanStore';

const scanStore = useScanStore();

const primaryLabel = computed(() => {
  if (scanStore.scanning) return '扫描中...';
  return scanStore.scanMode === 'all' ? '扫描工作区' : '扫描当前文件';
});

function handlePrimaryScan() {
  if (scanStore.scanMode === 'all') {
    scanStore.scanWorkspace();
  } else {
    scanStore.scanCurrentFile();
  }
}
</script>

<template>
  <div class="border-t border-[var(--vscode-panel-border)] bg-[var(--vscode-sideBar-background)]">
    <!-- 模式切换 + 跟随开关 -->
    <div class="flex items-center gap-2 px-3 pt-2">
      <div class="inline-flex rounded overflow-hidden border border-[var(--vscode-panel-border)]">
        <button
          class="text-xs px-2 py-1"
          :class="scanStore.scanMode === 'current'
            ? 'bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)]'
            : 'bg-transparent opacity-70 hover:opacity-100'"
          @click="scanStore.setScanMode('current')"
        >
          当前文件
        </button>
        <button
          class="text-xs px-2 py-1"
          :class="scanStore.scanMode === 'all'
            ? 'bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)]'
            : 'bg-transparent opacity-70 hover:opacity-100'"
          @click="scanStore.setScanMode('all')"
        >
          全工作区
        </button>
      </div>

      <label
        v-if="scanStore.scanMode === 'current'"
        class="flex items-center gap-1 text-xs cursor-pointer select-none"
        title="切换编辑器时自动重扫当前文件"
      >
        <input
          type="checkbox"
          :checked="scanStore.followActiveEditor"
          @change="scanStore.setFollowActiveEditor(($event.target as HTMLInputElement).checked)"
        />
        跟随聚焦
      </label>
    </div>

    <!-- 当前文件指示（仅当前文件模式 + 跟随开启） -->
    <div
      v-if="scanStore.scanMode === 'current' && scanStore.currentFilePath"
      class="px-3 pt-1 text-[11px] opacity-60 truncate"
      :title="scanStore.currentFilePath"
    >
      <span v-if="scanStore.currentFileIsLanguageFile" class="opacity-70">
        ⚠ 语言文件已跳过：
      </span>
      <span v-else>📄 </span>{{ scanStore.currentFilePath }}
    </div>

    <!-- 操作按钮 -->
    <div class="flex items-center gap-2 px-3 py-2">
      <button
        class="flex-1 text-xs px-3 py-1.5 rounded
               bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)]
               hover:bg-[var(--vscode-button-hoverBackground)]
               disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="scanStore.scanning"
        @click="handlePrimaryScan"
      >
        {{ primaryLabel }}
      </button>

      <button
        class="text-xs px-2 py-1.5 rounded opacity-70 hover:opacity-100
               bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)]
               hover:bg-[var(--vscode-button-secondaryHoverBackground)]"
        title="刷新数据"
        @click="scanStore.refreshData()"
      >
        ↻
      </button>
    </div>
  </div>
</template>
