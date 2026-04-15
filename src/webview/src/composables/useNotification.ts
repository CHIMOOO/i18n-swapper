/**
 * 通知消息 composable
 * 处理来自扩展侧的 info/error 消息并展示
 */
import { ref } from 'vue';
import { useMessageListener } from './useVscodeApi';

export interface Notification {
  id: number;
  type: 'info' | 'error';
  message: string;
}

let nextId = 0;

export function useNotification() {
  const notifications = ref<Notification[]>([]);

  function addNotification(type: 'info' | 'error', message: string) {
    const id = nextId++;
    notifications.value.push({ id, type, message });
    setTimeout(() => {
      notifications.value = notifications.value.filter((n) => n.id !== id);
    }, 4000);
  }

  function dismiss(id: number) {
    notifications.value = notifications.value.filter((n) => n.id !== id);
  }

  useMessageListener((msg) => {
    if (msg.command === 'info') {
      addNotification('info', msg.payload.message);
    } else if (msg.command === 'error') {
      addNotification('error', msg.payload.message);
    }
  });

  return { notifications, dismiss };
}
