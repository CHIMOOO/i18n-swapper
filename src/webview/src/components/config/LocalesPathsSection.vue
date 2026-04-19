<script setup lang="ts">
import { useConfigStore } from '../../stores/configStore';
import { LANGUAGE_NAMES } from '../../types/shared';
import ArrayEditor from './widgets/ArrayEditor.vue';

const configStore = useConfigStore();

function add(value: string) {
  const next = [...configStore.localesPaths, value];
  configStore.setLocalesPaths(Array.from(new Set(next)));
}

function remove(value: string) {
  configStore.setLocalesPaths(configStore.localesPaths.filter((p) => p !== value));
}

function normalize(p: string): string {
  return p.replace(/\\/g, '/').toLowerCase();
}

function langCodeOf(localePath: string): string {
  const target = normalize(localePath);
  const hit = configStore.languageMappings.find(
    (m) => m.filePath && (normalize(m.filePath) === target || normalize(m.filePath).endsWith('/' + target) || target.endsWith('/' + normalize(m.filePath)))
  );
  if (hit?.languageCode) return hit.languageCode;
  const base = localePath.split(/[\\/]/).pop() || localePath;
  const stem = base.replace(/\.(json|js|ts|yaml|yml|strings|xml|arb|properties)$/i, '');
  return stem || '?';
}

function langLabelOf(localePath: string): string {
  const code = langCodeOf(localePath);
  if (code === '?') return '未知[?]';
  const name = LANGUAGE_NAMES[code] || LANGUAGE_NAMES[code.toLowerCase()] || LANGUAGE_NAMES[code.split('-')[0]?.toLowerCase()];
  return name ? `${name}[${code}]` : `[${code}]`;
}
</script>

<template>
  <div class="space-y-3">
    <p class="text-[11px] opacity-60">
      源语言文件路径（相对工作区根），用于扫描已有 key 与生成新 key。
    </p>

    <ArrayEditor
      :model-value="configStore.localesPaths"
      placeholder="如：src/locales/zh-CN.json"
      mono
      empty-hint="尚未配置源语言文件"
      @add="add"
      @remove="remove"
    >
      <template #item-prefix="{ item }">
        <span
          class="text-[11px] px-1.5 py-0.5 rounded shrink-0 whitespace-nowrap"
          :style="{
            background: 'var(--vscode-badge-background)',
            color: 'var(--vscode-badge-foreground)',
          }"
          :title="`语言：${langLabelOf(item)}`"
        >{{ langLabelOf(item) }}</span>
      </template>
      <template #extra>
        <button
          type="button"
          class="text-xs px-2 rounded"
          :style="{
            background: 'var(--vscode-button-secondaryBackground)',
            color: 'var(--vscode-button-secondaryForeground)',
          }"
          @click="configStore.selectLocaleFiles()"
        >
          选择文件…
        </button>
      </template>
    </ArrayEditor>
  </div>
</template>
