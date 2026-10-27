<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import AppIcon from './AppIcon.vue';
import AppToggle from './AppToggle.vue';
import { useSettings } from '../../composables/useSettings.js';
import { useRecommendations } from '../../composables/useRecommendations.js';
import { useFaceAnalysis } from '../../composables/useFaceAnalysis.js';
import {
  closeSettings,
  openAlgorithm,
  openCredits,
  uiState,
} from '../../stores/uiState.js';

const { settings, reset } = useSettings();
const recs = useRecommendations();
const analysis = useFaceAnalysis();
const quota = ref(0);

const open = computed(() => uiState.settingsOpen);

async function refreshUsage() {
  await recs.refreshCacheUsage();
  try {
    const estimate = await navigator.storage?.estimate?.();
    quota.value = estimate?.quota ?? 0;
  } catch {
    quota.value = 0;
  }
}

watch(open, (value) => {
  if (value) refreshUsage();
});

function formatBytes(bytes) {
  if (!bytes) return '0 MB';
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  const mb = bytes / 1024 / 1024;
  return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
}

function algorithm() {
  closeSettings();
  openAlgorithm();
}

function credits() {
  closeSettings();
  openCredits();
}

function clearHistory() {
  analysis.clearHistory();
}

function onKeydown(event) {
  if (event.key === 'Escape' && open.value) closeSettings();
}

onMounted(() => window.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="open" class="drawer-mask" @click.self="closeSettings">
        <aside class="drawer" role="dialog" aria-modal="true" aria-label="设置">
          <header class="drawer-head">
            <div>
              <div class="panel-title"><AppIcon name="settings" :size="17" /> 设置</div>
              <p class="panel-sub">推荐策略、在线曲库与本地缓存</p>
            </div>
            <button class="icon-btn" type="button" aria-label="关闭设置" @click="closeSettings">
              <AppIcon name="close" :size="17" />
            </button>
          </header>

          <div class="drawer-body">
            <section class="section">
              <h4>推荐策略</h4>
              <div class="strategy">
                <span>治愈</span>
                <input v-model.number="settings.blend" type="range" min="0" max="1" step="0.05" aria-label="共情与治愈比例" />
                <span>共情</span>
              </div>
              <p class="hint">
                共情越高，越贴近当前情绪；治愈越高，越倾向把情绪带向舒缓。当前
                <b class="mono">{{ Math.round(settings.blend * 100) }}%</b> 共情。
              </p>
            </section>

            <section class="section">
              <div class="row">
                <div>
                  <h4>在线曲库（iTunes）</h4>
                  <p class="hint">30 秒试听，按情绪关键词检索；关闭后只用本地曲库。</p>
                </div>
                <AppToggle v-model="settings.online" label="在线曲库" />
              </div>
              <div class="field">
                <label for="country">商店地区</label>
                <select id="country" v-model="settings.country">
                  <option value="tw">台湾（中文歌曲更多）</option>
                  <option value="us">美国（英文曲库更全）</option>
                </select>
              </div>
            </section>

            <section class="section">
              <div class="row">
                <div>
                  <h4>算法调试面板</h4>
                  <p class="hint">显示几何特征、表情概率、贡献度和张量数。</p>
                </div>
                <AppToggle v-model="settings.debug" label="算法调试面板" />
              </div>
            </section>

            <section class="section">
              <div class="row">
                <div>
                  <h4>本地缓存</h4>
                  <p class="hint">
                    {{ recs.state.cachedCount }} 首 · {{ formatBytes(recs.state.cacheBytes) }}
                    <template v-if="quota"> / 浏览器配额 {{ formatBytes(quota) }}</template>
                  </p>
                </div>
                <button class="btn small" type="button" @click="refreshUsage">刷新</button>
              </div>
              <button class="btn small danger" type="button" :disabled="!recs.state.cachedCount" @click="recs.clearCache()">
                <AppIcon name="trash" :size="13" /> 清空缓存
              </button>
            </section>

            <section class="section">
              <div class="row">
                <div>
                  <h4>情绪历史</h4>
                  <p class="hint">只保存标签、置信度与时间，不保存任何图像。</p>
                </div>
                <button class="btn small" type="button" :disabled="!analysis.state.history.length" @click="clearHistory">
                  清空
                </button>
              </div>
            </section>

            <section class="section links">
              <button class="link-row" type="button" @click="algorithm">
                <AppIcon name="algorithm" :size="15" />
                <span>查看识别与推荐算法说明</span>
                <AppIcon name="chevron" :size="14" />
              </button>
              <button class="link-row" type="button" @click="credits">
                <AppIcon name="heart" :size="15" />
                <span>音乐 / 模型 / API 署名</span>
                <AppIcon name="chevron" :size="14" />
              </button>
              <button class="link-row danger" type="button" @click="reset()">
                <AppIcon name="refresh" :size="15" />
                <span>恢复默认设置</span>
                <AppIcon name="chevron" :size="14" />
              </button>
            </section>

            <p class="privacy">
              <AppIcon name="shield" :size="14" />
              所有图像、视频、关键点与情绪结果都在本机浏览器内处理，不上传服务器。
            </p>
          </div>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.drawer-mask {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: flex;
  justify-content: flex-end;
  background: rgba(2, 5, 12, 0.62);
  backdrop-filter: blur(4px);
}

.drawer {
  display: flex;
  flex-direction: column;
  width: min(420px, 100%);
  height: 100%;
  border-left: 1px solid var(--border);
  background: linear-gradient(180deg, #0d1527, #080d18);
  box-shadow: -30px 0 80px rgba(0, 0, 0, 0.5);
}

.drawer-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 20px;
  border-bottom: 1px solid var(--border);
}

.drawer-body {
  display: grid;
  gap: 14px;
  padding: 18px 20px 30px;
  overflow-y: auto;
}

.section {
  display: grid;
  gap: 8px;
  padding: 13px;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: rgba(148, 176, 255, 0.035);
}

.section h4 {
  font-size: 12px;
  font-weight: 700;
}

.row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.hint {
  color: var(--muted);
  font-size: 10.5px;
  line-height: 1.5;
}

.hint b {
  color: var(--text);
}

.strategy {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 8px;
  color: var(--muted-2);
  font-size: 10px;
}

.links {
  gap: 2px;
  padding: 6px;
}

.link-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 8px;
  border-radius: 9px;
  color: var(--muted);
  font-size: 11.5px;
  text-align: left;
}

.link-row span {
  flex: 1;
}

.link-row:hover {
  color: var(--text);
  background: rgba(148, 176, 255, 0.08);
}

.link-row.danger:hover {
  color: var(--danger);
}

.privacy {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  color: var(--muted-2);
  font-size: 10px;
  line-height: 1.5;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
