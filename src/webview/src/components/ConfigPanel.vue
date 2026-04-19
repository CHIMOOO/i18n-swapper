<script setup lang="ts">
import { useConfigStore } from '../stores/configStore';
import { useScanStore } from '../stores/scanStore';
import CollapsibleSection from './config/widgets/CollapsibleSection.vue';
import BasicConfigSection from './config/BasicConfigSection.vue';
import LocalesPathsSection from './config/LocalesPathsSection.vue';
import IdentifySection from './config/IdentifySection.vue';
import ScanSection from './config/ScanSection.vue';
import DecorationSection from './config/DecorationSection.vue';
import TranslationApiSection from './config/TranslationApiSection.vue';
import AutomationSection from './config/AutomationSection.vue';
import PlatformSection from './config/PlatformSection.vue';
import AdvancedSection from './config/AdvancedSection.vue';

const configStore = useConfigStore();
const scanStore = useScanStore();
</script>

<template>
  <div class="p-3 space-y-3">
    <!-- 顶部状态卡 -->
    <section class="flex items-center gap-2">
      <span
        class="text-[11px] px-2 py-0.5 rounded"
        :style="{
          background: 'var(--vscode-badge-background)',
          color: 'var(--vscode-badge-foreground)',
        }"
      >
        {{ configStore.platform === 'auto' ? '自动检测' : String(configStore.platform).toUpperCase() }}
      </span>
      <span
        class="inline-block w-2 h-2 rounded-full"
        :style="{
          backgroundColor: configStore.platformReady
            ? 'var(--vscode-testing-iconPassed, #4caf50)'
            : 'var(--vscode-errorForeground, #f44336)',
        }"
      />
      <span class="text-xs opacity-80">
        {{ configStore.platformReady ? '平台就绪' : '平台未就绪' }}
      </span>
      <button
        type="button"
        class="ml-auto text-[11px] px-2 py-1 rounded"
        :style="{
          background: 'var(--vscode-button-secondaryBackground)',
          color: 'var(--vscode-button-secondaryForeground)',
        }"
        @click="configStore.openSettings()"
      >
        打开 settings.json
      </button>
    </section>

    <!-- 数据统计 -->
    <section class="grid grid-cols-4 gap-2">
      <div class="text-xs p-2 rounded border" :style="{ borderColor: 'var(--vscode-panel-border)' }">
        <div class="text-base font-bold">{{ scanStore.keyCount }}</div>
        <div class="opacity-50">翻译键</div>
      </div>
      <div class="text-xs p-2 rounded border" :style="{ borderColor: 'var(--vscode-panel-border)' }">
        <div class="text-base font-bold">{{ scanStore.languageCodes.length }}</div>
        <div class="opacity-50">语种</div>
      </div>
      <div class="text-xs p-2 rounded border" :style="{ borderColor: 'var(--vscode-panel-border)' }">
        <div class="text-base font-bold">{{ scanStore.totalPending }}</div>
        <div class="opacity-50">待处理</div>
      </div>
      <div class="text-xs p-2 rounded border" :style="{ borderColor: 'var(--vscode-panel-border)' }">
        <div class="text-base font-bold">{{ scanStore.totalExisting }}</div>
        <div class="opacity-50">已国际化</div>
      </div>
    </section>

    <CollapsibleSection
      title="基础设置"
      description="函数名、引号风格、默认语言"
      :default-open="true"
    >
      <BasicConfigSection />
    </CollapsibleSection>

    <CollapsibleSection
      title="源语言文件"
      description="源 key 与机翻输入来源"
      :default-open="true"
      :warning="!configStore.hasLocalesPaths"
      :badge="configStore.localesPaths.length ? String(configStore.localesPaths.length) : undefined"
    >
      <LocalesPathsSection />
    </CollapsibleSection>

    <CollapsibleSection title="识别规则" description="如何在源代码中识别 i18n 调用">
      <IdentifySection />
    </CollapsibleSection>

    <CollapsibleSection title="扫描范围" description="扫描的标签/属性、排除与额外包含路径">
      <ScanSection />
    </CollapsibleSection>

    <CollapsibleSection title="装饰显示" description="编辑器中译文展示样式">
      <DecorationSection />
    </CollapsibleSection>

    <CollapsibleSection
      title="翻译 API"
      description="腾讯云翻译凭据 + 语言映射"
      :badge="configStore.translationConfigured ? '已连' : '未配置'"
      :warning="!configStore.translationConfigured"
    >
      <TranslationApiSection />
    </CollapsibleSection>

    <CollapsibleSection title="自动化" description="替换时的自动行为">
      <AutomationSection />
    </CollapsibleSection>

    <CollapsibleSection title="平台与默认仓库" description="切换平台、Android/iOS 专用配置">
      <PlatformSection />
    </CollapsibleSection>

    <CollapsibleSection title="高级" description="跳过提示等行为微调">
      <AdvancedSection />
    </CollapsibleSection>
  </div>
</template>
