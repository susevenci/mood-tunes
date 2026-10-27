<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import MediaStage from './MediaStage.vue';
import AppIcon from '../ui/AppIcon.vue';
import { toast } from '../../stores/uiState.js';

const props = defineProps({
  analysis: { type: Object, required: true },
});

const input = ref(null);
const img = ref(null);
const imageUrl = ref('');
const fileName = ref('');
const isObjectUrl = ref(false);
const aspect = ref('16 / 10');

const hint = computed(() => {
  const state = props.analysis.state;
  if (!imageUrl.value) return '';
  if (state.status === 'analyzing') return '正在本地分析…';
  if (state.status === 'error') return state.error || '分析失败';
  if (state.faceCount > 1) return `检测到 ${state.faceCount} 张人脸，已分析最大人脸`;
  if (!state.result) return '未检测到人脸，请换一张清晰正脸照片';
  return '';
});

function pick() {
  input.value?.click();
}

function loadFile(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    toast('请选择 JPG / PNG / WebP 等图片文件。', 'warning');
    return;
  }
  if (file.size > 20 * 1024 * 1024) {
    toast('图片超过 20MB，请压缩后重试。', 'warning');
    return;
  }
  props.analysis.stop();
  if (imageUrl.value && isObjectUrl.value) URL.revokeObjectURL(imageUrl.value);
  fileName.value = file.name;
  isObjectUrl.value = true;
  imageUrl.value = URL.createObjectURL(file);
}

function loadDemo(name) {
  const url = `${import.meta.env.BASE_URL}demo/${name}.png`;
  if (imageUrl.value === url) {
    analyze();
    return;
  }
  props.analysis.stop();
  if (imageUrl.value && isObjectUrl.value) URL.revokeObjectURL(imageUrl.value);
  isObjectUrl.value = false;
  fileName.value = `示例照片-${name === 'happy' ? '高兴' : '悲伤'}.png`;
  imageUrl.value = url;
}

function onFile(event) {
  loadFile(event.target.files?.[0]);
  event.target.value = '';
}

function onDrop(event) {
  loadFile(event.dataTransfer?.files?.[0]);
}

function onLoaded() {
  const element = img.value;
  if (!element?.naturalWidth) return;
  aspect.value = `${element.naturalWidth} / ${element.naturalHeight}`;
  props.analysis.analyzeStill(element, { mode: 'image' });
}

function analyze() {
  if (img.value) props.analysis.analyzeStill(img.value, { mode: 'image' });
}

function onError() {
  toast('图片解码失败，请换一张 JPG / PNG / WebP。', 'error');
}

onBeforeUnmount(() => {
  if (imageUrl.value && isObjectUrl.value) URL.revokeObjectURL(imageUrl.value);
});

onMounted(() => {
  const demo = new URLSearchParams(window.location.search).get('demo');
  if (demo === 'happy' || demo === 'sad') loadDemo(demo);
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
      <img
        v-if="imageUrl"
        ref="img"
        :src="imageUrl"
        alt="待分析的人脸照片"
        @load="onLoaded"
        @error="onError"
      />
      <button v-else class="drop-zone" type="button" @click="pick" @dragover.prevent @drop.prevent="onDrop">
        <span class="drop-icon"><AppIcon name="upload" :size="26" /></span>
        <strong>拖拽图片到这里</strong>
        <span>或点击选择 · JPG / PNG / WebP</span>
        <em>图片只在本机内存中处理</em>
      </button>
    </MediaStage>

    <div class="source-actions">
      <button class="btn" type="button" @click="pick">
        <AppIcon name="image" :size="15" /> 选择图片
      </button>
      <button class="btn primary" type="button" :disabled="!imageUrl || analysis.state.status === 'analyzing'" @click="analyze">
        <AppIcon name="refresh" :size="15" /> 重新分析
      </button>
      <button class="btn ghost small" type="button" @click="loadDemo('happy')">示例：高兴</button>
      <button class="btn ghost small" type="button" @click="loadDemo('sad')">示例：悲伤</button>
      <span v-if="fileName" class="file-name" :title="fileName">{{ fileName }}</span>
    </div>

    <input ref="input" type="file" accept="image/*" hidden @change="onFile" />
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
