<script setup lang="ts">
import { ref } from 'vue';

const greeting = ref('i18n Swapper');
</script>

<template>
  <div class="min-h-screen bg-[var(--vscode-editor-background)] text-[var(--vscode-editor-foreground)] p-4">
    <header class="mb-6">
      <h1 class="text-xl font-bold">{{ greeting }}</h1>
      <p class="text-sm opacity-70 mt-1">国际化管理面板</p>
    </header>

    <main>
      <div class="rounded-lg border border-[var(--vscode-panel-border)] p-4">
        <p class="text-sm">面板功能开发中...</p>
      </div>
    </main>
  </div>
</template>
