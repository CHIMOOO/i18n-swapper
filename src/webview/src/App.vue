<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useVscodeApi } from './composables/useVscodeApi';
import { useNotification } from './composables/useNotification';
import { useConfigStore } from './stores/configStore';
import { useScanStore } from './stores/scanStore';
import FilterToolbar from './components/FilterToolbar.vue';
import ScanResultList from './components/ScanResultList.vue';
import LanguageStatusTable from './components/LanguageStatusTable.vue';
import ConfigPanel from './components/ConfigPanel.vue';
import ActionBar from './components/ActionBar.vue';
import KeySearchPanel from './components/KeySearchPanel.vue';

type TabId = 'scan' | 'status' | 'search' | 'config';

const { postMessage, getState, setState } = useVscodeApi();
const { notifications, dismiss } = useNotification();
const configStore = useConfigStore();
const scanStore = useScanStore();

const activeTab = ref<TabId>((getState<{ tab: TabId }>()?.tab) || 'scan');

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'scan', label: '扫描替换' },
  { id: 'status', label: '翻译状态' },
  { id: 'search', label: '键名搜索' },
  { id: 'config', label: '配置' },
];

function switchTab(id: TabId) {
  activeTab.value = id;
  setState({ tab: id });
}

onMounted(() => {
  postMessage({ command: 'ready' });
});
</script>

<template>
  <div class="flex flex-col h-screen bg-[var(--vscode-editor-background)] text-[var(--vscode-editor-foreground)]">
    <!-- 标签栏 -->
    <div class="flex border-b border-[var(--vscode-panel-border)] bg-[var(--vscode-sideBar-background)]">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="px-4 py-2 text-xs font-medium transition-colors relative"
        :class="{
          'opacity-100': activeTab === tab.id,
          'opacity-50 hover:opacity-70': activeTab !== tab.id,
        }"
        @click="switchTab(tab.id)"
      >
        {{ tab.label }}
        <div
          v-if="activeTab === tab.id"
          class="absolute bottom-0 left-0 right-0 h-0.5"
          style="background: var(--vscode-focusBorder)"
        />
      </button>
    </div>

    <!-- 内容区 -->
    <div class="flex-1 overflow-hidden flex flex-col">
      <!-- 扫描替换 -->
      <template v-if="activeTab === 'scan'">
        <FilterToolbar />
        <ScanResultList />
      </template>

      <!-- 翻译状态 -->
      <div v-if="activeTab === 'status'" class="flex-1 overflow-y-auto">
        <LanguageStatusTable />
      </div>

      <!-- 键名搜索 -->
      <div v-if="activeTab === 'search'" class="flex-1 overflow-y-auto">
        <KeySearchPanel />
      </div>

      <!-- 配置 -->
      <div v-if="activeTab === 'config'" class="flex-1 overflow-y-auto">
        <ConfigPanel />
      </div>
    </div>

    <!-- 底部操作栏 -->
    <ActionBar />

    <!-- 通知弹窗 -->
    <div class="fixed top-2 right-2 z-50 flex flex-col gap-1.5 max-w-[280px]">
      <transition-group name="notification">
        <div
          v-for="n in notifications"
          :key="n.id"
          class="px-3 py-2 rounded text-xs shadow-lg cursor-pointer"
          :style="{
            background: n.type === 'error'
              ? 'var(--vscode-inputValidation-errorBackground, #5a1d1d)'
              : 'var(--vscode-inputValidation-infoBackground, #063b49)',
            border: `1px solid ${
              n.type === 'error'
                ? 'var(--vscode-inputValidation-errorBorder, #be1100)'
                : 'var(--vscode-inputValidation-infoBorder, #007acc)'
            }`,
          }"
          @click="dismiss(n.id)"
        >
          {{ n.message }}
        </div>
      </transition-group>
    </div>
  </div>
</template>

<style scoped>
.notification-enter-active,
.notification-leave-active {
  transition: all 0.3s ease;
}
.notification-enter-from {
  opacity: 0;
  transform: translateX(20px);
}
.notification-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
</style>
