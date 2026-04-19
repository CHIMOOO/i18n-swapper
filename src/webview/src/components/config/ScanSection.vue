<script setup lang="ts">
import { useConfigStore } from '../../stores/configStore';
import ArrayEditor from './widgets/ArrayEditor.vue';

const configStore = useConfigStore();

function add(key: 'scanPatterns' | 'excludeFiles' | 'includeFiles', v: string) {
  configStore.addArrayItem(key, v);
}
function remove(key: 'scanPatterns' | 'excludeFiles' | 'includeFiles', v: string) {
  configStore.removeArrayItem(key, v);
}

function pickFolder(configKey: string) {
  configStore.pickPathForConfig({
    configKey,
    pickType: 'folder',
    openLabel: '选择文件夹',
  });
}

function pickFile(configKey: string) {
  configStore.pickPathForConfig({
    configKey,
    pickType: 'fileMulti',
    openLabel: '选择文件',
  });
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <h4 class="text-xs font-medium mb-1">扫描标签/属性</h4>
      <p class="text-[11px] opacity-60 mb-2">
        模板/JSX 中需扫描的标签或属性名。例如：<code>title</code>、<code>label</code>。
      </p>
      <ArrayEditor
        :model-value="configStore.scanPatterns"
        placeholder="如：title / placeholder"
        mono
        empty-hint="尚未配置扫描属性"
        @add="(v) => add('scanPatterns', v)"
        @remove="(v) => remove('scanPatterns', v)"
      />
    </div>

    <div>
      <h4 class="text-xs font-medium mb-1">排除路径</h4>
      <p class="text-[11px] opacity-60 mb-2">支持文件或目录（相对工作区）。</p>
      <ArrayEditor
        :model-value="configStore.excludeFiles"
        placeholder="如：node_modules / dist"
        mono
        empty-hint="未配置任何排除路径"
        @add="(v) => add('excludeFiles', v)"
        @remove="(v) => remove('excludeFiles', v)"
      >
        <template #extra>
          <button
            type="button"
            class="text-xs px-2 rounded"
            :style="{
              background: 'var(--vscode-button-secondaryBackground)',
              color: 'var(--vscode-button-secondaryForeground)',
            }"
            @click="pickFolder('excludeFiles')"
          >文件夹…</button>
        </template>
      </ArrayEditor>
    </div>

    <div>
      <h4 class="text-xs font-medium mb-1">额外包含路径</h4>
      <p class="text-[11px] opacity-60 mb-2">默认扫描全部源代码目录，用于补齐被排除外的额外路径。</p>
      <ArrayEditor
        :model-value="configStore.includeFiles"
        placeholder="如：src/legacy"
        mono
        empty-hint="未配置额外包含路径"
        @add="(v) => add('includeFiles', v)"
        @remove="(v) => remove('includeFiles', v)"
      >
        <template #extra>
          <button
            type="button"
            class="text-xs px-2 rounded"
            :style="{
              background: 'var(--vscode-button-secondaryBackground)',
              color: 'var(--vscode-button-secondaryForeground)',
            }"
            @click="pickFolder('includeFiles')"
          >文件夹…</button>
          <button
            type="button"
            class="text-xs px-2 rounded"
            :style="{
              background: 'var(--vscode-button-secondaryBackground)',
              color: 'var(--vscode-button-secondaryForeground)',
            }"
            @click="pickFile('includeFiles')"
          >文件…</button>
        </template>
      </ArrayEditor>
    </div>
  </div>
</template>
