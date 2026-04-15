<script setup lang="ts">
import { ref } from 'vue';
import { useScanStore } from '../stores/scanStore';
import { useI18nStatus } from '../composables/useI18nStatus';

const scanStore = useScanStore();
const { overallProgress, languageProgress, allMissingKeys } = useI18nStatus();
const showMissing = ref(false);
const expandedLang = ref<string | null>(null);

function toggleLang(code: string) {
  expandedLang.value = expandedLang.value === code ? null : code;
}

function handleTranslateAll(key: string, text: string) {
  scanStore.translateKey(key, text);
}

function handleCopyKey(key: string) {
  scanStore.copyToClipboard(key);
}

function progressColor(progress: number): string {
  if (progress >= 90) return 'var(--vscode-testing-iconPassed, #4caf50)';
  if (progress >= 50) return 'var(--vscode-editorWarning-foreground, #ff9800)';
  return 'var(--vscode-errorForeground, #f44336)';
}
</script>

<template>
  <div class="p-3">
    <!-- 总览 -->
    <div class="mb-4">
      <div class="flex items-center justify-between mb-1.5">
        <span class="text-sm font-medium">翻译完成度</span>
        <span class="text-sm font-bold">{{ overallProgress }}%</span>
      </div>
      <div class="w-full h-2 bg-[var(--vscode-input-background)] rounded-full overflow-hidden">
        <div
          class="h-full rounded-full transition-all"
          :style="{ width: `${overallProgress}%`, backgroundColor: progressColor(overallProgress) }"
        />
      </div>
      <div class="flex gap-4 mt-1.5 text-xs opacity-60">
        <span>{{ scanStore.keyCount }} 个键</span>
        <span>{{ scanStore.languageCodes.length }} 种语言</span>
      </div>
    </div>

    <!-- 各语言状态 -->
    <div class="space-y-1.5">
      <div
        v-for="lang in languageProgress"
        :key="lang.code"
        class="border border-[var(--vscode-panel-border)] rounded"
      >
        <div
          class="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-[var(--vscode-list-hoverBackground)]"
          @click="toggleLang(lang.code)"
        >
          <span class="text-xs">{{ expandedLang === lang.code ? '▼' : '▶' }}</span>
          <span class="text-xs font-medium flex-1">{{ lang.displayName }} ({{ lang.code }})</span>
          <span class="text-xs" :style="{ color: progressColor(lang.progress) }">
            {{ lang.progress }}%
          </span>
          <span class="text-xs opacity-50">
            {{ lang.translatedKeys }}/{{ lang.totalKeys }}
          </span>
        </div>

        <!-- 缺失键列表 -->
        <div v-if="expandedLang === lang.code && lang.missingKeys.length > 0" class="px-3 pb-2">
          <div class="text-xs opacity-60 mb-1">缺失 {{ lang.missingCount }} 个翻译:</div>
          <div class="max-h-40 overflow-y-auto space-y-0.5">
            <div
              v-for="key in lang.missingKeys.slice(0, 50)"
              :key="key"
              class="flex items-center gap-2 text-xs py-0.5"
            >
              <span class="truncate flex-1 opacity-70" :title="key">{{ key }}</span>
              <button
                class="shrink-0 text-xs opacity-60 hover:opacity-100"
                title="复制键名"
                @click.stop="handleCopyKey(key)"
              >
                复制
              </button>
              <button
                class="shrink-0 text-xs opacity-60 hover:opacity-100"
                title="翻译"
                @click.stop="handleTranslateAll(key, scanStore.flatData[key] || '')"
              >
                翻译
              </button>
            </div>
            <div v-if="lang.missingKeys.length > 50" class="text-xs opacity-40 py-1">
              ...还有 {{ lang.missingKeys.length - 50 }} 项
            </div>
          </div>
        </div>

        <div v-if="expandedLang === lang.code && lang.missingKeys.length === 0" class="px-3 pb-2">
          <span class="text-xs opacity-50">所有键均已翻译</span>
        </div>
      </div>
    </div>

    <!-- 全局缺失键视图 -->
    <div v-if="allMissingKeys.length > 0" class="mt-4">
      <button
        class="text-xs opacity-70 hover:opacity-100 cursor-pointer"
        @click="showMissing = !showMissing"
      >
        {{ showMissing ? '▼' : '▶' }} 所有缺失翻译 ({{ allMissingKeys.length }})
      </button>

      <div v-if="showMissing" class="mt-2 space-y-1 max-h-60 overflow-y-auto">
        <div
          v-for="item in allMissingKeys.slice(0, 100)"
          :key="item.key"
          class="flex items-center gap-2 text-xs py-1 px-2 rounded
                 border border-[var(--vscode-panel-border)]"
        >
          <span class="truncate flex-1" :title="item.key">{{ item.key }}</span>
          <span class="opacity-50 truncate max-w-[100px]">{{ item.value }}</span>
          <span class="opacity-40 shrink-0">缺: {{ item.missingIn.join(', ') }}</span>
          <button
            class="shrink-0 text-xs opacity-60 hover:opacity-100"
            @click="handleTranslateAll(item.key, item.value)"
          >
            翻译
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
