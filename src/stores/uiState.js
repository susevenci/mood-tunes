/**
 * uiState.js — 轻量全局 UI 状态与 toast。
 */
import { reactive } from 'vue';

export const uiState = reactive({
  tab: 'image',
  settingsOpen: false,
  creditsOpen: false,
  algorithmOpen: false,
  toasts: [],
});

let seq = 0;

export function dismissToast(id) {
  const index = uiState.toasts.findIndex((item) => item.id === id);
  if (index >= 0) uiState.toasts.splice(index, 1);
}

export function toast(message, type = 'info', duration = 3600) {
  const id = ++seq;
  uiState.toasts.push({ id, message, type });
  if (duration > 0) {
    window.setTimeout(() => dismissToast(id), duration);
  }
  return id;
}

export function openSettings() {
  uiState.settingsOpen = true;
}

export function closeSettings() {
  uiState.settingsOpen = false;
}

export function openCredits() {
  uiState.creditsOpen = true;
}

export function closeCredits() {
  uiState.creditsOpen = false;
}

export function openAlgorithm() {
  uiState.algorithmOpen = true;
}

export function closeAlgorithm() {
  uiState.algorithmOpen = false;
}
