<script setup lang="ts">
import { useConfigStore } from '../../stores/configStore';
import ArrayEditor from './widgets/ArrayEditor.vue';
import MatchPatternEditor from './widgets/MatchPatternEditor.vue';

const configStore = useConfigStore();

function addFn(v: string) {
  configStore.addArrayItem('identifyFunctionNames', v);
}
function removeFn(v: string) {
  configStore.removeArrayItem('identifyFunctionNames', v);
}
function updatePatterns(value: import('../../types/messages').MatchPatternPayload[]) {
  configStore.updateConfig('matchPatterns', value);
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <h4 class="text-xs font-medium mb-1">i18n 函数名（识别用）</h4>
      <p class="text-[11px] opacity-60 mb-2">
        扫描时会识别这些函数名包裹的字符串作为已国际化文本，例如 <code>t('foo.bar')</code>。
      </p>
      <ArrayEditor
        :model-value="configStore.identifyFunctionNames"
        placeholder="如：t / $t / i18n.t"
        mono
        empty-hint="尚未配置识别函数名"
        @add="addFn"
        @remove="removeFn"
      />
    </div>

    <div>
      <h4 class="text-xs font-medium mb-1">自定义匹配规则</h4>
      <p class="text-[11px] opacity-60 mb-2">
        自定义正则表达式补充识别能力（按平台默认规则之外）。
      </p>
      <MatchPatternEditor
        :model-value="configStore.matchPatterns"
        @update:model-value="updatePatterns"
      />
    </div>
  </div>
</template>
