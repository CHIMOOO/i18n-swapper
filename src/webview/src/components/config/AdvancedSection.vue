<script setup lang="ts">
import { useConfigStore } from '../../stores/configStore';
import ArrayEditor from './widgets/ArrayEditor.vue';

const configStore = useConfigStore();

function add(v: string) {
  configStore.addArrayItem('skipPrompt', v);
}
function remove(v: string) {
  configStore.removeArrayItem('skipPrompt', v);
}
</script>

<template>
  <div class="space-y-3">
    <p class="text-[11px] opacity-60">
      跳过这些操作的二次确认（如：<code>switchPlatform</code>、<code>discoverLocales</code>）。
    </p>
    <ArrayEditor
      :model-value="configStore.skipPrompt"
      placeholder="如：switchPlatform"
      mono
      empty-hint="未跳过任何提示"
      @add="add"
      @remove="remove"
    />
  </div>
</template>
