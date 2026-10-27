<script setup>
import { computed, onBeforeUnmount, ref } from 'vue';
import MediaStage from './MediaStage.vue';
import AppIcon from '../ui/AppIcon.vue';
import { toast } from '../../stores/uiState.js';

const props = defineProps({
  analysis: { type: Object, required: true },
});

const input = ref(null);
const video = ref(null);
const videoUrl = ref('');
const fileName = ref('');
const aspect = ref('16 / 9');
const ready = ref(false);

const hint = computed(() => {
  const state = props.analysis.state;
  if (!videoUrl.value) return '';
  if (state.status === 'analyzing') return '正在分析当前帧…';
  if (state.status === 'live') return '播放中 · 每 125ms 采样一帧';
  if (state.faceCount > 1) return `检测到 ${state.faceCount} 张人脸，已分析最大人脸`;
  if (!state.result) return '点击播放可实时识别，或分析当前帧';
  return '';
});

function pick() {
  input.value?.click();
}

function loadFile(file) {
  if (!file) return;
  if (!file.type.startsWith('video/')) {
    toast('请选择 MP4 / WebM 等视频文件。', 'warning');
    return;
  }
  if (file.size > 1024 * 1024 * 1024) {
    toast('视频超过 1GB，请选择更短的片段。', 'warning');
    return;
  }
  props.analysis.stop();
  if (videoUrl.value) URL.revokeObjectURL(videoUrl.value);
  fileName.value = file.name;
  ready.value = false;
  videoUrl.value = URL.createObjectURL(file);
}

function onFile(event) {
  loadFile(event.target.files?.[0]);
  event.target.value = '';
}

function onDrop(event) {
  loadFile(event.dataTransfer?.files?.[0]);
}

function onMetadata() {
  const element = video.value;
  if (!element?.videoWidth) return;
  aspect.value = `${element.videoWidth} / ${element.videoHeight}`;
}

function onLoadedData() {
  if (ready.value) return;
  ready.value = true;
  if (video.value) props.analysis.analyzeCurrentFrame(video.value);
}

function onPlay() {
  if (video.value) props.analysis.startLoop(video.value, { mode: 'video' });
}

function onPause() {
  props.analysis.stopLoop();
}

function analyzeFrame() {
  if (!video.value) return;
  if (!video.value.videoWidth || !video.value.videoHeight) {
    toast('视频画面尚未就绪，请稍候再分析。', 'warning');
    return;
  }
  video.value.pause();
  props.analysis.analyzeCurrentFrame(video.value);
}

function onError() {
  toast('视频无法解码，请换 MP4 / WebM 文件。', 'error');
}

onBeforeUnmount(() => {
  props.analysis.stop();
  if (videoUrl.value) URL.revokeObjectURL(videoUrl.value);
});
</script>

<template>
  <div class="source">
    <MediaStage
      :faces="analysis.state.faces"
      :work-width="analysis.state.workWidth"
      :work-height="analysis.state.workHeight"
      :aspect="aspect"
      :hint="hint"
    >
      <video
        v-if="videoUrl"
        ref="video"
        :src="videoUrl"
        class="media-video"
        controls
        muted
        playsinline
        preload="metadata"
        @loadedmetadata="onMetadata"
        @loadeddata="onLoadedData"
        @play="onPlay"
        @pause="onPause"
        @ended="onPause"
        @error="onError"
      ></video>
      <button v-else class="drop-zone" type="button" @click="pick" @dragover.prevent @drop.prevent="onDrop">
        <span class="drop-icon"><AppIcon name="video" :size="26" /></span>
        <strong>拖拽视频到这里</strong>
        <span>或点击选择 · MP4 / WebM / MOV</span>
        <em>分析时自动静音，不会上传视频</em>
      </button>
    </MediaStage>

    <div class="source-actions">
      <button class="btn" type="button" @click="pick">
        <AppIcon name="video" :size="15" /> 选择视频
      </button>
      <button class="btn primary" type="button" :disabled="!videoUrl" @click="analyzeFrame">
        <AppIcon name="image" :size="15" /> 分析当前帧
      </button>
      <span v-if="fileName" class="file-name" :title="fileName">{{ fileName }}</span>
    </div>

    <input ref="input" type="file" accept="video/*" hidden @change="onFile" />
  </div>
</template>

<style scoped>
.source {
  display: grid;
  gap: 10px;
}

.drop-zone {
  position: absolute;
  inset: 10px;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 6px;
  border-radius: 13px;
  border: 1.5px dashed rgba(148, 176, 255, 0.26);
  background: radial-gradient(circle at 50% 40%, rgba(110, 168, 255, 0.07), transparent 65%);
  color: var(--muted);
  text-align: center;
  transition: all 0.2s ease;
}

.drop-zone:hover {
  border-color: rgba(110, 168, 255, 0.55);
  background: radial-gradient(circle at 50% 40%, rgba(110, 168, 255, 0.12), transparent 65%);
}

.drop-icon {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  margin-bottom: 2px;
  border-radius: 16px;
  color: var(--accent);
  background: rgba(110, 168, 255, 0.1);
  border: 1px solid rgba(110, 168, 255, 0.24);
}

.drop-zone strong {
  color: var(--text);
  font-size: 14px;
}

.drop-zone span {
  font-size: 12px;
}

.drop-zone em {
  color: var(--muted-2);
  font-size: 10.5px;
  font-style: normal;
}

.source-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.file-name {
  min-width: 0;
  max-width: 220px;
  overflow: hidden;
  color: var(--muted-2);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
