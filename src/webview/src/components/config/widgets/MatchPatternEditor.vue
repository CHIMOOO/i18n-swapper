<script setup lang="ts">
import { ref } from 'vue';
import type { MatchPatternPayload } from '../../../types/messages';

interface Props {
  modelValue: MatchPatternPayload[];
}

const props = defineProps<Props>();
const emit = defineEmits<{ (e: 'update:modelValue', value: MatchPatternPayload[]): void }>();

const draft = ref<MatchPatternPayload>({
  source: '',
  flags: 'g',
  keyGroup: 1,
  fileTypes: ['*'],
});

function update(idx: number, patch: Partial<MatchPatternPayload>) {
  const next = props.modelValue.map((p, i) => (i === idx ? { ...p, ...patch } : p));
  emit('update:modelValue', next);
}

function remove(idx: number) {
  emit('update:modelValue', props.modelValue.filter((_, i) => i !== idx));
}

function add() {
  if (!draft.value.source.trim()) return;
  emit('update:modelValue', [
    ...props.modelValue,
    {
      source: draft.value.source,
      flags: draft.value.flags || 'g',
      keyGroup: Number(draft.value.keyGroup) || 1,
      fileTypes: draft.value.fileTypes && draft.value.fileTypes.length > 0 ? draft.value.fileTypes : ['*'],
    },
  ]);
  draft.value = { source: '', flags: 'g', keyGroup: 1, fileTypes: ['*'] };
}

function joinTypes(types: string[]) {
  return (types || []).join(',');
}
function parseTypes(value: string): string[] {
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

const inputBaseStyle = {
  background: 'var(--vscode-input-background)',
  color: 'var(--vscode-input-foreground)',
  border: '1px solid var(--vscode-input-border, transparent)',
};
</script>

<template>
  <div class="space-y-2">
    <ul v-if="modelValue.length > 0" class="space-y-2">
      <li
        v-for="(p, idx) in modelValue"
        :key="idx"
        class="rounded p-2 space-y-1"
        :style="{ background: 'var(--vscode-textBlockQuote-background, transparent)' }"
      >
        <div class="flex items-center gap-1 text-[11px] opacity-60">
          <span>正则 #{{ idx + 1 }}</span>
          <button
            type="button"
            class="ml-auto px-1.5 py-0.5 rounded text-[11px]"
            :style="{
              background: 'var(--vscode-button-secondaryBackground)',
              color: 'var(--vscode-button-secondaryForeground)',
            }"
            @click="remove(idx)"
          >移除</button>
        </div>
        <div class="grid grid-cols-[auto_1fr] gap-1 text-xs items-center">
          <span class="opacity-70">source</span>
          <input
            :value="p.source"
            @input="(e) => update(idx, { source: (e.target as HTMLInputElement).value })"
            class="font-mono text-xs px-2 py-1 rounded outline-none"
            :style="inputBaseStyle"
          />
          <span class="opacity-70">flags</span>
          <input
            :value="p.flags"
            @input="(e) => update(idx, { flags: (e.target as HTMLInputElement).value })"
            class="font-mono text-xs px-2 py-1 rounded outline-none"
            :style="inputBaseStyle"
            placeholder="g / gi / gm"
          />
          <span class="opacity-70">keyGroup</span>
          <input
            type="number"
            min="0"
            :value="p.keyGroup"
            @input="(e) => update(idx, { keyGroup: Number((e.target as HTMLInputElement).value) || 0 })"
            class="font-mono text-xs px-2 py-1 rounded outline-none"
            :style="inputBaseStyle"
          />
          <span class="opacity-70">fileTypes</span>
          <input
            :value="joinTypes(p.fileTypes)"
            @input="(e) => update(idx, { fileTypes: parseTypes((e.target as HTMLInputElement).value) })"
            class="font-mono text-xs px-2 py-1 rounded outline-none"
            :style="inputBaseStyle"
            placeholder="ts,tsx,vue 或 *"
          />
        </div>
      </li>
    </ul>
    <p v-else class="text-[11px] opacity-50">尚未自定义匹配规则（将使用平台内置规则）</p>

    <div class="rounded p-2 space-y-1 border border-dashed" :style="{ borderColor: 'var(--vscode-panel-border)' }">
      <div class="text-[11px] opacity-60">添加新规则</div>
      <div class="grid grid-cols-[auto_1fr] gap-1 text-xs items-center">
        <span class="opacity-70">source</span>
        <input
          v-model="draft.source"
          class="font-mono text-xs px-2 py-1 rounded outline-none"
          :style="inputBaseStyle"
          placeholder='如：t\(\s*[\"\u0027]([^\"\u0027]+)[\"\u0027]'
        />
        <span class="opacity-70">flags</span>
        <input
          v-model="draft.flags"
          class="font-mono text-xs px-2 py-1 rounded outline-none"
          :style="inputBaseStyle"
        />
        <span class="opacity-70">keyGroup</span>
        <input
          v-model.number="draft.keyGroup"
          type="number"
          min="0"
          class="font-mono text-xs px-2 py-1 rounded outline-none"
          :style="inputBaseStyle"
        />
        <span class="opacity-70">fileTypes</span>
        <input
          :value="joinTypes(draft.fileTypes)"
          @input="(e) => (draft.fileTypes = parseTypes((e.target as HTMLInputElement).value))"
          class="font-mono text-xs px-2 py-1 rounded outline-none"
          :style="inputBaseStyle"
          placeholder="ts,tsx,vue 或 *"
        />
      </div>
      <div class="flex justify-end">
        <button
          type="button"
          class="text-xs px-2 py-1 rounded"
          :style="{
            background: 'var(--vscode-button-background)',
            color: 'var(--vscode-button-foreground)',
          }"
          @click="add"
        >添加规则</button>
      </div>
    </div>
  </div>
</template>
