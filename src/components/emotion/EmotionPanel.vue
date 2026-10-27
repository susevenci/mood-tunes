<script setup>
import { computed, ref, watch } from 'vue';
import AppIcon from '../ui/AppIcon.vue';
import EmotionOrb from './EmotionOrb.vue';
import EmotionBars from './EmotionBars.vue';
import FeatureDebug from './FeatureDebug.vue';
import EmotionHistory from './EmotionHistory.vue';
import { EMOTIONS } from '../../core/emotion/taxonomy.js';
import { useRecommendations } from '../../composables/useRecommendations.js';
import { useSettings } from '../../composables/useSettings.js';

const props = defineProps({
  analysis: { type: Object, required: true },
});

const { settings } = useSettings();
const recs = useRecommendations();

const showDebug = ref(settings.debug);
watch(
  () => settings.debug,
  (value) => {
    showDebug.value = value;
  },
);

const state = computed(() => props.analysis.state);
const result = computed(() => state.value.result);
const meta = computed(() => EMOTIONS[result.value?.emotion || result.value?.candidate || 'calm']);

const status = computed(() => {
  if (state.value.engine.status === 'error') return { text: '模型异常', tone: 'danger' };
  if (state.value.engine.status === 'loading') return { text: '模型加载中', tone: 'warning' };
  if (state.value.status === 'analyzing') return { text: '分析中', tone: 'warning' };
  if (result.value?.uncertain) return { text: '情绪不明显', tone: 'warning' };
  if (result.value?.emotion) return { text: '情绪稳定', tone: 'success' };
  if (state.value.status === 'live') return { text: '实时识别中', tone: 'success' };
  if (state.value.status === 'paused' && state.value.faceCount === 0) {
    return { text: '未检测到人脸', tone: 'warning' };
  }
  return { text: '等待采集', tone: '' };
});

const ariaText = computed(() => {
  if (!result.value) return '尚未识别到情绪';
  if (result.value.uncertain) {
    return `情绪不明显，候选 ${EMOTIONS[result.value.candidate]?.label || ''}，置信度 ${Math.round(
      result.value.confidence * 100,
    )}%`;
  }
  return `识别结果 ${EMOTIONS[result.value.emotion]?.label || ''}，置信度 ${Math.round(
    result.value.confidence * 100,
  )}%`;
});

const qualityWarnings = computed(() => result.value?.quality?.penalties ?? []);
const enginePercent = computed(() => Math.round((state.value.engine.progress || 0) * 100));

function selectHistory(emotion) {
  recs.setEmotion(emotion);
}
</script>

<template>
  <section class="panel emotion-panel">
    <div class="panel-head">
      <div>
        <div class="panel-title"><AppIcon name="wave" :size="17" /> 情绪识别</div>
        <div class="panel-sub">7 类情绪 · 置信度 · 可解释特征</div>
      </div>
      <div class="head-tools">
        <span class="chip dot" :class="status.tone">{{ status.text }}</span>
        <button
          v-if="result"
          class="icon-btn tiny"
          type="button"
          :title="showDebug ? '隐藏算法调试' : '显示算法调试'"
          :aria-pressed="showDebug"
          @click="showDebug = !showDebug"
        >
          <AppIcon name="eye" :size="16" />
        </button>
      </div>
    </div>

    <div class="emotion-body">
      <p class="sr-only" aria-live="polite">{{ ariaText }}</p>

      <div v-if="state.engine.status === 'loading'" class="loading-note">
        <div class="loading-row">
          <span>{{ state.engine.step }}</span>
          <span class="mono">{{ enginePercent }}%</span>
        </div>
        <div class="loading-track"><i :style="{ width: enginePercent + '%' }"></i></div>
      </div>

      <EmotionOrb
        :emotion="result?.emotion || null"
        :candidate="result?.candidate || null"
        :confidence="result?.confidence || 0"
        :uncertain="!!result?.uncertain"
        :analyzing="state.status === 'analyzing'"
      />

      <div class="mood-caption">
        <template v-if="result">
          <strong :style="{ color: meta.color }">{{ result.uncertain ? '情绪不明显' : meta.label }}</strong>
          <span v-if="result.uncertain && result.candidate">
            最接近「{{ EMOTIONS[result.candidate]?.label }}」，建议先听点舒缓的
          </span>
          <span v-else>{{ meta.hint }}</span>
        </template>
        <template v-else>
          <strong>等待一张脸</strong>
          <span>上传图片、打开视频或开启摄像头开始分析</span>
        </template>
      </div>

      <div class="bars-wrap">
        <EmotionBars :probabilities="result?.probabilities || null" :active="result?.emotion || result?.candidate" />
      </div>

      <div v-if="qualityWarnings.length" class="quality-chips">
        <span v-for="item in qualityWarnings" :key="item.code" class="chip warning">
          <AppIcon name="alert" :size="12" /> {{ item.message }}
        </span>
      </div>

      <div v-if="state.faceCount > 1" class="multi-face">
        <AppIcon name="info" :size="14" /> 检测到 {{ state.faceCount }} 张人脸，已分析最大人脸
      </div>

      <FeatureDebug
        v-if="showDebug && result"
        :result="result"
        :engine="state.engine"
        :inference-ms="state.inferenceMs"
        :fps="state.fps"
      />

      <div v-else-if="!result" class="steps">
        <div><b>01</b><span>选择采集方式，画面不离开浏览器</span></div>
        <div><b>02</b><span>模型检测最大人脸并提取 68 个关键点</span></div>
        <div><b>03</b><span>几何规则与表情 CNN 融合为 7 类概率</span></div>
        <div><b>04</b><span>按情绪目标向量生成可解释的歌单</span></div>
      </div>

      <EmotionHistory
        :history="state.history"
        @select="selectHistory"
        @clear="analysis.clearHistory()"
      />

      <p class="disclaimer">识别结果仅用于娱乐与演示，不构成心理或医学建议。</p>
    </div>
  </section>
</template>

<style scoped>
.emotion-panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.head-tools {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon-btn.tiny {
  width: 30px;
  height: 30px;
  border-radius: 9px;
}

.emotion-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 4px 18px 16px;
  min-height: 0;
}

.loading-note {
  padding: 9px 11px;
  border-radius: 10px;
  border: 1px solid rgba(255, 178, 62, 0.22);
  background: rgba(255, 178, 62, 0.06);
}

.loading-row {
  display: flex;
  justify-content: space-between;
  color: var(--warning);
  font-size: 10.5px;
}

.loading-track {
  height: 3px;
  margin-top: 6px;
  border-radius: 99px;
  background: rgba(255, 178, 62, 0.15);
  overflow: hidden;
}

.loading-track i {
  display: block;
  height: 100%;
  background: var(--warning);
  transition: width 0.3s ease;
}

.mood-caption {
  display: grid;
  gap: 2px;
  text-align: center;
}

.mood-caption strong {
  font-size: 16px;
  font-weight: 800;
  letter-spacing: 0.03em;
}

.mood-caption span {
  color: var(--muted);
  font-size: 11px;
}

.bars-wrap {
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: rgba(5, 8, 16, 0.32);
}

.quality-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.multi-face {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--muted);
  font-size: 10.5px;
}

.steps {
  display: grid;
  gap: 7px;
  padding: 4px 0;
}

.steps div {
  display: flex;
  align-items: center;
  gap: 9px;
  color: var(--muted);
  font-size: 11px;
}

.steps b {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: rgba(110, 168, 255, 0.07);
  color: var(--accent);
  font-size: 9px;
  font-weight: 700;
  flex: 0 0 auto;
}

.disclaimer {
  color: var(--muted-2);
  font-size: 9.5px;
  text-align: center;
}
</style>
