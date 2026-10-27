<script setup>
import { computed } from 'vue';
import { EMOTION_ORDER, EMOTIONS, EXPRESSION_KEYS, EXPRESSION_LABELS } from '../../core/emotion/taxonomy.js';
import { getTensorCount } from '../../core/emotion/faceEngine.js';

const props = defineProps({
  result: { type: Object, default: null },
  engine: { type: Object, required: true },
  inferenceMs: { type: Number, default: 0 },
  fps: { type: Number, default: 0 },
});

const FEATURE_LABELS = {
  smile: '嘴角上扬 smile',
  frown: '嘴角下垂 frown',
  eyeOpen: '眼睛睁开 eyeOpen',
  eyeWide: '睁大 eyeWide',
  eyeSquint: '眯眼 eyeSquint',
  browRaise: '挑眉 browRaise',
  innerBrowRaise: '内眉上抬 innerBrowRaise',
  browFurrow: '皱眉 browFurrow',
  browSlope: '怒眉 browSlope',
  mouthOpen: '张口 mouthOpen',
  mouthWidth: '嘴宽 mouthWidth',
  lipPress: '抿嘴 lipPress',
  upperLipRaise: '上唇上提 upperLipRaise',
  lowActivation: '低唤醒 lowActivation',
};

const expressionRows = computed(() =>
  EXPRESSION_KEYS.map((key) => ({
    key,
    label: EXPRESSION_LABELS[key],
    value: props.result?.expressions?.[key] ?? 0,
  })).sort((a, b) => b.value - a.value),
);

const featureRows = computed(() => {
  const features = props.result?.features;
  if (!features) return [];
  return Object.entries(FEATURE_LABELS).map(([key, label]) => ({
    key,
    label,
    value: features[key] ?? 0,
  }));
});

const contributions = computed(() => props.result?.contributions ?? []);
const candidate = computed(() => props.result?.candidate ?? null);
const probabilities = computed(() => props.result?.probabilities ?? null);

const quality = computed(() => props.result?.quality ?? null);
const tensorCount = computed(() => {
  // 依赖 result.ts，使面板在每次分析后刷新。
  void props.result?.ts;
  return getTensorCount();
});

function pct(value) {
  return `${(value * 100).toFixed(1)}%`;
}
</script>

<template>
  <details class="debug">
    <summary>
      <span>算法调试面板</span>
      <span class="debug-meta mono">
        {{ engine.backend || '—' }} · {{ inferenceMs || 0 }}ms · {{ fps || 0 }} FPS
      </span>
    </summary>

    <div class="debug-body">
      <div class="debug-block">
        <h4>表情 CNN（face-api）</h4>
        <div class="mini-row" v-for="row in expressionRows" :key="row.key">
          <span>{{ row.label }}</span>
          <i><b :style="{ width: row.value * 100 + '%' }"></b></i>
          <em class="mono">{{ pct(row.value) }}</em>
        </div>
      </div>

      <div class="debug-block">
        <h4>几何特征（0–1）</h4>
        <div class="feature-grid">
          <div v-for="row in featureRows" :key="row.key" class="feature-item">
            <span>{{ row.label }}</span>
            <em class="mono">{{ row.value.toFixed(3) }}</em>
          </div>
        </div>
      </div>

      <div class="debug-block" v-if="contributions.length">
        <h4>融合贡献（候选：{{ EMOTIONS[candidate]?.label || '—' }}）</h4>
        <div class="mini-row" v-for="item in contributions" :key="item.key">
          <span>{{ item.label }}</span>
          <i><b class="contrib" :style="{ width: (item.weighted / 0.45) * 100 + '%' }"></b></i>
          <em class="mono">{{ item.weighted.toFixed(3) }}</em>
        </div>
      </div>

      <div class="debug-block" v-if="probabilities">
        <h4>归一化概率</h4>
        <div class="prob-grid">
          <span v-for="key in EMOTION_ORDER" :key="key">
            {{ EMOTIONS[key].label }}
            <b class="mono">{{ pct(probabilities[key] ?? 0) }}</b>
          </span>
        </div>
      </div>

      <div class="debug-block" v-if="quality">
        <h4>质量门控</h4>
        <div class="quality-grid mono">
          <span>faceSize {{ (quality.faceSize * 100).toFixed(1) }}%</span>
          <span>tilt {{ quality.tiltDeg.toFixed(1) }}°</span>
          <span>det {{ quality.detectionScore.toFixed(2) }}</span>
          <span>penalty {{ quality.penalty.toFixed(2) }}</span>
          <span>tensors {{ tensorCount }}</span>
        </div>
        <p v-if="quality.penalties?.length" class="quality-warn">
          {{ quality.penalties.map((item) => item.message).join('；') }}
        </p>
        <p v-else class="quality-ok">质量良好</p>
      </div>
    </div>
  </details>
</template>

<style scoped>
.debug {
  border-top: 1px solid var(--border);
  margin-top: 12px;
  padding-top: 8px;
}

summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 6px 2px;
  color: var(--muted);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  list-style: none;
}

summary::-webkit-details-marker {
  display: none;
}

summary::before {
  content: "▸";
  margin-right: 6px;
  color: var(--accent);
}

details[open] summary::before {
  content: "▾";
}

.debug-meta {
  color: var(--muted-2);
  font-size: 9.5px;
  font-weight: 500;
}

.debug-body {
  display: grid;
  gap: 12px;
  padding: 8px 0 4px;
}

.debug-block h4 {
  margin-bottom: 6px;
  color: var(--muted);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.mini-row {
  display: grid;
  grid-template-columns: 92px 1fr 44px;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
  color: var(--muted-2);
  font-size: 9.5px;
}

.mini-row i {
  height: 4px;
  border-radius: 99px;
  background: rgba(148, 176, 255, 0.1);
  overflow: hidden;
}

.mini-row i b {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--accent), var(--accent-2));
}

.mini-row i b.contrib {
  background: linear-gradient(90deg, var(--emotion), var(--accent-2));
}

.mini-row em {
  color: var(--muted);
  font-style: normal;
  text-align: right;
}

.feature-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3px 10px;
}

.feature-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 3px 0;
  border-bottom: 1px dashed rgba(148, 176, 255, 0.08);
  color: var(--muted-2);
  font-size: 9.5px;
}

.feature-item em {
  color: var(--text);
  font-style: normal;
}

.prob-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 3px 10px;
  color: var(--muted-2);
  font-size: 9.5px;
}

.prob-grid span {
  display: flex;
  justify-content: space-between;
  gap: 6px;
}

.prob-grid b {
  color: var(--text);
  font-weight: 600;
}

.quality-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  color: var(--muted-2);
  font-size: 9.5px;
}

.quality-warn {
  margin-top: 5px;
  color: var(--warning);
  font-size: 10px;
}

.quality-ok {
  margin-top: 5px;
  color: var(--success);
  font-size: 10px;
}
</style>
