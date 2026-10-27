<script setup>
import { EMOTIONS } from '../../core/emotion/taxonomy.js';

defineProps({
  history: { type: Array, default: () => [] },
});

const emit = defineEmits(['select', 'clear']);

function time(ts) {
  try {
    return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function confidence(value) {
  return `${Math.round((value || 0) * 100)}%`;
}
</script>

<template>
  <div class="history">
    <div class="history-head">
      <span>情绪轨迹</span>
      <button v-if="history.length" class="link-btn" type="button" @click="emit('clear')">清空</button>
    </div>
    <div v-if="history.length" class="history-list">
      <button
        v-for="item in history"
        :key="item.ts + item.emotion"
        class="history-chip"
        type="button"
        :style="{ '--chip-color': EMOTIONS[item.emotion]?.color || '#6ea8ff' }"
        :title="`${EMOTIONS[item.emotion]?.label || item.emotion} · ${confidence(item.confidence)}`"
        @click="emit('select', item.emotion)"
      >
        <i></i>
        <span>{{ EMOTIONS[item.emotion]?.label || item.emotion }}</span>
        <em class="mono">{{ confidence(item.confidence) }}</em>
        <small>{{ time(item.ts) }}</small>
      </button>
    </div>
    <p v-else class="history-empty">完成一次识别后，这里会记录情绪变化。</p>
  </div>
</template>

<style scoped>
.history {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--border);
}

.history-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--muted);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.link-btn {
  color: var(--muted-2);
  font-size: 10px;
}

.link-btn:hover {
  color: var(--danger);
}

.history-list {
  display: flex;
  gap: 6px;
  margin-top: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.history-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex: 0 0 auto;
  height: 26px;
  padding: 0 8px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: rgba(148, 176, 255, 0.05);
  color: var(--text);
  font-size: 10px;
  transition: all 0.2s ease;
}

.history-chip:hover {
  border-color: var(--chip-color);
  background: rgba(148, 176, 255, 0.1);
}

.history-chip i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--chip-color);
  box-shadow: 0 0 8px var(--chip-color);
}

.history-chip em {
  color: var(--muted);
  font-style: normal;
}

.history-chip small {
  color: var(--muted-2);
  font-size: 9px;
}

.history-empty {
  margin-top: 7px;
  color: var(--muted-2);
  font-size: 10.5px;
}
</style>
