<script setup lang="ts">
import { ref } from 'vue';

interface Props {
  /** 数组项展示文本 */
  modelValue: string[];
  /** 新项输入提示 */
  placeholder?: string;
  /** 是否使用 monospace 字体 */
  mono?: boolean;
  /** 空状态文案 */
  emptyHint?: string;
  /** 是否禁止内联添加（仅用按钮添加） */
  inputDisabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '输入新项后按 Enter 添加',
  mono: false,
  emptyHint: '尚未配置',
  inputDisabled: false,
});

const emit = defineEmits<{
  (e: 'add', value: string): void;
  (e: 'remove', value: string, index: number): void;
}>();

const draft = ref('');

function commit() {
  const value = draft.value.trim();
  if (!value) return;
  emit('add', value);
  draft.value = '';
}
</script>

<template>
  <div class="space-y-2">
    <ul v-if="modelValue.length > 0" class="space-y-1">
      <li
        v-for="(item, idx) in modelValue"
        :key="`${item}-${idx}`"
        class="flex items-center gap-2 text-xs"
      >
        <slot name="item-prefix" :item="item" :index="idx" />
        <span
          class="flex-1 min-w-0 truncate px-1.5 py-1 rounded"
          :class="mono ? 'font-mono' : ''"
          :style="{
            background: 'var(--vscode-input-background)',
            color: 'var(--vscode-input-foreground, var(--vscode-foreground))',
            border: '1px solid var(--vscode-input-border, transparent)',
          }"
          :title="item"
        >{{ item }}</span>
        <button
          type="button"
          class="text-[11px] px-1.5 py-0.5 rounded shrink-0"
          :style="{
            background: 'var(--vscode-button-secondaryBackground)',
            color: 'var(--vscode-button-secondaryForeground)',
          }"
          @click="emit('remove', item, idx)"
          aria-label="移除"
          title="移除"
        >✕</button>
      </li>
    </ul>
    <p v-else class="text-[11px] opacity-50">{{ emptyHint }}</p>

    <div class="flex items-stretch gap-1">
      <input
        v-model="draft"
        :placeholder="placeholder"
        :disabled="inputDisabled"
        class="flex-1 text-xs px-2 py-1 rounded outline-none"
        :class="mono ? 'font-mono' : ''"
        :style="{
          background: 'var(--vscode-input-background)',
          color: 'var(--vscode-input-foreground)',
          border: '1px solid var(--vscode-input-border, transparent)',
        }"
        @keydown.enter.prevent="commit"
      />
      <button
        type="button"
        class="text-xs px-2 rounded"
        :style="{
          background: 'var(--vscode-button-background)',
          color: 'var(--vscode-button-foreground)',
        }"
        @click="commit"
      >
        添加
      </button>
      <slot name="extra" />
    </div>
  </div>
</template>
