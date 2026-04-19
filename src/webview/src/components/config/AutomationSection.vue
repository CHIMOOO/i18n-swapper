<script setup lang="ts">
import { useConfigStore } from '../../stores/configStore';

const configStore = useConfigStore();

const inputStyle = {
  background: 'var(--vscode-input-background)',
  color: 'var(--vscode-input-foreground)',
  border: '1px solid var(--vscode-input-border, transparent)',
};
</script>

<template>
  <div class="space-y-3">
    <label class="flex items-center gap-2 text-xs">
      <input
        type="checkbox"
        :checked="configStore.autoGenerateKeyFromText"
        @change="(e) => configStore.updateConfig('autoGenerateKeyFromText', (e.target as HTMLInputElement).checked)"
      />
      <span class="opacity-80">自动从中文文本生成英文 key（替换时调用翻译 API）</span>
    </label>

    <label class="grid grid-cols-[6rem_1fr] items-center gap-2 text-xs">
      <span class="opacity-70">key 前缀</span>
      <input
        :value="configStore.autoGenerateKeyPrefix"
        @change="(e) => configStore.updateConfig('autoGenerateKeyPrefix', (e.target as HTMLInputElement).value)"
        class="font-mono text-xs px-2 py-1 rounded outline-none"
        :style="inputStyle"
        placeholder="如：page.home（可空）"
      />
    </label>

    <label class="flex items-center gap-2 text-xs">
      <input
        type="checkbox"
        :checked="configStore.autoTranslateAllLanguages"
        @change="(e) => configStore.updateConfig('autoTranslateAllLanguages', (e.target as HTMLInputElement).checked)"
      />
      <span class="opacity-80">替换时自动翻译并写入所有目标语言</span>
    </label>
  </div>
</template>
