<script setup lang="ts">
import { useConfigStore } from '../../stores/configStore';
import ArrayEditor from './widgets/ArrayEditor.vue';

const configStore = useConfigStore();

function add(value: string) {
  const next = [...configStore.localesPaths, value];
  configStore.setLocalesPaths(Array.from(new Set(next)));
}

function remove(value: string) {
  configStore.setLocalesPaths(configStore.localesPaths.filter((p) => p !== value));
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
