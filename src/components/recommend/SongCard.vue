<script setup>
import { computed, ref, watch } from 'vue';
import AppIcon from '../ui/AppIcon.vue';
import { EMOTIONS } from '../../core/emotion/taxonomy.js';

const props = defineProps({
  item: { type: Object, required: true },
  index: { type: Number, default: 0 },
  cacheProgress: { type: Number, default: null },
});

const emit = defineEmits(['play', 'cache', 'remove']);

const coverError = ref(false);
const detailsOpen = ref(false);

const song = computed(() => props.item.song);
const meta = computed(() => EMOTIONS[song.value.emotionTags?.[0] || song.value.mainEmotion] || EMOTIONS.calm);
const sourceLabel = computed(() => {
  if (song.value.cached) return '已缓存';
  if (song.value.source === 'local') return '本地';
  return '在线';
});
const sourceTone = computed(() => {
  if (song.value.cached) return 'success';
  if (song.value.source === 'local') return 'local';
  return 'online';
});
const reasons = computed(() => (props.item.reasons || []).slice(0, 2));
const score = computed(() => Math.round(props.item.score || 0));
const cached = computed(() => !!song.value.cached);
const canCache = computed(() => song.value.source === 'itunes' && !song.value.cached);
const coverStyle = computed(() => ({
  background: `linear-gradient(145deg, ${meta.value.gradient[0]}, ${meta.value.gradient[1]})`,
}));

watch(
  () => song.value.id,
  () => {
    coverError.value = false;
    detailsOpen.value = false;
  },
);
</script>

<template>
  <article class="song-card" :class="{ playing: false }">
    <button
      class="cover"
      type="button"
      :style="coverError || !song.cover ? coverStyle : undefined"
      :aria-label="`播放 ${song.title}`"
      @click="emit('play')"
    >
      <img v-if="song.cover && !coverError" :src="song.cover" :alt="`${song.title} 封面`" loading="lazy" @error="coverError = true" />
      <span v-else class="cover-fallback">{{ song.title.slice(0, 1) }}</span>
      <span class="cover-play"><AppIcon name="play" :size="16" /></span>
    </button>

    <div class="song-main">
      <div class="song-top">
        <div class="song-title-wrap">
          <h3 class="song-title" :title="song.title">{{ song.title }}</h3>
          <p class="song-artist" :title="song.artist">{{ song.artist }}</p>
        </div>
        <span class="song-score mono">{{ score }}</span>
      </div>

      <div class="song-meta">
        <span class="badge" :class="sourceTone">{{ sourceLabel }}</span>
        <span v-if="song.preview" class="badge preview">30s 试听</span>
        <span class="badge genre">{{ song.genre }}</span>
        <span v-if="song.local" class="badge offline"><AppIcon name="offline" :size="10" /> 可离线</span>
      </div>

      <div class="reason-row">
        <span v-for="reason in reasons" :key="reason" class="reason">{{ reason }}</span>
      </div>

      <div class="score-track" :title="`综合匹配分 ${score}/100`">
        <i :style="{ width: score + '%', background: meta.color }"></i>
      </div>

      <div class="song-actions">
        <button class="mini-btn" type="button" @click="emit('play')">
          <AppIcon name="play" :size="13" /> 播放
        </button>
        <button
          v-if="canCache"
          class="mini-btn"
          type="button"
          :disabled="cacheProgress != null"
          @click="emit('cache')"
        >
          <AppIcon name="download" :size="13" />
          {{ cacheProgress != null ? `缓存 ${Math.round(cacheProgress * 100)}%` : '缓存到本地' }}
        </button>
        <button v-if="cached" class="mini-btn success" type="button" @click="emit('remove')">
          <AppIcon name="check" :size="13" /> 已缓存
        </button>
        <button class="mini-btn ghost" type="button" @click="detailsOpen = !detailsOpen">
          <AppIcon name="info" :size="13" /> {{ detailsOpen ? '收起' : '推荐依据' }}
        </button>
        <a
          v-if="song.trackViewUrl"
          class="mini-btn ghost"
          :href="song.trackViewUrl"
          target="_blank"
          rel="noreferrer"
          title="在来源页面查看"
        >
          <AppIcon name="external" :size="13" />
        </a>
      </div>

      <div v-if="detailsOpen" class="breakdown">
        <div v-for="(value, key) in item.breakdown" :key="key" class="breakdown-row">
          <span>{{
            { tag: '标签匹配', valence: '效价接近', arousal: '唤醒度接近', freshness: '新鲜度', local: '本地加成', jitter: '种子抖动' }[key] || key
          }}</span>
          <em class="mono">+{{ Number(value).toFixed(1) }}</em>
        </div>
        <p v-if="song.attribution?.text" class="attribution">{{ song.attribution.text }}</p>
      </div>
    </div>
  </article>
</template>

<style scoped>
.song-card {
  display: flex;
  min-width: 0;
  gap: 12px;
  padding: 11px;
  border-radius: 15px;
  border: 1px solid var(--border);
  background:
    linear-gradient(150deg, rgba(255, 255, 255, 0.035), transparent 50%),
    rgba(10, 16, 30, 0.55);
  transition:
    border-color 0.2s ease,
    transform 0.2s ease,
    background 0.2s ease;
}

.song-card:hover {
  border-color: var(--border-strong);
  background:
    linear-gradient(150deg, rgba(255, 255, 255, 0.05), transparent 50%),
    rgba(16, 25, 46, 0.7);
  transform: translateY(-1px);
}

.cover {
  position: relative;
  flex: 0 0 64px;
  width: 64px;
  height: 64px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: rgba(8, 16, 32, 0.8);
}

.cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-fallback {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  font-size: 26px;
  font-weight: 800;
  color: rgba(8, 16, 32, 0.72);
}

.cover-play {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: #fff;
  background: rgba(4, 8, 16, 0.58);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.cover:hover .cover-play {
  opacity: 1;
}

.song-main {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 5px;
  flex: 1;
  min-width: 0;
}

.song-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}

.song-title-wrap {
  flex: 1;
  min-width: 0;
}

.song-title {
  max-width: 100%;
  overflow: hidden;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.song-artist {
  overflow: hidden;
  color: var(--muted);
  font-size: 10.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.song-score {
  color: var(--muted);
  font-size: 13px;
  font-weight: 700;
}

.song-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  min-width: 0;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  height: 18px;
  padding: 0 6px;
  border-radius: 5px;
  border: 1px solid var(--border);
  background: rgba(148, 176, 255, 0.06);
  color: var(--muted);
  font-size: 9px;
  font-weight: 600;
}

.badge.local {
  color: var(--success);
  border-color: rgba(46, 214, 179, 0.24);
  background: rgba(46, 214, 179, 0.07);
}

.badge.online {
  color: var(--accent);
  border-color: rgba(110, 168, 255, 0.24);
  background: rgba(110, 168, 255, 0.07);
}

.badge.success {
  color: var(--success);
}

.badge.preview {
  color: var(--warning);
  border-color: rgba(255, 178, 62, 0.22);
  background: rgba(255, 178, 62, 0.06);
}

.badge.offline {
  color: var(--muted);
}

.reason-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.reason {
  display: inline-flex;
  align-items: center;
  height: 18px;
  padding: 0 6px;
  border-radius: 5px;
  background: var(--emotion-soft);
  color: var(--emotion);
  font-size: 9px;
  font-weight: 600;
}

.score-track {
  height: 3px;
  border-radius: 99px;
  background: rgba(148, 176, 255, 0.09);
  overflow: hidden;
}

.score-track i {
  display: block;
  height: 100%;
  border-radius: inherit;
  opacity: 0.8;
}

.song-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  align-items: center;
  min-width: 0;
}

.mini-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 24px;
  padding: 0 7px;
  border-radius: 7px;
  border: 1px solid var(--border);
  background: rgba(148, 176, 255, 0.06);
  color: var(--muted);
  font-size: 9.5px;
  font-weight: 600;
  transition: all 0.2s ease;
}

.mini-btn:hover {
  color: var(--text);
  border-color: var(--border-strong);
  background: rgba(148, 176, 255, 0.12);
}

.mini-btn:disabled {
  opacity: 0.5;
  cursor: wait;
}

.mini-btn.success {
  color: var(--success);
  border-color: rgba(46, 214, 179, 0.24);
}

.mini-btn.ghost {
  background: transparent;
}

.breakdown {
  display: grid;
  gap: 3px;
  margin-top: 3px;
  padding: 7px 8px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: rgba(5, 8, 16, 0.42);
}

.breakdown-row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  color: var(--muted-2);
  font-size: 9.5px;
}

.breakdown-row em {
  color: var(--muted);
  font-style: normal;
}

.attribution {
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px dashed var(--border);
  color: var(--muted-2);
  font-size: 8.5px;
  line-height: 1.4;
}
</style>
