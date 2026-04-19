<script setup lang="ts">
import { useConfigStore } from '../../stores/configStore';
import StyleEditor from './widgets/StyleEditor.vue';
import ColorInput from './widgets/ColorInput.vue';
import type { TextStylePayload, MissingKeyStylePayload } from '../../types/messages';

const configStore = useConfigStore();

function setSuffix(v: TextStylePayload) {
  configStore.updateConfig('suffixStyle', v);
}
function setInline(v: TextStylePayload) {
  configStore.updateConfig('inlineStyle', v);
}
function setMissing(patch: Partial<MissingKeyStylePayload>) {
  configStore.updateConfig('missingKeyStyle', { ...configStore.missingKeyStyle, ...patch });
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

const BORDER_STYLES = ['solid', 'dashed', 'dotted', 'double'] as const;
</script>

<template>
  <div class="space-y-4">
    <label class="grid grid-cols-[6rem_1fr] items-center gap-2 text-xs">
      <span class="opacity-70">展示模式</span>
      <select
        :value="configStore.decorationStyle"
        @change="(e) => configStore.updateConfig('decorationStyle', (e.target as HTMLSelectElement).value)"
        class="text-xs px-2 py-1 rounded"
        :style="dropdownStyle"
      >
        <option value="inline">inline（内联替换显示译文）</option>
        <option value="suffix">suffix（行尾追加译文）</option>
      </select>
    </label>

    <label class="flex items-center gap-2 text-xs">
      <input
        type="checkbox"
        :checked="configStore.showFullFormInEditMode"
        @change="(e) => configStore.updateConfig('showFullFormInEditMode', (e.target as HTMLInputElement).checked)"
      />
      <span class="opacity-80">编辑当前行时显示完整 i18n 调用</span>
    </label>

    <div>
      <h4 class="text-xs font-medium mb-1">行尾装饰（suffix）样式</h4>
      <StyleEditor
        :model-value="configStore.suffixStyle"
        @update:model-value="setSuffix"
      />
    </div>

    <div>
      <h4 class="text-xs font-medium mb-1">内联装饰（inline）样式</h4>
      <StyleEditor
        :model-value="configStore.inlineStyle"
        @update:model-value="setInline"
      />
    </div>

    <div>
      <h4 class="text-xs font-medium mb-1">缺失 key 边框样式</h4>
      <div class="space-y-2 p-2 rounded" :style="{ background: 'var(--vscode-textBlockQuote-background, transparent)' }">
        <ColorInput
          label="边框颜色"
          :model-value="configStore.missingKeyStyle.borderColor"
          @update:model-value="(v) => setMissing({ borderColor: v })"
        />
        <label class="flex items-center gap-2 text-xs">
          <span class="opacity-70 shrink-0 w-20">边框宽度</span>
          <input
            :value="configStore.missingKeyStyle.borderWidth"
            @change="(e) => setMissing({ borderWidth: (e.target as HTMLInputElement).value })"
            class="flex-1 font-mono text-xs px-2 py-1 rounded outline-none"
            :style="inputStyle"
            placeholder="1px"
          />
        </label>
        <label class="flex items-center gap-2 text-xs">
          <span class="opacity-70 shrink-0 w-20">边框风格</span>
          <select
            :value="configStore.missingKeyStyle.borderStyle"
            @change="(e) => setMissing({ borderStyle: (e.target as HTMLSelectElement).value as MissingKeyStylePayload['borderStyle'] })"
            class="flex-1 text-xs px-2 py-1 rounded"
            :style="dropdownStyle"
          >
            <option v-for="s in BORDER_STYLES" :key="s" :value="s">{{ s }}</option>
          </select>
        </label>
        <label class="flex items-center gap-2 text-xs">
          <span class="opacity-70 shrink-0 w-20">间距</span>
          <input
            :value="configStore.missingKeyStyle.borderSpacing"
            @change="(e) => setMissing({ borderSpacing: (e.target as HTMLInputElement).value })"
            class="flex-1 font-mono text-xs px-2 py-1 rounded outline-none"
            :style="inputStyle"
            placeholder="2px"
          />
        </label>
      </div>
    </div>
  </div>
</template>
