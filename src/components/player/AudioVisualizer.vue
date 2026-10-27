<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useAudioPlayer } from '../../composables/useAudioPlayer.js';

const props = defineProps({
  bars: { type: Number, default: 26 },
});

const player = useAudioPlayer();
const canvas = ref(null);
let raf = 0;
let reduceMotion = false;

function draw() {
  raf = requestAnimationFrame(draw);
  const element = canvas.value;
  if (!element) return;
  const rect = element.getBoundingClientRect();
  if (!rect.width) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (element.width !== Math.round(rect.width * dpr)) {
    element.width = Math.round(rect.width * dpr);
    element.height = Math.round(rect.height * dpr);
  }
  const ctx = element.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);

  const styles = getComputedStyle(element);
  const color = styles.getPropertyValue('--emotion').trim() || '#6ea8ff';
  const data = player.getFrequencyData();
  const playing = player.state.playing && data;
  const count = props.bars;
  const gap = 2;
  const barWidth = Math.max(1.5, (rect.width - gap * (count - 1)) / count);

  ctx.fillStyle = color;
  for (let i = 0; i < count; i += 1) {
    let value = 0.08;
    if (playing) {
      const index = Math.min(data.length - 1, Math.floor((i / count) * data.length * 0.72) + 2);
      value = Math.max(0.06, data[index] / 255);
    } else if (!reduceMotion) {
      value = 0.08 + 0.05 * (0.5 + 0.5 * Math.sin(Date.now() / 700 + i * 0.6));
    }
    const height = Math.max(2, value * rect.height);
    const x = i * (barWidth + gap);
    const y = (rect.height - height) / 2;
    ctx.globalAlpha = playing ? 0.55 + value * 0.45 : 0.26;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, barWidth, height, 2);
    else ctx.rect(x, y, barWidth, height);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

onMounted(() => {
  reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  raf = requestAnimationFrame(draw);
});

onBeforeUnmount(() => cancelAnimationFrame(raf));
</script>

<template>
  <canvas ref="canvas" class="visualizer" aria-hidden="true"></canvas>
</template>

<style scoped>
.visualizer {
  width: 96px;
  height: 26px;
  opacity: 0.9;
}
</style>
