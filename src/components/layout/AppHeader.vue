<script setup>
import { computed } from 'vue';
import AppIcon from '../ui/AppIcon.vue';

const props = defineProps({
  engine: { type: Object, required: true },
  online: { type: Boolean, default: true },
});

const emit = defineEmits(['open-settings', 'open-credits', 'open-algorithm', 'retry-engine']);

const engineChip = computed(() => {
  const status = props.engine.status;
  if (status === 'ready') {
    return {
      text: `模型就绪 · ${props.engine.backend === 'webgl' ? 'WebGL' : 'CPU'}`,
      tone: props.engine.backend === 'webgl' ? 'success' : 'warning',
    };
  }
  if (status === 'loading') {
    return { text: `模型加载 ${Math.round((props.engine.progress || 0) * 100)}%`, tone: 'warning' };
  }
  if (status === 'error') return { text: '模型加载失败', tone: 'danger' };
  return { text: '模型待加载', tone: '' };
});
</script>

<template>
  <header class="app-header">
    <div class="brand">
      <div class="brand-mark" aria-hidden="true">
        <span></span>
      </div>
      <div>
        <div class="brand-name">MoodTunes</div>
        <div class="brand-sub">情绪点歌机 · 本地人脸情绪识别</div>
      </div>
    </div>

    <div class="header-status">
      <span class="chip dot" :class="engineChip.tone">{{ engineChip.text }}</span>
      <span v-if="engine.light" class="chip warning">CPU 降级</span>
      <span class="chip dot" :class="online ? 'success' : 'warning'">
        {{ online ? '在线曲库可用' : '离线模式' }}
      </span>
      <span class="chip privacy"><AppIcon name="shield" :size="13" /> 图像不出本机</span>
    </div>

    <div class="header-actions">
      <button v-if="engine.status === 'error'" class="btn small" @click="emit('retry-engine')">
        <AppIcon name="refresh" :size="14" /> 重试
      </button>
      <button class="icon-btn" title="算法说明" aria-label="算法说明" @click="emit('open-algorithm')">
        <AppIcon name="algorithm" :size="18" />
      </button>
      <button class="icon-btn" title="音乐与模型署名" aria-label="音乐与模型署名" @click="emit('open-credits')">
        <AppIcon name="heart" :size="18" />
      </button>
      <button class="icon-btn" title="设置" aria-label="设置" @click="emit('open-settings')">
        <AppIcon name="settings" :size="18" />
      </button>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  position: sticky;
  top: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 14px clamp(16px, 2.4vw, 32px);
  border-bottom: 1px solid var(--border);
  background: linear-gradient(180deg, rgba(7, 11, 20, 0.92), rgba(7, 11, 20, 0.72));
  backdrop-filter: blur(18px);
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.brand-mark {
  position: relative;
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 14px;
  background: linear-gradient(140deg, rgba(110, 168, 255, 0.22), rgba(185, 131, 255, 0.16));
  border: 1px solid rgba(148, 176, 255, 0.24);
  box-shadow: 0 0 30px rgba(110, 168, 255, 0.18);
}

.brand-mark::before {
  content: "";
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid transparent;
  background: linear-gradient(140deg, #6ea8ff, #b983ff, #2ed6b3) border-box;
  -webkit-mask:
    linear-gradient(#fff 0 0) padding-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
}

.brand-mark span {
  position: absolute;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #b983ff;
  box-shadow: 0 0 12px #b983ff;
}

.brand-name {
  font-size: 16px;
  font-weight: 800;
  letter-spacing: 0.04em;
  line-height: 1.1;
}

.brand-sub {
  margin-top: 3px;
  color: var(--muted);
  font-size: 11px;
  white-space: nowrap;
}

.header-status {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  overflow: hidden;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.privacy {
  color: var(--success);
  border-color: rgba(46, 214, 179, 0.24);
  background: rgba(46, 214, 179, 0.06);
}

@media (max-width: 1100px) {
  .privacy {
    display: none;
  }
}

@media (max-width: 860px) {
  .app-header {
    flex-wrap: wrap;
    gap: 10px;
  }

  .header-status {
    order: 3;
    width: 100%;
    margin-left: 0;
    overflow-x: auto;
    padding-bottom: 2px;
  }

  .header-actions {
    margin-left: auto;
  }

  .brand-sub {
    display: none;
  }
}
</style>
