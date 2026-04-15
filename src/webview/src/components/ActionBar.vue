<script setup lang="ts">
import { useScanStore } from '../stores/scanStore';

const scanStore = useScanStore();
</script>

<template>
  <div class="flex items-center gap-2 px-3 py-2 border-t border-[var(--vscode-panel-border)]
              bg-[var(--vscode-sideBar-background)]">
    <button
      class="flex-1 text-xs px-3 py-1.5 rounded
             bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)]
             hover:bg-[var(--vscode-button-hoverBackground)]
             disabled:opacity-50 disabled:cursor-not-allowed"
      :disabled="scanStore.scanning"
      @click="scanStore.scanWorkspace()"
    >
      {{ scanStore.scanning ? '扫描中...' : '扫描工作区' }}
    </button>

    <button
      class="text-xs px-3 py-1.5 rounded
             bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)]
             hover:bg-[var(--vscode-button-secondaryHoverBackground)]
             disabled:opacity-50 disabled:cursor-not-allowed"
      :disabled="scanStore.scanning"
      @click="scanStore.scanCurrentFile()"
    >
      扫描当前文件
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
</template>
