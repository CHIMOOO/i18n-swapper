<script setup lang="ts">
import type { TextStylePayload } from '../../../types/messages';
import ColorInput from './ColorInput.vue';

interface Props {
  modelValue: TextStylePayload;
}

const props = defineProps<Props>();
const emit = defineEmits<{ (e: 'update:modelValue', value: TextStylePayload): void }>();

function patch<K extends keyof TextStylePayload>(key: K, value: TextStylePayload[K]) {
  emit('update:modelValue', { ...props.modelValue, [key]: value });
}

const FONT_WEIGHTS = ['normal', '500', 'bold', 'lighter'];
const FONT_STYLES = ['normal', 'italic'];
</script>

<template>
  <div class="space-y-2 p-2 rounded" :style="{ background: 'var(--vscode-textBlockQuote-background, transparent)' }">
    <ColorInput
      label="颜色"
      :model-value="modelValue.color"
      @update:model-value="(v) => patch('color', v)"
    />
    <label class="flex items-center gap-2 text-xs">
      <span class="opacity-70 shrink-0 w-20">字号</span>
      <input
        :value="modelValue.fontSize"
        @input="(e) => patch('fontSize', (e.target as HTMLInputElement).value)"
        class="flex-1 font-mono text-xs px-2 py-1 rounded outline-none"
        :style="{
          background: 'var(--vscode-input-background)',
          color: 'var(--vscode-input-foreground)',
          border: '1px solid var(--vscode-input-border, transparent)',
        }"
        placeholder="1em / 12px"
      />
    </label>
    <label class="flex items-center gap-2 text-xs">
      <span class="opacity-70 shrink-0 w-20">字重</span>
      <select
        :value="modelValue.fontWeight"
        @change="(e) => patch('fontWeight', (e.target as HTMLSelectElement).value)"
        class="flex-1 text-xs px-2 py-1 rounded"
        :style="{
          background: 'var(--vscode-dropdown-background)',
          color: 'var(--vscode-dropdown-foreground)',
          border: '1px solid var(--vscode-dropdown-border, transparent)',
        }"
      >
        <option v-for="w in FONT_WEIGHTS" :key="w" :value="w">{{ w }}</option>
      </select>
    </label>
    <label class="flex items-center gap-2 text-xs">
      <span class="opacity-70 shrink-0 w-20">字形</span>
      <select
        :value="modelValue.fontStyle"
        @change="(e) => patch('fontStyle', (e.target as HTMLSelectElement).value)"
        class="flex-1 text-xs px-2 py-1 rounded"
        :style="{
          background: 'var(--vscode-dropdown-background)',
          color: 'var(--vscode-dropdown-foreground)',
          border: '1px solid var(--vscode-dropdown-border, transparent)',
        }"
      >
        <option v-for="s in FONT_STYLES" :key="s" :value="s">{{ s }}</option>
      </select>
    </label>
    <label class="flex items-center gap-2 text-xs">
      <span class="opacity-70 shrink-0 w-20">外边距</span>
      <input
        :value="modelValue.margin"
        @input="(e) => patch('margin', (e.target as HTMLInputElement).value)"
        class="flex-1 font-mono text-xs px-2 py-1 rounded outline-none"
        :style="{
          background: 'var(--vscode-input-background)',
          color: 'var(--vscode-input-foreground)',
          border: '1px solid var(--vscode-input-border, transparent)',
        }"
        placeholder="0 0 0 4px"
      />
    </label>
  </div>
</template>
