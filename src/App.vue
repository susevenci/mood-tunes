<script setup>
import { computed, onBeforeUnmount, onMounted, watch } from 'vue';
import AppHeader from './components/layout/AppHeader.vue';
import CapturePanel from './components/capture/CapturePanel.vue';
import EmotionPanel from './components/emotion/EmotionPanel.vue';
import RecommendationPanel from './components/recommend/RecommendationPanel.vue';
import PlayerBar from './components/player/PlayerBar.vue';
import SettingsDrawer from './components/ui/SettingsDrawer.vue';
import CreditsDialog from './components/ui/CreditsDialog.vue';
import AlgorithmDialog from './components/ui/AlgorithmDialog.vue';
import ToastHost from './components/ui/ToastHost.vue';
import { useFaceAnalysis } from './composables/useFaceAnalysis.js';
import { useRecommendations } from './composables/useRecommendations.js';
import { useAudioPlayer } from './composables/useAudioPlayer.js';
import { EMOTIONS } from './core/emotion/taxonomy.js';
import { openAlgorithm, openCredits, openSettings } from './stores/uiState.js';

const analysis = useFaceAnalysis();
const recs = useRecommendations();
const player = useAudioPlayer();

const themeStyle = computed(() => {
  const key =
    analysis.state.result?.emotion ||
    analysis.state.result?.candidate ||
    recs.state.profile?.emotion ||
    'calm';
  const meta = EMOTIONS[key] || EMOTIONS.calm;
  return {
    '--emotion': meta.color,
    '--emotion-soft': meta.soft,
    '--emotion-a': meta.gradient[0],
    '--emotion-b': meta.gradient[1],
  };
});

watch(
  () => analysis.state.stableToken,
  () => {
    recs.applyResult(analysis.state.result);
  },
  { flush: 'post' },
);

onMounted(() => {
  analysis.init();
  recs.init();
});

onBeforeUnmount(() => {
  analysis.stop();
  player.pause();
});
</script>

<template>
  <a class="skip-link" href="#main">跳到主内容</a>
  <div class="app-shell" :style="themeStyle">
    <div class="bg-aurora" aria-hidden="true">
      <span class="aurora-a"></span>
      <span class="aurora-b"></span>
      <span class="grid"></span>
    </div>

    <AppHeader
      :engine="analysis.state.engine"
      :online="!recs.state.offline"
      @open-settings="openSettings"
      @open-credits="openCredits"
      @open-algorithm="openAlgorithm"
      @retry-engine="analysis.retryEngine()"
    />

    <main id="main" class="app-main">
      <CapturePanel :analysis="analysis" />
      <EmotionPanel :analysis="analysis" />
      <RecommendationPanel />
    </main>

    <footer class="app-footer">
      <button type="button" class="footer-link" @click="openCredits">
        音乐：Kevin MacLeod (incompetech.com) · CC BY 4.0
      </button>
      <span class="footer-dot"></span>
      <button type="button" class="footer-link" @click="openAlgorithm">识别与推荐算法</button>
      <span class="footer-grow"></span>
      <span class="footer-privacy">纯本地识别 · 图像与视频不出本机</span>
    </footer>

    <PlayerBar />
    <SettingsDrawer />
    <CreditsDialog />
    <AlgorithmDialog />
    <ToastHost />
  </div>
</template>

<style scoped>
.app-shell {
  position: relative;
  min-height: 100vh;
  padding-bottom: 112px;
  background: var(--bg);
  color: var(--text);
}

.skip-link {
  position: fixed;
  top: -60px;
  left: 16px;
  z-index: 200;
  padding: 8px 14px;
  border-radius: 10px;
  background: var(--accent);
  color: #06101f;
  font-weight: 700;
  transition: top 0.2s ease;
}

.skip-link:focus {
  top: 12px;
}

.bg-aurora {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
  background:
    radial-gradient(900px 520px at 12% -8%, color-mix(in srgb, var(--emotion) 20%, transparent), transparent 70%),
    radial-gradient(820px 480px at 96% 0%, rgba(110, 168, 255, 0.12), transparent 68%),
    linear-gradient(180deg, #070b14, #060912 60%, #05080f);
  transition: background 0.9s ease;
}

.aurora-a,
.aurora-b {
  position: absolute;
  border-radius: 50%;
  filter: blur(90px);
  opacity: 0.35;
  transition: background 0.9s ease;
}

.aurora-a {
  width: 420px;
  height: 420px;
  left: -140px;
  top: 24%;
  background: var(--emotion);
  opacity: 0.16;
}

.aurora-b {
  width: 360px;
  height: 360px;
  right: -120px;
  bottom: 8%;
  background: var(--accent-2);
  opacity: 0.12;
}

.grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(148, 176, 255, 0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(148, 176, 255, 0.035) 1px, transparent 1px);
  background-size: 54px 54px;
  mask-image: radial-gradient(circle at 50% 20%, #000 0%, transparent 78%);
}

.app-main {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(330px, 1.05fr) minmax(300px, 0.86fr) minmax(360px, 1.12fr);
  align-items: start;
  gap: clamp(12px, 1.4vw, 20px);
  width: min(1720px, 100%);
  margin: 0 auto;
  padding: clamp(14px, 1.8vw, 24px) clamp(14px, 2.2vw, 30px) 20px;
}

.app-footer {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 9px;
  width: min(1720px, 100%);
  margin: 0 auto;
  padding: 8px clamp(14px, 2.2vw, 30px) 26px;
  color: var(--muted-2);
  font-size: 10px;
  flex-wrap: wrap;
}

.footer-link {
  color: var(--muted-2);
  font-size: 10px;
  text-decoration: underline;
  text-decoration-color: rgba(148, 176, 255, 0.24);
  text-underline-offset: 3px;
}

.footer-link:hover {
  color: var(--accent);
}

.footer-dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--muted-2);
}

.footer-grow {
  flex: 1;
}

.footer-privacy {
  color: var(--success);
  opacity: 0.72;
}

@media (max-width: 1320px) {
  .app-main {
    grid-template-columns: minmax(320px, 1fr) minmax(300px, 0.9fr);
  }

  .app-main > :nth-child(3) {
    grid-column: 1 / -1;
  }
}

@media (max-width: 900px) {
  .app-main {
    grid-template-columns: minmax(0, 1fr);
  }

  .app-main > :nth-child(3) {
    grid-column: auto;
  }

  .app-shell {
    padding-bottom: 124px;
  }

  .app-footer {
    padding-bottom: 18px;
  }

  .footer-grow {
    display: none;
  }
}
</style>
