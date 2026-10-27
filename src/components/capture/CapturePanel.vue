<script setup>
import { computed, watch } from 'vue';
import AppIcon from '../ui/AppIcon.vue';
import ImageSource from './ImageSource.vue';
import VideoSource from './VideoSource.vue';
import CameraSource from './CameraSource.vue';
import { uiState } from '../../stores/uiState.js';

const props = defineProps({
  analysis: { type: Object, required: true },
});

const tabs = [
  { key: 'image', label: '上传图片', icon: 'image' },
  { key: 'video', label: '本地视频', icon: 'video' },
  { key: 'camera', label: '实时摄像头', icon: 'camera' },
  { key: 'snapshot', label: '拍照捕获', icon: 'snapshot' },
];

const activeTab = computed({
  get: () => uiState.tab,
  set: (value) => {
    uiState.tab = value;
  },
});

const engine = computed(() => props.analysis.state.engine);
const progress = computed(() => Math.round((engine.value.progress || 0) * 100));
const showEngineError = computed(() => engine.value.status === 'error');
const showAnalysisError = computed(
  () =>
    !!props.analysis.state.error &&
    activeTab.value !== 'camera' &&
    activeTab.value !== 'snapshot',
);

watch(activeTab, () => {
  props.analysis.stop();
});

function selectTab(key) {
  if (activeTab.value === key) return;
  activeTab.value = key;
}

function onTabKeydown(event, index) {
  if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  event.preventDefault();
  const delta = event.key === 'ArrowRight' ? 1 : -1;
  const next = (index + delta + tabs.length) % tabs.length;
  selectTab(tabs[next].key);
  event.currentTarget.parentElement?.children?.[next]?.focus();
}
</script>

<template>
  <section class="panel capture-panel">
    <div class="panel-head">
      <div>
        <div class="panel-title"><AppIcon name="camera" :size="17" /> 情绪采集</div>
        <div class="panel-sub">四种方式，全部在本机浏览器内完成推理</div>
      </div>
      <span class="chip success"><AppIcon name="shield" :size="13" /> 本地推理</span>
    </div>

    <div class="tabs" role="tablist" aria-label="人脸采集方式">
      <button
        v-for="(tab, index) in tabs"
        :key="tab.key"
        class="tab"
        :class="{ active: activeTab === tab.key }"
        role="tab"
        :aria-selected="activeTab === tab.key"
        :tabindex="activeTab === tab.key ? 0 : -1"
        @click="selectTab(tab.key)"
        @keydown="onTabKeydown($event, index)"
      >
        <AppIcon :name="tab.icon" :size="16" />
        <span>{{ tab.label }}</span>
      </button>
    </div>

    <div class="capture-body">
      <div v-if="engine.status === 'loading'" class="engine-loading">
        <div class="engine-loading-head">
          <span>{{ engine.step || '加载模型…' }}</span>
          <span class="mono">{{ progress }}%</span>
        </div>
        <div class="progress-track"><i :style="{ width: progress + '%' }"></i></div>
        <p>模型只从本地 public/models 读取，不会上传任何画面。</p>
      </div>

      <div v-else-if="showEngineError" class="error-card">
        <AppIcon name="alert" :size="18" />
        <div>
          <strong>模型加载失败</strong>
          <p>{{ engine.error || '请确认 public/models 下的模型文件完整。' }}</p>
        </div>
        <button class="btn small" @click="analysis.retryEngine()">重试</button>
      </div>

      <div v-if="showAnalysisError" class="error-card">
        <AppIcon name="alert" :size="18" />
        <div>
          <strong>采集失败</strong>
          <p>{{ analysis.state.error }}</p>
        </div>
      </div>

      <ImageSource v-if="activeTab === 'image'" :key="'image'" :analysis="analysis" />
      <VideoSource v-else-if="activeTab === 'video'" :key="'video'" :analysis="analysis" />
      <CameraSource
        v-else
        :key="activeTab"
        :analysis="analysis"
        :snapshot="activeTab === 'snapshot'"
      />
    </div>

    <div class="capture-foot">
      <span class="mono">{{ analysis.state.inferenceMs ? analysis.state.inferenceMs + 'ms' : '—' }}</span>
      <span>单帧推理</span>
      <span class="dot-sep"></span>
      <span class="mono">{{ analysis.state.fps ? analysis.state.fps + ' FPS' : '—' }}</span>
      <span>实时帧率</span>
      <span class="dot-sep"></span>
      <span>68 点几何 + 7 类表情 CNN</span>
    </div>
  </section>
</template>

<style scoped>
.capture-panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.tabs {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  margin: 0 18px;
  padding: 5px;
  border-radius: 13px;
  border: 1px solid var(--border);
  background: rgba(5, 8, 16, 0.55);
}

.tab {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 36px;
  padding: 0 8px;
  border-radius: 9px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 600;
  transition: all 0.2s ease;
}

.tab:hover {
  color: var(--text);
  background: rgba(148, 176, 255, 0.07);
}

.tab.active {
  color: #081020;
  background: linear-gradient(120deg, var(--accent), var(--accent-2));
  box-shadow: 0 8px 22px rgba(110, 168, 255, 0.22);
}

.capture-body {
  display: grid;
  gap: 12px;
  padding: 16px 18px 10px;
}

.engine-loading {
  padding: 12px 14px;
  border-radius: 13px;
  border: 1px solid rgba(255, 178, 62, 0.24);
  background: rgba(255, 178, 62, 0.06);
}

.engine-loading-head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  color: var(--warning);
  font-size: 12px;
  font-weight: 700;
}

.progress-track {
  height: 4px;
  margin: 9px 0 7px;
  border-radius: 99px;
  background: rgba(255, 178, 62, 0.16);
  overflow: hidden;
}

.progress-track i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--warning), #ff7a3d);
  transition: width 0.3s ease;
}

.engine-loading p {
  color: var(--muted);
  font-size: 11px;
}

.error-card {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 13px;
  border: 1px solid rgba(255, 90, 95, 0.26);
  background: rgba(255, 90, 95, 0.07);
  color: var(--danger);
}

.error-card div {
  flex: 1;
}

.error-card strong {
  font-size: 12.5px;
}

.error-card p {
  margin-top: 2px;
  color: var(--muted);
  font-size: 11.5px;
  word-break: break-word;
}

.capture-foot {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: auto;
  padding: 10px 18px 14px;
  border-top: 1px solid var(--border);
  color: var(--muted-2);
  font-size: 11px;
  flex-wrap: wrap;
}

.dot-sep {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--muted-2);
}

@media (max-width: 520px) {
  .tabs {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
