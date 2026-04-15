/**
 * VSCode WebView API 通信层
 * 封装 postMessage / onMessage，提供类型安全的消息收发
 */
import { ref, onMounted, onUnmounted } from 'vue';
import type { WebviewMessage, ExtensionMessage } from '../types/messages';

const vscode = acquireVsCodeApi();

type MessageListener = (message: ExtensionMessage) => void;
const listeners = new Set<MessageListener>();

let globalHandlerRegistered = false;

function ensureGlobalHandler() {
  if (globalHandlerRegistered) return;
  globalHandlerRegistered = true;

  window.addEventListener('message', (event: MessageEvent) => {
    const message = event.data as ExtensionMessage;
    listeners.forEach((fn) => fn(message));
  });
}

export function useVscodeApi() {
  ensureGlobalHandler();

  function postMessage(message: WebviewMessage): void {
    vscode.postMessage(message);
  }

  function onMessage(handler: MessageListener): () => void {
    listeners.add(handler);
    return () => listeners.delete(handler);
  }

  function getState<T = unknown>(): T | undefined {
    return vscode.getState() as T | undefined;
  }

  function setState<T = unknown>(state: T): void {
    vscode.setState(state);
  }

  return { postMessage, onMessage, getState, setState };
}

/**
 * 在组件内自动注册/注销消息监听器
 */
export function useMessageListener(handler: MessageListener) {
  const { onMessage } = useVscodeApi();
  let cleanup: (() => void) | undefined;

  onMounted(() => {
    cleanup = onMessage(handler);
  });

  onUnmounted(() => {
    cleanup?.();
  });
}
