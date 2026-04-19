<script setup lang="ts">
import { useConfigStore } from '../../stores/configStore';

const configStore = useConfigStore();

const QUOTE_OPTIONS = [
  { value: 'single', label: "单引号 ' " },
  { value: 'double', label: '双引号 "' },
] as const;

const LOCALE_OPTIONS = [
  'zh-CN',
  'zh-TW',
  'en',
  'en-US',
  'ja',
  'ko',
  'fr',
  'de',
  'es',
  'pt',
  'ru',
  'th',
  'vi',
];

const inputStyle = {
  background: 'var(--vscode-input-background)',
  color: 'var(--vscode-input-foreground)',
  border: '1px solid var(--vscode-input-border, transparent)',
};

const dropdownStyle = {
  background: 'var(--vscode-dropdown-background)',
  color: 'var(--vscode-dropdown-foreground)',
  border: '1px solid var(--vscode-dropdown-border, transparent)',
};
</script>

<template>
  <div class="space-y-3">
    <div class="grid grid-cols-[6rem_1fr] items-start gap-2 text-xs">
      <span class="opacity-70 mt-1">i18n 函数名</span>
      <div class="flex flex-col gap-1">
        <select
          v-if="configStore.availableFunctionNames.length > 0"
          :value="configStore.functionName"
          @change="(e) => configStore.updateConfig('functionName', (e.target as HTMLSelectElement).value)"
          class="text-xs px-2 py-1 rounded"
          :style="dropdownStyle"
        >
          <option
            v-for="name in configStore.availableFunctionNames"
            :key="name"
            :value="name"
          >
            {{ name }}{{ name === configStore.platformDefaultFunctionName ? '（平台默认）' : '' }}
          </option>
        </select>
        <input
          v-else
          :value="configStore.functionName"
          @change="(e) => configStore.updateConfig('functionName', (e.target as HTMLInputElement).value)"
          class="font-mono text-xs px-2 py-1 rounded outline-none"
          :style="inputStyle"
          placeholder="t / $t / i18n.t"
        />
        <p class="text-[10px] opacity-60 leading-tight">
          当前生效：<code class="font-mono">{{ configStore.effectiveFunctionName }}</code>
          <span v-if="configStore.platformName"> ·  跟随平台「{{ configStore.platformName }}」</span>
        </p>
      </div>
    </div>

    <label class="grid grid-cols-[6rem_1fr] items-center gap-2 text-xs">
      <span class="opacity-70">引号类型</span>
      <select
        :value="configStore.quoteType"
        @change="(e) => configStore.updateConfig('quoteType', (e.target as HTMLSelectElement).value)"
        class="text-xs px-2 py-1 rounded"
        :style="dropdownStyle"
      >
        <option v-for="o in QUOTE_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
    </label>

    <label class="grid grid-cols-[6rem_1fr] items-center gap-2 text-xs">
      <span class="opacity-70">默认语言</span>
      <select
        :value="configStore.defaultLocale"
        @change="(e) => configStore.updateConfig('defaultLocale', (e.target as HTMLSelectElement).value)"
        class="text-xs px-2 py-1 rounded"
        :style="dropdownStyle"
      >
        <option v-for="o in LOCALE_OPTIONS" :key="o" :value="o">{{ o }}</option>
      </select>
    </label>
  </div>
</template>
