<script setup lang="ts">
import { ref, watch } from 'vue';
import { useScanStore } from '../stores/scanStore';

const scanStore = useScanStore();
const searchQuery = ref('');
const searchIn = ref<'key' | 'value' | 'both'>('both');
let debounceTimer: ReturnType<typeof setTimeout>;

watch(searchQuery, (val) => {
  clearTimeout(debounceTimer);
  if (!val.trim()) {
    scanStore.searchResults = [];
    scanStore.searchTotal = 0;
    return;
  }
  debounceTimer = setTimeout(() => {
    scanStore.searchKeys(val, searchIn.value);
  }, 300);
});

function handleCopyKey(key: string) {
  scanStore.copyToClipboard(key);
}

function handleTranslate(key: string, text: string) {
  scanStore.translateKey(key, text);
}
</script>

<template>
  <div class="p-3">
    <div class="flex gap-2 mb-3">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="搜索键名或翻译值..."
        class="flex-1 bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)]
               border border-[var(--vscode-input-border)] rounded px-3 py-1.5 text-xs
               placeholder:text-[var(--vscode-input-placeholderForeground)]
               focus:outline-none focus:border-[var(--vscode-focusBorder)]"
      />
      <select
        v-model="searchIn"
        class="text-xs bg-[var(--vscode-dropdown-background)] text-[var(--vscode-dropdown-foreground)]
               border border-[var(--vscode-dropdown-border)] rounded px-2 py-1"
        @change="searchQuery && scanStore.searchKeys(searchQuery, searchIn)"
      >
        <option value="both">键+值</option>
        <option value="key">仅键名</option>
        <option value="value">仅值</option>
      </select>
    </div>

    <!-- 结果 -->
    <div v-if="scanStore.searchResults.length > 0" class="space-y-1.5">
      <div class="text-xs opacity-50 mb-2">
        找到 {{ scanStore.searchTotal }} 个结果
        <span v-if="scanStore.searchTotal > 200">（显示前 200 个）</span>
      </div>

      <div
        v-for="item in scanStore.searchResults"
        :key="item.key"
        class="p-2 rounded border border-[var(--vscode-panel-border)] text-xs"
      >
        <div class="flex items-center gap-2 mb-1">
          <code class="flex-1 truncate font-mono text-[var(--vscode-textLink-foreground)]" :title="item.key">
            {{ item.key }}
          </code>
          <button class="shrink-0 opacity-60 hover:opacity-100" @click="handleCopyKey(item.key)">
            复制
          </button>
        </div>
        <div class="opacity-70 mb-1">{{ item.value }}</div>
        <div v-if="Object.keys(item.translations).length > 0" class="flex flex-wrap gap-x-3 gap-y-0.5">
          <span
            v-for="(val, lang) in item.translations"
            :key="lang"
            class="opacity-50"
          >
            {{ lang }}: {{ val }}
          </span>
        </div>
        <button
          class="mt-1 text-xs opacity-60 hover:opacity-100"
          @click="handleTranslate(item.key, item.value)"
        >
          翻译到所有语言
        </button>
      </div>
    </div>

    <div v-else-if="searchQuery && scanStore.searchResults.length === 0" class="text-xs opacity-40 text-center py-8">
      没有找到匹配结果
    </div>

    <div v-else class="text-xs opacity-40 text-center py-8">
      输入关键词搜索翻译键
    </div>
  </div>
</template>
