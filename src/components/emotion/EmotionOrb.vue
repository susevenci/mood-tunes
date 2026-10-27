<script setup>
import { computed } from 'vue';
import { EMOTIONS } from '../../core/emotion/taxonomy.js';

const props = defineProps({
  emotion: { type: String, default: null },
  candidate: { type: String, default: null },
  confidence: { type: Number, default: 0 },
  uncertain: { type: Boolean, default: false },
  analyzing: { type: Boolean, default: false },
});

const meta = computed(() => EMOTIONS[props.emotion || props.candidate] || EMOTIONS.calm);
const percent = computed(() => Math.round((props.confidence || 0) * 100));
const circumference = 2 * Math.PI * 86;
const dashOffset = computed(() => circumference * (1 - Math.min(1, Math.max(0, props.confidence || 0))));
const label = computed(() => {
  if (props.analyzing) return '分析中';
  if (!props.emotion && !props.candidate) return '等待采集';
  if (props.uncertain) return '情绪不明显';
  return EMOTIONS[props.emotion]?.label ?? '情绪不明显';
});
const subLabel = computed(() => {
  if (props.uncertain) return props.candidate ? `候选 · ${EMOTIONS[props.candidate]?.label ?? ''}` : '请正对镜头';
  return EMOTIONS[props.emotion]?.en ?? 'MOOD';
});
const styleVars = computed(() => ({
  '--orb-a': meta.value.gradient[0],
  '--orb-b': meta.value.gradient[1],
  '--orb-color': meta.value.color,
}));
</script>

<template>
  <div class="orb" :class="{ uncertain }" :style="styleVars">
    <div class="orb-aura" aria-hidden="true"></div>
    <svg class="orb-ring" viewBox="0 0 200 200" aria-hidden="true">
      <circle class="ring-bg" cx="100" cy="100" r="86" />
      <circle
        class="ring-fg"
        cx="100"
        cy="100"
        r="86"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="dashOffset"
      />
    </svg>
    <div class="orb-core">
      <span class="orb-label">{{ label }}</span>
      <span class="orb-sub">{{ subLabel }}</span>
      <div class="orb-score">
        {{ percent }}<small>%</small>
      </div>
      <span class="orb-caption">{{ uncertain ? '置信度不足' : '置信度' }}</span>
    </div>
  </div>
</template>

<style scoped>
.orb {
  position: relative;
  width: min(210px, 60%);
  aspect-ratio: 1;
  margin: 0 auto;
  display: grid;
  place-items: center;
}

.orb-aura {
  position: absolute;
  inset: 8%;
  border-radius: 50%;
  background: radial-gradient(circle, var(--orb-color), transparent 68%);
  opacity: 0.26;
  filter: blur(26px);
  animation: aura 4.5s ease-in-out infinite;
}

.orb-ring {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.ring-bg {
  fill: none;
  stroke: rgba(148, 176, 255, 0.1);
  stroke-width: 7;
}

.ring-fg {
  fill: none;
  stroke: var(--orb-color);
  stroke-width: 7;
  stroke-linecap: round;
  filter: drop-shadow(0 0 8px var(--orb-color));
  transition: stroke-dashoffset 0.5s ease, stroke 0.4s ease;
}

.orb-core {
  position: relative;
  display: grid;
  place-items: center;
  width: 76%;
  aspect-ratio: 1;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background:
    radial-gradient(circle at 32% 24%, rgba(255, 255, 255, 0.22), transparent 42%),
    linear-gradient(145deg, var(--orb-a), var(--orb-b));
  box-shadow:
    inset 0 0 60px rgba(0, 0, 0, 0.35),
    0 22px 60px color-mix(in srgb, var(--orb-color) 30%, transparent);
  color: #07101f;
  text-align: center;
}

.orb-label {
  margin-top: 8%;
  font-size: clamp(20px, 2.4vw, 30px);
  font-weight: 800;
  letter-spacing: 0.04em;
  line-height: 1.1;
  color: #081020;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.18);
}

.orb-sub {
  margin-top: 3px;
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.18em;
  color: rgba(8, 16, 32, 0.62);
  text-transform: uppercase;
}

.orb-score {
  margin-top: 4px;
  font-size: clamp(26px, 3vw, 38px);
  font-weight: 800;
  line-height: 1;
  color: #081020;
}

.orb-score small {
  font-size: 0.42em;
  font-weight: 700;
  margin-left: 2px;
}

.orb-caption {
  margin-bottom: 10%;
  color: rgba(8, 16, 32, 0.55);
  font-size: 9px;
  letter-spacing: 0.12em;
}

.orb.uncertain .orb-core {
  filter: saturate(0.55);
}

.orb.uncertain .orb-label {
  font-size: clamp(16px, 2vw, 22px);
}

@keyframes aura {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.22;
  }
  50% {
    transform: scale(1.08);
    opacity: 0.34;
  }
}
</style>
