<script setup>
import { computed } from 'vue';
import { EMOTION_ORDER, EMOTIONS } from '../../core/emotion/taxonomy.js';

const props = defineProps({
  probabilities: { type: Object, default: null },
  active: { type: String, default: null },
});

const rows = computed(() =>
  EMOTION_ORDER.map((key) => {
    const meta = EMOTIONS[key];
    const value = Math.max(0, Math.min(1, props.probabilities?.[key] ?? 0));
    return {
      key,
      label: meta.label,
      color: meta.color,
      value,
      percent: value * 100,
      active: props.active === key,
    };
  }),
);
</script>

<template>
  <div class="bars" role="list" aria-label="七类情绪概率">
    <div v-for="row in rows" :key="row.key" class="bar-row" :class="{ active: row.active }" role="listitem">
      <span class="bar-label">{{ row.label }}</span>
      <span class="bar-track">
        <i :style="{ width: row.percent + '%', background: row.color, boxShadow: row.active ? `0 0 14px ${row.color}` : 'none' }"></i>
      </span>
      <span class="bar-value mono">{{ row.percent.toFixed(1) }}%</span>
    </div>
  </div>
</template>

<style scoped>
.bars {
  display: grid;
  gap: 7px;
}

.bar-row {
  display: grid;
  grid-template-columns: 34px 1fr 48px;
  align-items: center;
  gap: 8px;
  opacity: 0.78;
  transition: opacity 0.25s ease;
}

.bar-row.active {
  opacity: 1;
}

.bar-label {
  color: var(--muted);
  font-size: 11px;
  font-weight: 600;
}

.bar-row.active .bar-label {
  color: var(--text);
}

.bar-track {
  position: relative;
  height: 6px;
  border-radius: 99px;
  background: rgba(148, 176, 255, 0.1);
  overflow: hidden;
}

.bar-track i {
  display: block;
  height: 100%;
  min-width: 2px;
  border-radius: inherit;
  transition: width 0.45s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.bar-value {
  color: var(--muted-2);
  font-size: 10px;
  text-align: right;
}
</style>
