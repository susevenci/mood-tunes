<script setup>
import { computed, ref, watch } from 'vue';
import AppIcon from '../ui/AppIcon.vue';
import AudioVisualizer from './AudioVisualizer.vue';
import { useAudioPlayer } from '../../composables/useAudioPlayer.js';
import { EMOTIONS } from '../../core/emotion/taxonomy.js';

const player = useAudioPlayer();
const state = player.state;
const coverError = ref(false);

const meta = computed(() => EMOTIONS[state.current?.emotionTags?.[0]] || EMOTIONS.calm);
const sourceLabel = computed(() => {
  if (!state.current) return '';
  if (state.current.cached) return '已缓存';
  return state.current.source === 'local' ? '本地' : '在线试听';
});
const coverStyle = computed(() => ({
  background: `linear-gradient(145deg, ${meta.value.gradient[0]}, ${meta.value.gradient[1]})`,
}));

watch(
  () => state.current?.id,
  () => {
    coverError.value = false;
  },
);

function format(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const min = Math.floor(total / 60);
  const sec = String(total % 60).padStart(2, '0');
  return `${min}:${sec}`;
}

function onSeek(event) {
  player.seek(Number(event.target.value));
}

function onVolume(event) {
  player.setVolume(Number(event.target.value));
}
</script>

<template>
  <aside class="player-bar" :style="{ '--emotion': meta.color }">
    <div class="now" :class="{ idle: !state.current }">
      <div class="now-cover" :style="state.current && (coverError || !state.current.cover) ? coverStyle : undefined">
        <img
          v-if="state.current?.cover && !coverError"
          :src="state.current.cover"
          :alt="`${state.current.title} 封面`"
          @error="coverError = true"
        />
        <AppIcon v-else :name="state.current ? 'music' : 'wave'" :size="20" />
        <span v-if="state.playing" class="pulse"></span>
      </div>
      <div class="now-text">
        <template v-if="state.current">
          <div class="now-title" :title="state.current.attribution?.text || state.current.title">
            {{ state.current.title }}
          </div>
          <div class="now-sub">
            <span>{{ state.current.artist }}</span>
            <span class="dot"></span>
            <span :class="state.current.cached ? 'success' : ''">{{ sourceLabel }}</span>
            <span v-if="state.current.preview" class="preview">30s</span>
          </div>
        </template>
        <template v-else>
          <div class="now-title">选择一首歌开始播放</div>
          <div class="now-sub">推荐会随情绪实时更新</div>
        </template>
      </div>
    </div>

    <div class="controls">
      <button class="ctrl" type="button" title="上一首" aria-label="上一首" :disabled="!state.queue.length" @click="player.previous()">
        <AppIcon name="prev" :size="17" />
      </button>
      <button
        class="ctrl play"
        type="button"
        :title="state.playing ? '暂停' : '播放'"
        :aria-label="state.playing ? '暂停' : '播放'"
        :disabled="!state.current && !state.queue.length"
        @click="player.toggle()"
      >
        <span v-if="state.loading" class="spinner"></span>
        <AppIcon v-else :name="state.playing ? 'pause' : 'play'" :size="19" />
      </button>
      <button class="ctrl" type="button" title="下一首" aria-label="下一首" :disabled="!state.queue.length" @click="player.next()">
        <AppIcon name="next" :size="17" />
      </button>
    </div>

    <div class="timeline">
      <span class="mono">{{ format(state.time) }}</span>
      <input
        type="range"
        min="0"
        :max="state.duration || 1"
        step="0.1"
        :value="state.time"
        aria-label="播放进度"
        :disabled="!state.current"
        @input="onSeek"
      />
      <span class="mono">{{ format(state.duration) }}</span>
    </div>

    <div class="right">
      <AudioVisualizer />
      <AppIcon name="volume" :size="15" class="vol-icon" />
      <input
        class="volume"
        type="range"
        min="0"
        max="1"
        step="0.05"
        :value="state.volume"
        aria-label="音量"
        @input="onVolume"
      />
      <a
        v-if="state.current?.trackViewUrl"
        class="external"
        :href="state.current.trackViewUrl"
        target="_blank"
        rel="noreferrer"
        title="在来源页面查看"
      >
        <AppIcon name="external" :size="14" />
      </a>
    </div>
  </aside>
</template>

<style scoped>
.player-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 40;
  display: grid;
  grid-template-columns: minmax(200px, 1fr) auto minmax(220px, 1.1fr) auto;
  align-items: center;
  gap: 16px;
  padding: 11px clamp(14px, 2.4vw, 30px);
  border-top: 1px solid var(--border);
  background: linear-gradient(180deg, rgba(9, 14, 26, 0.86), rgba(7, 11, 20, 0.97));
  backdrop-filter: blur(22px);
  box-shadow: 0 -18px 50px rgba(0, 0, 0, 0.35);
}

.now {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.now-cover {
  position: relative;
  display: grid;
  place-items: center;
  flex: 0 0 46px;
  width: 46px;
  height: 46px;
  overflow: hidden;
  border-radius: 11px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: linear-gradient(145deg, var(--emotion), #0a1224);
  color: rgba(8, 16, 32, 0.72);
}

.now-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.pulse {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  border: 1px solid var(--emotion);
  animation: pulse 2s ease-out infinite;
}

@keyframes pulse {
  0% {
    opacity: 0.8;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(1.25);
  }
}

.now-text {
  min-width: 0;
}

.now-title {
  overflow: hidden;
  font-size: 12.5px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.now-sub {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 2px;
  overflow: hidden;
  color: var(--muted);
  font-size: 9.5px;
  white-space: nowrap;
}

.now.idle .now-cover {
  color: var(--muted);
  background: rgba(148, 176, 255, 0.08);
}

.dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--muted-2);
}

.success {
  color: var(--success);
}

.preview {
  padding: 0 4px;
  border-radius: 3px;
  background: rgba(255, 178, 62, 0.12);
  color: var(--warning);
}

.controls {
  display: flex;
  align-items: center;
  gap: 7px;
}

.ctrl {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  color: var(--muted);
  transition: all 0.2s ease;
}

.ctrl:hover {
  color: var(--text);
  background: rgba(148, 176, 255, 0.1);
}

.ctrl:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.ctrl.play {
  width: 40px;
  height: 40px;
  color: #081020;
  background: linear-gradient(140deg, var(--emotion), #d7e6ff);
  box-shadow: 0 8px 24px color-mix(in srgb, var(--emotion) 35%, transparent);
}

.spinner {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid rgba(8, 16, 32, 0.2);
  border-top-color: #081020;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.timeline {
  display: grid;
  grid-template-columns: 34px 1fr 34px;
  align-items: center;
  gap: 8px;
  color: var(--muted-2);
  font-size: 9px;
}

.timeline input {
  width: 100%;
}

.timeline input:disabled {
  opacity: 0.4;
}

.right {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--muted-2);
}

.vol-icon {
  opacity: 0.7;
}

.volume {
  width: 70px;
}

.external {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  color: var(--muted-2);
}

.external:hover {
  color: var(--text);
  background: rgba(148, 176, 255, 0.1);
}

@media (max-width: 980px) {
  .player-bar {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 10px;
  }

  .timeline {
    grid-column: 1 / -1;
    grid-row: 2;
  }

  .right {
    display: none;
  }
}

@media (max-width: 560px) {
  .player-bar {
    padding: 9px 12px;
  }

  .now-cover {
    flex-basis: 38px;
    width: 38px;
    height: 38px;
  }

  .ctrl {
    width: 28px;
    height: 28px;
  }

  .ctrl.play {
    width: 36px;
    height: 36px;
  }
}
</style>
