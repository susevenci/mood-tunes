<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { drawOverlay } from '../../core/emotion/overlay.js';

const props = defineProps({
  faces: { type: Array, default: () => [] },
  workWidth: { type: Number, default: 0 },
  workHeight: { type: Number, default: 0 },
  mirrored: { type: Boolean, default: false },
  primaryOnly: { type: Boolean, default: false },
  aspect: { type: String, default: '16 / 10' },
  hint: { type: String, default: '' },
});

const stage = ref(null);
const canvas = ref(null);
let observer = null;

function draw() {
  if (!stage.value || !canvas.value) return;
  drawOverlay(canvas.value, stage.value, props.faces, props.workWidth, props.workHeight, {
    mirrored: props.mirrored,
    primaryOnly: props.primaryOnly,
  });
}

onMounted(() => {
  observer = new ResizeObserver(() => draw());
  observer.observe(stage.value);
  requestAnimationFrame(draw);
});

onBeforeUnmount(() => {
  observer?.disconnect();
});

watch(
  () => props.faces,
  () => requestAnimationFrame(draw),
);
watch(
  () => [props.workWidth, props.workHeight, props.mirrored, props.primaryOnly],
  () => requestAnimationFrame(draw),
);
</script>

<template>
  <div ref="stage" class="media-stage" :style="{ aspectRatio: aspect }">
    <slot />
    <canvas ref="canvas" class="media-overlay" aria-hidden="true"></canvas>
    <div v-if="hint" class="media-hint">{{ hint }}</div>
  </div>
</template>

<style scoped>
.media-stage {
  position: relative;
  width: 100%;
  overflow: hidden;
  border-radius: 16px;
  border: 1px solid var(--border);
  background:
    radial-gradient(circle at 50% 40%, rgba(110, 168, 255, 0.08), transparent 60%),
    #050810;
}

.media-stage :deep(img),
.media-stage :deep(video) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.media-stage :deep(video.mirror) {
  transform: scaleX(-1);
}

.media-overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.media-hint {
  position: absolute;
  left: 12px;
  bottom: 12px;
  max-width: calc(100% - 24px);
  padding: 6px 10px;
  border-radius: 9px;
  border: 1px solid var(--border);
  background: rgba(5, 8, 16, 0.78);
  color: var(--muted);
  font-size: 11.5px;
  backdrop-filter: blur(8px);
}
</style>
