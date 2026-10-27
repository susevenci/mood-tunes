<script setup>
import AppIcon from './AppIcon.vue';
import { dismissToast, uiState } from '../../stores/uiState.js';

const icons = {
  success: 'check',
  error: 'alert',
  warning: 'alert',
  info: 'info',
};
</script>

<template>
  <Teleport to="body">
    <TransitionGroup name="toast" tag="div" class="toast-host">
      <button
        v-for="item in uiState.toasts"
        :key="item.id"
        class="toast"
        :class="item.type"
        type="button"
        @click="dismissToast(item.id)"
      >
        <AppIcon :name="icons[item.type] || 'info'" :size="16" />
        <span>{{ item.message }}</span>
        <AppIcon name="close" :size="13" class="toast-close" />
      </button>
    </TransitionGroup>
  </Teleport>
</template>

<style scoped>
.toast-host {
  position: fixed;
  top: 78px;
  right: clamp(12px, 2vw, 26px);
  z-index: 100;
  display: grid;
  gap: 8px;
  width: min(340px, calc(100vw - 24px));
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 11px 12px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: rgba(13, 21, 39, 0.96);
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.45);
  color: var(--text);
  font-size: 11.5px;
  line-height: 1.45;
  text-align: left;
  pointer-events: auto;
  backdrop-filter: blur(14px);
}

.toast span {
  flex: 1;
}

.toast-close {
  opacity: 0.45;
  flex: 0 0 auto;
}

.toast.success {
  border-color: rgba(46, 214, 179, 0.32);
  color: var(--success);
}

.toast.error {
  border-color: rgba(255, 90, 95, 0.34);
  color: var(--danger);
}

.toast.warning {
  border-color: rgba(255, 178, 62, 0.32);
  color: var(--warning);
}

.toast.info {
  color: var(--accent);
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.22s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(18px);
}
</style>
