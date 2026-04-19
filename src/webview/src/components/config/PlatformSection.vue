<script setup lang="ts">
import { useConfigStore } from '../../stores/configStore';
import ArrayEditor from './widgets/ArrayEditor.vue';

const configStore = useConfigStore();

const PLATFORM_OPTIONS = [
  { value: 'auto', label: '自动检测' },
  { value: 'web', label: 'Web（i18next / vue-i18n）' },
  { value: 'android', label: 'Android（strings.xml）' },
  { value: 'ios', label: 'iOS（.strings / SwiftGen）' },
];

function setRepo(key: 'web' | 'ios' | 'android', value: string) {
  configStore.updateConfig('defaultRepositories', { ...configStore.defaultRepositories, [key]: value });
}

function addRes(v: string) {
  configStore.addArrayItem('localeResSubPaths', v);
}
function removeRes(v: string) {
  configStore.removeArrayItem('localeResSubPaths', v);
}
function addMap(v: string) {
  configStore.addArrayItem('keyMappingFiles', v);
}
function removeMap(v: string) {
  configStore.removeArrayItem('keyMappingFiles', v);
}

function pickFolder(configKey: string) {
  configStore.pickPathForConfig({ configKey, pickType: 'folder', openLabel: '选择文件夹' });
}
function pickFile(configKey: string) {
  configStore.pickPathForConfig({ configKey, pickType: 'fileMulti', openLabel: '选择文件' });
}

const dropdownStyle = {
  background: 'var(--vscode-dropdown-background)',
  color: 'var(--vscode-dropdown-foreground)',
  border: '1px solid var(--vscode-dropdown-border, transparent)',
};
const inputStyle = {
  background: 'var(--vscode-input-background)',
  color: 'var(--vscode-input-foreground)',
  border: '1px solid var(--vscode-input-border, transparent)',
};
</script>

<template>
  <div class="space-y-4">
    <label class="grid grid-cols-[6rem_1fr] items-center gap-2 text-xs">
      <span class="opacity-70">当前平台</span>
      <select
        :value="configStore.platform"
        @change="(e) => configStore.updateConfig('platform', (e.target as HTMLSelectElement).value)"
        class="text-xs px-2 py-1 rounded"
        :style="dropdownStyle"
      >
        <option v-for="p in PLATFORM_OPTIONS" :key="p.value" :value="p.value">{{ p.label }}</option>
      </select>
    </label>

    <div>
      <h4 class="text-xs font-medium mb-1">三端默认语言文件仓库</h4>
      <p class="text-[11px] opacity-60 mb-2">
        初始化时若工作区未配置 <code>localesPaths</code>，将根据平台读取以下默认路径。
      </p>
      <div class="space-y-2">
        <label class="grid grid-cols-[5rem_1fr] items-center gap-2 text-xs">
          <span class="opacity-70">Web</span>
          <input
            :value="configStore.defaultRepositories.web"
            @change="(e) => setRepo('web', (e.target as HTMLInputElement).value)"
            class="font-mono text-xs px-2 py-1 rounded outline-none"
            :style="inputStyle"
            placeholder="src/locales"
          />
        </label>
        <label class="grid grid-cols-[5rem_1fr] items-center gap-2 text-xs">
          <span class="opacity-70">Android</span>
          <input
            :value="configStore.defaultRepositories.android"
            @change="(e) => setRepo('android', (e.target as HTMLInputElement).value)"
            class="font-mono text-xs px-2 py-1 rounded outline-none"
            :style="inputStyle"
            placeholder="app/src/main/res"
          />
        </label>
        <label class="grid grid-cols-[5rem_1fr] items-center gap-2 text-xs">
          <span class="opacity-70">iOS</span>
          <input
            :value="configStore.defaultRepositories.ios"
            @change="(e) => setRepo('ios', (e.target as HTMLInputElement).value)"
            class="font-mono text-xs px-2 py-1 rounded outline-none"
            :style="inputStyle"
            placeholder="Resources/Localization"
          />
        </label>
      </div>
    </div>

    <div>
      <h4 class="text-xs font-medium mb-1">Android res 子路径</h4>
      <p class="text-[11px] opacity-60 mb-2">优先扫描的 res 子路径（如 <code>app/src/main/res</code>）。</p>
      <ArrayEditor
        :model-value="configStore.localeResSubPaths"
        placeholder="如：app/src/main/res"
        mono
        empty-hint="未配置（将使用平台默认）"
        @add="addRes"
        @remove="removeRes"
      >
        <template #extra>
          <button
            type="button"
            class="text-xs px-2 rounded"
            :style="{
              background: 'var(--vscode-button-secondaryBackground)',
              color: 'var(--vscode-button-secondaryForeground)',
            }"
            @click="pickFolder('localeResSubPaths')"
          >文件夹…</button>
        </template>
      </ArrayEditor>
    </div>

    <div>
      <h4 class="text-xs font-medium mb-1">iOS key 映射文件</h4>
      <p class="text-[11px] opacity-60 mb-2">
        Swift 枚举/常量文件，用于解析 <code>L.foo.bar</code> → 实际 key。
      </p>
      <ArrayEditor
        :model-value="configStore.keyMappingFiles"
        placeholder="如：Sources/Localization/L.swift"
        mono
        empty-hint="未配置 key 映射文件"
        @add="addMap"
        @remove="removeMap"
      >
        <template #extra>
          <button
            type="button"
            class="text-xs px-2 rounded"
            :style="{
              background: 'var(--vscode-button-secondaryBackground)',
              color: 'var(--vscode-button-secondaryForeground)',
            }"
            @click="pickFile('keyMappingFiles')"
          >文件…</button>
        </template>
      </ArrayEditor>
    </div>

    <div class="flex flex-wrap gap-2">
      <button
        type="button"
        class="text-xs px-2 py-1 rounded"
        :style="{
          background: 'var(--vscode-button-secondaryBackground)',
          color: 'var(--vscode-button-secondaryForeground)',
        }"
        @click="configStore.discoverLocaleFiles()"
      >自动发现语言文件</button>
      <button
        type="button"
        class="text-xs px-2 py-1 rounded"
        :style="{
          background: 'var(--vscode-button-secondaryBackground)',
          color: 'var(--vscode-button-secondaryForeground)',
        }"
        @click="configStore.initializeLocales()"
      >按平台初始化</button>
      <button
        type="button"
        class="text-xs px-2 py-1 rounded"
        :style="{
          background: 'var(--vscode-button-secondaryBackground)',
          color: 'var(--vscode-button-secondaryForeground)',
        }"
        @click="configStore.switchPlatform()"
      >切换平台</button>
    </div>
  </div>
</template>
