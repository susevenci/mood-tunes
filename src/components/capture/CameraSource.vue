<script setup>
import { computed, onBeforeUnmount, ref } from 'vue';
import MediaStage from './MediaStage.vue';
import AppIcon from '../ui/AppIcon.vue';
import { toast } from '../../stores/uiState.js';

const props = defineProps({
  analysis: { type: Object, required: true },
  snapshot: { type: Boolean, default: false },
});

const video = ref(null);
const aspect = ref('16 / 9');

const camera = computed(() => props.analysis.camera);
const state = computed(() => props.analysis.state);
const isActive = computed(() => camera.value.status === 'active');
const isLive = computed(() => state.value.status === 'live');
const hasSnapshot = computed(() => props.snapshot && !!state.value.snapshotUrl);
const showVideo = computed(() => !hasSnapshot.value);
const mirrored = computed(() => !hasSnapshot.value);

const hint = computed(() => {
  if (camera.value.error) return '';
  if (hasSnapshot.value) return '已冻结画面，分析结果见中间面板';
  if (!isActive.value) return '点击「开启摄像头」并允许权限';
  if (props.snapshot) return '对准镜头，保持正脸，然后点击拍照';
  if (isLive.value) return '实时识别中 · 约 8 FPS';
  return '识别已暂停，可继续识别';
});

async function start() {
  await props.analysis.startCameraLoop(video.value);
}

function stop() {
  props.analysis.stop();
}

async function capture() {
  if (!video.value) return;
  const result = await props.analysis.captureSnapshot(video.value);
  if (!result) {
    toast(state.value.error || '拍照失败，请稍候重试。', 'warning');
    return;
  }
  aspect.value = video.value.videoWidth
    ? `${video.value.videoWidth} / ${video.value.videoHeight}`
    : aspect.value;
}

function toggleLive() {
  if (!video.value) return;
  if (isLive.value) {
    props.analysis.stopLoop();
    return;
  }
  props.analysis.startLoop(video.value, { mode: 'camera', mirrored: true });
}

function onMetadata() {
  if (video.value?.videoWidth) {
    aspect.value = `${video.value.videoWidth} / ${video.value.videoHeight}`;
  }
}

onBeforeUnmount(() => {
  props.analysis.stop();
});
</script>

<template>
  <div class="source">
    <MediaStage
      :faces="state.faces"
      :work-width="state.workWidth"
      :work-height="state.workHeight"
      :mirrored="mirrored"
      :aspect="aspect"
      :hint="hint"
    >
      <video
        v-show="showVideo"
        ref="video"
        class="media-video mirror"
        autoplay
        muted
        playsinline
        @loadedmetadata="onMetadata"
      ></video>
      <img v-if="hasSnapshot" :src="state.snapshotUrl" alt="拍照捕获的人脸画面" />
      <div v-if="!isActive && !hasSnapshot" class="camera-placeholder">
        <span class="cam-icon"><AppIcon name="camera" :size="30" /></span>
        <strong>摄像头未开启</strong>
        <span>画面只在本机处理，不会上传</span>
      </div>
    </MediaStage>

    <div v-if="camera.error" class="camera-error">
      <AppIcon name="alert" :size="17" />
      <div>
        <strong>无法使用摄像头</strong>
        <p>{{ camera.error }}</p>
      </div>
      <button class="btn small" type="button" @click="start">重试</button>
    </div>

    <div class="source-actions">
      <button v-if="!isActive" class="btn primary" type="button" @click="start">
        <AppIcon name="camera" :size="16" /> {{ hasSnapshot ? '重新拍照' : '开启摄像头' }}
      </button>
      <template v-else>
        <button v-if="snapshot" class="btn primary" type="button" @click="capture">
          <AppIcon name="snapshot" :size="16" /> 拍照并分析
        </button>
        <button v-else class="btn primary" type="button" @click="toggleLive">
          <AppIcon :name="isLive ? 'pause' : 'play'" :size="16" />
          {{ isLive ? '暂停识别' : '继续识别' }}
        </button>
        <button class="btn" type="button" @click="stop">
          <AppIcon name="close" :size="15" /> 关闭摄像头
        </button>
      </template>
      <button v-if="hasSnapshot" class="btn ghost" type="button" @click="stop">清除画面</button>
    </div>

    <p class="source-note">
      <AppIcon name="shield" :size="13" />
      浏览器需要 localhost 或 https 才能调用摄像头；拒绝权限时可改用上传图片 / 视频。
    </p>
  </div>
</template>

<style scoped>
.source {
  display: grid;
  gap: 10px;
}

.camera-placeholder {
  position: absolute;
  inset: 10px;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 6px;
  border-radius: 13px;
  border: 1.5px dashed rgba(148, 176, 255, 0.24);
  background: radial-gradient(circle at 50% 40%, rgba(110, 168, 255, 0.08), transparent 65%);
  color: var(--muted);
  text-align: center;
}

.cam-icon {
  display: grid;
  place-items: center;
  width: 62px;
  height: 62px;
  margin-bottom: 2px;
  border-radius: 20px;
  color: var(--accent);
  background: rgba(110, 168, 255, 0.1);
  border: 1px solid rgba(110, 168, 255, 0.24);
  box-shadow: 0 0 40px rgba(110, 168, 255, 0.12);
}

.camera-placeholder strong {
  color: var(--text);
  font-size: 14px;
}

.camera-placeholder span:last-child {
  font-size: 11.5px;
}

.camera-error {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 11px 13px;
  border-radius: 12px;
  border: 1px solid rgba(255, 90, 95, 0.26);
  background: rgba(255, 90, 95, 0.07);
  color: var(--danger);
}

.camera-error div {
  flex: 1;
}

.camera-error strong {
  font-size: 12.5px;
}

.camera-error p {
  margin-top: 2px;
  color: var(--muted);
  font-size: 11.5px;
}

.source-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.source-note {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--muted-2);
  font-size: 10.5px;
}
</style>
