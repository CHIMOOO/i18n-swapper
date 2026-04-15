<script setup lang="ts">
import { useConfigStore } from '../stores/configStore';
import { useScanStore } from '../stores/scanStore';

const configStore = useConfigStore();
const scanStore = useScanStore();
</script>

<template>
  <div class="p-3 space-y-4">
    <!-- 平台 -->
    <section>
      <h3 class="text-xs font-medium opacity-70 mb-1.5">平台</h3>
      <div class="flex items-center gap-2">
        <span
          class="text-xs px-2 py-0.5 rounded"
          style="background: var(--vscode-badge-background); color: var(--vscode-badge-foreground)"
        >
          {{ configStore.platform === 'auto' ? '自动检测' : configStore.platform.toUpperCase() }}
        </span>
      </div>
    </section>

    <!-- 语言文件路径 -->
    <section>
      <h3 class="text-xs font-medium opacity-70 mb-1.5">源语言文件</h3>
      <div v-if="configStore.localesPaths.length > 0" class="space-y-1 mb-2">
        <div
          v-for="(p, idx) in configStore.localesPaths"
          :key="idx"
          class="flex items-center gap-1 text-xs"
        >
          <span class="truncate flex-1 opacity-80" :title="p">{{ p }}</span>
        </div>
      </div>
      <p v-else class="text-xs opacity-40 mb-2">未配置源语言文件</p>
      <button
        class="text-xs px-2 py-1 rounded
               bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)]
               hover:bg-[var(--vscode-button-secondaryHoverBackground)]"
        @click="configStore.selectLocaleFiles()"
      >
        选择语言文件
      </button>
    </section>

    <!-- 语言映射 -->
    <section>
      <h3 class="text-xs font-medium opacity-70 mb-1.5">语言文件映射</h3>
      <div v-if="configStore.languageMappings.length > 0" class="space-y-1 mb-2">
        <div
          v-for="(m, idx) in configStore.languageMappings"
          :key="idx"
          class="flex items-center gap-2 text-xs"
        >
          <span
            class="shrink-0 px-1.5 py-0.5 rounded"
            style="background: var(--vscode-badge-background); color: var(--vscode-badge-foreground)"
          >
            {{ m.languageCode }}
          </span>
          <span class="truncate flex-1 opacity-70">{{ m.filePath }}</span>
        </div>
      </div>
      <p v-else class="text-xs opacity-40 mb-2">未配置语言映射（翻译功能将不可用）</p>
      <button
        class="text-xs px-2 py-1 rounded
               bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)]
               hover:bg-[var(--vscode-button-secondaryHoverBackground)]"
        @click="configStore.openSettings('i18n-swapper.tencentTranslation.languageMappings')"
      >
        配置映射
      </button>
    </section>

    <!-- 翻译 API -->
    <section>
      <h3 class="text-xs font-medium opacity-70 mb-1.5">翻译 API</h3>
      <div class="flex items-center gap-2 mb-2">
        <span
          class="inline-block w-2 h-2 rounded-full"
          :style="{
            backgroundColor: configStore.translationConfigured
              ? 'var(--vscode-testing-iconPassed, #4caf50)'
              : 'var(--vscode-errorForeground, #f44336)',
          }"
        />
        <span class="text-xs">
          {{ configStore.translationConfigured ? '已配置' : '未配置' }}
        </span>
      </div>
      <button
        class="text-xs px-2 py-1 rounded
               bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)]
               hover:bg-[var(--vscode-button-secondaryHoverBackground)]"
        @click="configStore.openSettings('i18n-swapper.tencentTranslation')"
      >
        配置翻译 API
      </button>
    </section>

    <!-- 功能设置 -->
    <section>
      <h3 class="text-xs font-medium opacity-70 mb-1.5">功能设置</h3>
      <div class="space-y-2">
        <div class="flex items-center gap-2 text-xs">
          <span class="opacity-70">函数名:</span>
          <code class="px-1 py-0.5 rounded bg-[var(--vscode-textCodeBlock-background)]">
            {{ configStore.functionName }}()
          </code>
        </div>
        <div class="flex items-center gap-2 text-xs">
          <span class="opacity-70">引号:</span>
          <span>{{ configStore.quoteType === 'single' ? "单引号 (')" : '双引号 (")' }}</span>
        </div>
        <div class="flex items-center gap-2 text-xs">
          <span class="opacity-70">装饰模式:</span>
          <span>{{ configStore.decorationStyle === 'inline' ? '内联替换' : '后缀显示' }}</span>
        </div>
      </div>
    </section>

    <!-- 统计 -->
    <section>
      <h3 class="text-xs font-medium opacity-70 mb-1.5">数据统计</h3>
      <div class="grid grid-cols-2 gap-2">
        <div class="text-xs p-2 rounded border border-[var(--vscode-panel-border)]">
          <div class="text-lg font-bold">{{ scanStore.keyCount }}</div>
          <div class="opacity-50">翻译键</div>
        </div>
        <div class="text-xs p-2 rounded border border-[var(--vscode-panel-border)]">
          <div class="text-lg font-bold">{{ scanStore.languageCodes.length }}</div>
          <div class="opacity-50">语种</div>
        </div>
        <div class="text-xs p-2 rounded border border-[var(--vscode-panel-border)]">
          <div class="text-lg font-bold">{{ scanStore.totalPending }}</div>
          <div class="opacity-50">待处理</div>
        </div>
        <div class="text-xs p-2 rounded border border-[var(--vscode-panel-border)]">
          <div class="text-lg font-bold">{{ scanStore.totalExisting }}</div>
          <div class="opacity-50">已国际化</div>
        </div>
      </div>
    </section>

    <!-- 打开完整设置 -->
    <button
      class="w-full text-xs px-2 py-1.5 rounded
             bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)]
             hover:bg-[var(--vscode-button-secondaryHoverBackground)]"
      @click="configStore.openSettings()"
    >
      打开完整设置
    </button>
  </div>
</template>
