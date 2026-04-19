<script setup lang="ts">
import { computed, ref } from 'vue';
import { useConfigStore } from '../../stores/configStore';

const configStore = useConfigStore();

const SOURCE_LANG_OPTIONS = ['zh', 'en', 'ja', 'ko', 'fr', 'de', 'es', 'pt', 'ru', 'th', 'vi'];
const REGION_OPTIONS = [
  'ap-guangzhou',
  'ap-shanghai',
  'ap-beijing',
  'ap-hongkong',
  'ap-singapore',
  'na-siliconvalley',
];

const showSecret = ref(false);

function update(key: string, value: unknown) {
  configStore.updateConfig(key, value);
}

const draftCode = ref('');
const draftPath = ref('');

function addMapping() {
  const code = draftCode.value.trim();
  const path = draftPath.value.trim();
  if (!code || !path) return;
  if (configStore.languageMappings.some((m) => m.languageCode === code)) {
    draftCode.value = '';
    draftPath.value = '';
    return;
  }
  configStore.setLanguageMappings([
    ...configStore.languageMappings,
    { languageCode: code, filePath: path },
  ]);
  draftCode.value = '';
  draftPath.value = '';
}

function removeMapping(code: string) {
  configStore.setLanguageMappings(
    configStore.languageMappings.filter((m) => m.languageCode !== code)
  );
}

function updateMapping(code: string, patch: Partial<{ languageCode: string; filePath: string }>) {
  configStore.setLanguageMappings(
    configStore.languageMappings.map((m) =>
      m.languageCode === code ? { ...m, ...patch } : m
    )
  );
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

const testIndicator = computed(() => {
  const r = configStore.lastTestResult;
  if (!r) return null;
  return {
    color: r.success
      ? 'var(--vscode-testing-iconPassed, #4caf50)'
      : 'var(--vscode-errorForeground, #f44336)',
    text: r.message,
  };
});
</script>

<template>
  <div class="space-y-4">
    <p class="text-[11px] opacity-60">
      用于"机翻 → 写入语言文件"。腾讯云翻译 API 凭据保存在 VS Code workspace 设置中，仅本机可见。
    </p>

    <label class="grid grid-cols-[6rem_1fr] items-center gap-2 text-xs">
      <span class="opacity-70">SecretId</span>
      <input
        :value="configStore.apiKey"
        @change="(e) => update('tencentTranslation.apiKey', (e.target as HTMLInputElement).value)"
        class="font-mono text-xs px-2 py-1 rounded outline-none"
        :style="inputStyle"
        autocomplete="off"
        placeholder="腾讯云 SecretId"
      />
    </label>

    <label class="grid grid-cols-[6rem_1fr] items-center gap-2 text-xs">
      <span class="opacity-70">SecretKey</span>
      <div class="flex items-stretch gap-1">
        <input
          :value="configStore.apiSecret"
          :type="showSecret ? 'text' : 'password'"
          @change="(e) => update('tencentTranslation.apiSecret', (e.target as HTMLInputElement).value)"
          class="flex-1 font-mono text-xs px-2 py-1 rounded outline-none"
          :style="inputStyle"
          autocomplete="off"
          placeholder="腾讯云 SecretKey"
        />
        <button
          type="button"
          class="text-xs px-2 rounded shrink-0"
          :style="{
            background: 'var(--vscode-button-secondaryBackground)',
            color: 'var(--vscode-button-secondaryForeground)',
          }"
          @click="showSecret = !showSecret"
        >{{ showSecret ? '隐藏' : '显示' }}</button>
      </div>
    </label>

    <label class="grid grid-cols-[6rem_1fr] items-center gap-2 text-xs">
      <span class="opacity-70">区域</span>
      <select
        :value="configStore.apiRegion"
        @change="(e) => update('tencentTranslation.region', (e.target as HTMLSelectElement).value)"
        class="text-xs px-2 py-1 rounded"
        :style="dropdownStyle"
      >
        <option v-for="r in REGION_OPTIONS" :key="r" :value="r">{{ r }}</option>
      </select>
    </label>

    <label class="grid grid-cols-[6rem_1fr] items-center gap-2 text-xs">
      <span class="opacity-70">源语言</span>
      <select
        :value="configStore.sourceLanguage"
        @change="(e) => update('tencentTranslation.sourceLanguage', (e.target as HTMLSelectElement).value)"
        class="text-xs px-2 py-1 rounded"
        :style="dropdownStyle"
      >
        <option v-for="l in SOURCE_LANG_OPTIONS" :key="l" :value="l">{{ l }}</option>
      </select>
    </label>

    <div class="flex items-center gap-2">
      <button
        type="button"
        class="text-xs px-3 py-1 rounded"
        :style="{
          background: 'var(--vscode-button-background)',
          color: 'var(--vscode-button-foreground)',
        }"
        @click="configStore.testTranslationApi()"
      >
        测试连接
      </button>
      <span
        v-if="testIndicator"
        class="text-[11px]"
        :style="{ color: testIndicator.color }"
      >{{ testIndicator.text }}</span>
      <span v-else class="text-[11px] opacity-50">
        {{ configStore.translationConfigured ? '✓ 已配置 SecretId/SecretKey' : '尚未配置' }}
      </span>
    </div>

    <div>
      <h4 class="text-xs font-medium mb-1">语言映射</h4>
      <p class="text-[11px] opacity-60 mb-2">
        将语言代码映射到对应的语言文件路径，机翻结果会写入这些文件。
      </p>

      <ul v-if="configStore.languageMappings.length > 0" class="space-y-1 mb-2">
        <li
          v-for="m in configStore.languageMappings"
          :key="m.languageCode"
          class="grid grid-cols-[5rem_1fr_auto] items-center gap-1 text-xs"
        >
          <input
            :value="m.languageCode"
            @change="(e) => updateMapping(m.languageCode, { languageCode: (e.target as HTMLInputElement).value })"
            class="font-mono text-xs px-2 py-1 rounded outline-none"
            :style="inputStyle"
          />
          <input
            :value="m.filePath"
            @change="(e) => updateMapping(m.languageCode, { filePath: (e.target as HTMLInputElement).value })"
            class="font-mono text-xs px-2 py-1 rounded outline-none truncate"
            :style="inputStyle"
          />
          <button
            type="button"
            class="text-[11px] px-1.5 py-1 rounded"
            :style="{
              background: 'var(--vscode-button-secondaryBackground)',
              color: 'var(--vscode-button-secondaryForeground)',
            }"
            @click="removeMapping(m.languageCode)"
          >✕</button>
        </li>
      </ul>
      <p v-else class="text-[11px] opacity-50 mb-2">尚未配置任何语言映射</p>

      <div class="grid grid-cols-[5rem_1fr_auto] items-center gap-1 text-xs">
        <input
          v-model="draftCode"
          placeholder="en"
          class="font-mono text-xs px-2 py-1 rounded outline-none"
          :style="inputStyle"
        />
        <input
          v-model="draftPath"
          placeholder="src/locales/en.json"
          class="font-mono text-xs px-2 py-1 rounded outline-none"
          :style="inputStyle"
        />
        <button
          type="button"
          class="text-xs px-2 rounded"
          :style="{
            background: 'var(--vscode-button-background)',
            color: 'var(--vscode-button-foreground)',
          }"
          @click="addMapping"
        >添加</button>
      </div>
    </div>
  </div>
</template>
