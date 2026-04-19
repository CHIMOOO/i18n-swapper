<script setup lang="ts">
import { ref, watch } from 'vue';

interface Props {
  title: string;
  description?: string;
  /** 默认是否展开 */
  defaultOpen?: boolean;
  /** 右上角徽标文本 */
  badge?: string;
  /** 是否显示警告图标 */
  warning?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  defaultOpen: false,
  warning: false,
});

const open = ref(props.defaultOpen);

watch(
  () => props.defaultOpen,
  (v) => {
    open.value = v;
  }
);

function toggle() {
  open.value = !open.value;
}
</script>

<template>
  <section
    class="rounded border"
    :style="{ borderColor: 'var(--vscode-panel-border)' }"
  >
    <button
      type="button"
      class="w-full flex items-center gap-2 px-3 py-2 text-left text-xs"
      :style="{ background: 'var(--vscode-sideBarSectionHeader-background)' }"
      @click="toggle"
    >
      <span class="opacity-70" aria-hidden="true">{{ open ? '▾' : '▸' }}</span>
      <span class="font-medium flex-1">{{ title }}</span>
      <span
        v-if="warning"
        class="text-[10px] px-1.5 py-0.5 rounded"
        :style="{
          background: 'var(--vscode-inputValidation-warningBackground, #f4c20d33)',
          color: 'var(--vscode-inputValidation-warningForeground, inherit)',
        }"
      >
        !
      </span>
      <span
        v-if="badge"
        class="text-[10px] px-1.5 py-0.5 rounded"
        :style="{
          background: 'var(--vscode-badge-background)',
          color: 'var(--vscode-badge-foreground)',
        }"
      >
        {{ badge }}
      </span>
    </button>

    <div v-show="open" class="px-3 py-3 space-y-3">
      <p v-if="description" class="text-[11px] opacity-60 -mt-1">{{ description }}</p>
      <slot />
    </div>
  </section>
</template>
