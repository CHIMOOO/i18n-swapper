<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  modelValue: string;
  label?: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>();

/** 提取 hex/#rgba 给 <input type=color>，否则降级为 #999999 */
const colorPreview = computed(() => {
  const v = (props.modelValue || '').trim();
  const hex = v.match(/^#([0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (hex) return v.length === 7 ? v : v.slice(0, 7);
  return '#999999';
});

function onColorPick(e: Event) {
  const v = (e.target as HTMLInputElement).value;
  emit('update:modelValue', v);
}
function onTextInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).value);
}
</script>

<template>
  <label class="flex items-center gap-2 text-xs">
    <span v-if="label" class="opacity-70 shrink-0 w-20">{{ label }}</span>
    <input
      type="color"
      :value="colorPreview"
      class="w-7 h-6 rounded border-0 p-0 cursor-pointer"
      @input="onColorPick"
      aria-label="颜色选择器"
    />
    <input
      type="text"
      :value="modelValue"
      class="flex-1 font-mono text-xs px-2 py-1 rounded outline-none"
      :style="{
        background: 'var(--vscode-input-background)',
        color: 'var(--vscode-input-foreground)',
        border: '1px solid var(--vscode-input-border, transparent)',
      }"
      placeholder="#RRGGBB 或 rgba(...)"
      @input="onTextInput"
    />
  </label>
</template>
