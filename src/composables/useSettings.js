/**
 * useSettings.js — 全局设置单例（localStorage 持久化）。
 */
import { reactive, watch } from 'vue';
import { loadSettings, saveSettings, resetSettings } from '../core/storage/settings.js';

const settings = reactive(loadSettings());

watch(
  settings,
  (value) => {
    saveSettings(value);
  },
  { deep: true },
);

export function useSettings() {
  return {
    settings,
    reset() {
      Object.assign(settings, resetSettings());
    },
  };
}
