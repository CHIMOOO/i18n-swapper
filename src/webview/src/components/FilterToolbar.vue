<script setup lang="ts">
import { useScanStore } from '../stores/scanStore';

const scanStore = useScanStore();
</script>

<template>
  <div class="flex items-center gap-2 p-3 border-b border-[var(--vscode-panel-border)]">
    <div class="relative flex-1">
      <input
        v-model="scanStore.filterText"
        type="text"
        placeholder="搜索文件名、路径或文本..."
        class="w-full bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)]
               border border-[var(--vscode-input-border)] rounded px-3 py-1.5 text-xs
               placeholder:text-[var(--vscode-input-placeholderForeground)]
               focus:outline-none focus:border-[var(--vscode-focusBorder)]"
      />
      <button
        v-if="scanStore.filterText"
        class="absolute right-2 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100"
        @click="scanStore.filterText = ''"
      >
        ✕
      </button>
    </div>

    <label class="flex items-center gap-1 text-xs cursor-pointer select-none whitespace-nowrap">
      <input
        v-model="scanStore.showPendingOnly"
        type="checkbox"
        class="accent-[var(--vscode-checkbox-foreground)]"
      />
      仅待处理
    </label>

    <div class="text-xs opacity-60 whitespace-nowrap">
      {{ scanStore.filteredResults.length }} 个文件
    </div>
  </div>
</template>
