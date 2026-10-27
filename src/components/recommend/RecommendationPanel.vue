<script setup>
import { computed } from 'vue';
import AppIcon from '../ui/AppIcon.vue';
import SongCard from './SongCard.vue';
import { useRecommendations } from '../../composables/useRecommendations.js';
import { useSettings } from '../../composables/useSettings.js';
import { useAudioPlayer } from '../../composables/useAudioPlayer.js';
import { EMOTIONS } from '../../core/emotion/taxonomy.js';
import { MODE_ORDER, RECOMMEND_MODES } from '../../core/recommend/profiles.js';

const recs = useRecommendations();
const { settings } = useSettings();
const player = useAudioPlayer();

const state = recs.state;
const profile = computed(() => state.profile);
const meta = computed(() => EMOTIONS[profile.value?.emotion] || EMOTIONS.calm);
const target = computed(() => state.target || { valence: 0, arousal: 0 });
const list = computed(() => state.list || []);
const modeInfo = computed(() => RECOMMEND_MODES[settings.mode] || RECOMMEND_MODES.smart);
const blendPercent = computed(() => Math.round((state.blend ?? 0) * 100));
const tuneText = computed(() => {
  const value = Math.round((settings.tune || 0) * 100);
  return `${value > 0 ? '+' : ''}${value}%`;
});
const showsRepair = computed(
  () => !state.uncertain && profile.value && profile.value.repairEmotion !== profile.value.emotion,
);

function play(index) {
  player.playQueue(
    list.value.map((item) => item.song),
    index,
  );
}

function cache(item) {
  recs.cacheSong(item.song);
}

function remove(item) {
  recs.removeCached(item.song);
}

function toggleOnline() {
  settings.online = !settings.online;
}
</script>

<template>
  <section class="panel rec-panel">
    <div class="panel-head">
      <div>
        <div class="panel-title"><AppIcon name="music" :size="17" /> 为你推荐</div>
        <div class="panel-sub">
          {{
            state.uncertain
              ? '情绪不明显 · 先来点舒缓的'
              : `匹配「${profile?.label || '平静'}」· ${modeInfo.short} · 目标 V ${target.valence.toFixed(2)} / A ${target.arousal.toFixed(2)}`
          }}
        </div>
      </div>
      <div class="head-actions">
        <button
          class="chip"
          :class="settings.online ? 'success' : ''"
          type="button"
          :title="settings.online ? '关闭在线补充' : '开启在线补充'"
          @click="toggleOnline"
        >
          <AppIcon name="wave" :size="12" /> 在线 {{ settings.online ? '开' : '关' }}
        </button>
        <button class="icon-btn" type="button" title="换一批" aria-label="换一批" @click="recs.shuffle()">
          <AppIcon name="shuffle" :size="17" />
        </button>
      </div>
    </div>

    <div class="mode-bar">
      <div class="modes" role="radiogroup" aria-label="推荐模式">
        <button
          v-for="key in MODE_ORDER"
          :key="key"
          class="mode"
          :class="{ active: settings.mode === key }"
          type="button"
          role="radio"
          :aria-checked="settings.mode === key"
          :title="RECOMMEND_MODES[key].desc"
          @click="settings.mode = key"
        >
          <AppIcon :name="RECOMMEND_MODES[key].icon" :size="14" />
          <span>{{ RECOMMEND_MODES[key].label }}</span>
        </button>
      </div>

      <p class="mode-desc">
        {{ modeInfo.desc }}
        <b class="mono">共鸣 {{ blendPercent }}%</b>
        <span v-if="showsRepair">· 修复目标 {{ profile.repairLabel }}</span>
      </p>

      <div v-if="settings.mode === 'smart'" class="tune">
        <span>偏修复</span>
        <input
          v-model.number="settings.tune"
          type="range"
          min="-0.3"
          max="0.3"
          step="0.05"
          aria-label="智能模式微调"
        />
        <span>偏共鸣</span>
        <em class="mono">{{ tuneText }}</em>
      </div>
    </div>

    <div v-if="state.uncertain" class="notice">
      <AppIcon name="info" :size="14" />
      置信度不足，已自动切到平静方案；你也可以继续采集更清晰的正脸。
    </div>

    <div v-if="state.onlineError" class="notice warning">
      <AppIcon name="offline" :size="14" /> {{ state.onlineError }}
    </div>

    <div class="rec-list">
      <template v-if="state.loading && !list.length">
        <div v-for="n in 3" :key="n" class="skeleton-card">
          <span class="skeleton-cover"></span>
          <span class="skeleton-lines"><i></i><i></i><i></i></span>
        </div>
      </template>

      <SongCard
        v-for="(item, index) in list"
        :key="item.song.id"
        :item="item"
        :index="index"
        :cache-progress="state.cacheProgress[item.song.id] ?? null"
        @play="play(index)"
        @cache="cache(item)"
        @remove="remove(item)"
      />

      <div v-if="state.onlineLoading" class="online-loading">
        <span class="spinner" aria-hidden="true"></span>
        正在补充在线试听…
      </div>

      <div v-if="!state.loading && !list.length" class="empty">
        <AppIcon name="music" :size="28" />
        <strong>还没有推荐</strong>
        <span>完成一次情绪识别，或先听一首本地曲目。</span>
      </div>
    </div>

    <div class="rec-foot">
      <span><AppIcon name="database" :size="12" /> 本地 7 首 · 已缓存 {{ state.cachedCount }} 首</span>
      <span class="sep"></span>
      <span>iTunes 30 秒试听</span>
      <span class="sep"></span>
      <span :style="{ color: meta.color }">第 {{ state.seed + 1 }} 批</span>
    </div>
  </section>
</template>

<style scoped>
.rec-panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.head-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.strategy-bar {
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  align-items: center;
  gap: 8px;
  margin: 0 18px 10px;
  padding: 7px 10px;
  border-radius: 11px;
  border: 1px solid var(--border);
  background: rgba(5, 8, 16, 0.35);
  color: var(--muted-2);
  font-size: 10px;
}

.strategy-bar em {
  color: var(--muted);
  font-style: normal;
}

.notice {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 18px 9px;
  padding: 7px 9px;
  border-radius: 9px;
  border: 1px solid rgba(110, 168, 255, 0.18);
  background: rgba(110, 168, 255, 0.06);
  color: var(--muted);
  font-size: 10.5px;
}

.notice.warning {
  border-color: rgba(255, 178, 62, 0.24);
  background: rgba(255, 178, 62, 0.06);
  color: var(--warning);
}

.rec-list {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 8px;
  min-width: 0;
  padding: 0 18px 12px;
}

.skeleton-card {
  display: flex;
  gap: 12px;
  padding: 11px;
  border-radius: 15px;
  border: 1px solid var(--border);
  background: rgba(10, 16, 30, 0.4);
}

.skeleton-cover {
  width: 64px;
  height: 64px;
  border-radius: 12px;
  background: linear-gradient(100deg, rgba(148, 176, 255, 0.08), rgba(148, 176, 255, 0.16), rgba(148, 176, 255, 0.08));
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
}

.skeleton-lines {
  display: grid;
  align-content: center;
  gap: 8px;
  flex: 1;
}

.skeleton-lines i {
  height: 8px;
  border-radius: 99px;
  background: rgba(148, 176, 255, 0.1);
}

.skeleton-lines i:nth-child(1) {
  width: 55%;
}

.skeleton-lines i:nth-child(2) {
  width: 35%;
}

.skeleton-lines i:nth-child(3) {
  width: 75%;
}

@keyframes shimmer {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: -100% 0;
  }
}

.online-loading {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--muted-2);
  font-size: 10.5px;
  padding: 2px 3px;
}

.spinner {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid rgba(148, 176, 255, 0.2);
  border-top-color: var(--accent);
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.empty {
  display: grid;
  justify-items: center;
  gap: 4px;
  padding: 28px 12px;
  color: var(--muted-2);
  text-align: center;
}

.empty strong {
  color: var(--text);
  font-size: 13px;
}

.empty span {
  font-size: 10.5px;
}

.rec-foot {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: auto;
  padding: 9px 18px 13px;
  border-top: 1px solid var(--border);
  color: var(--muted-2);
  font-size: 9.5px;
  flex-wrap: wrap;
}

.rec-foot span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.sep {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--muted-2);
}
</style>
