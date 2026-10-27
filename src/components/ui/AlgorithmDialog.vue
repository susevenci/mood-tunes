<script setup>
import { computed, onBeforeUnmount, onMounted } from 'vue';
import AppIcon from './AppIcon.vue';
import { APP_CONFIG } from '../../config.js';
import { WEIGHTS } from '../../core/emotion/scoring.js';
import { EMOTION_ORDER, EMOTIONS } from '../../core/emotion/taxonomy.js';
import { EMOTION_PROFILES } from '../../core/recommend/profiles.js';
import { closeAlgorithm, uiState } from '../../stores/uiState.js';

const open = computed(() => uiState.algorithmOpen);

const weightRows = computed(() =>
  EMOTION_ORDER.map((key) => {
    const config = WEIGHTS[key];
    const geo = Object.entries(config.geo)
      .map(([name, weight]) => `${name} ${weight.toFixed(2)}`)
      .join(' + ');
    return {
      key,
      label: EMOTIONS[key].label,
      geo: geo + (config.inverseMax ? ` + inverseMax ${config.inverseMax.toFixed(2)}` : ''),
      expr: `${config.expr} × ${config.exprWeight.toFixed(2)}`,
    };
  }),
);

const profileRows = computed(() =>
  EMOTION_ORDER.map((key) => ({
    key,
    label: EMOTIONS[key].label,
    empathy: EMOTION_PROFILES[key].empathy,
    heal: EMOTION_PROFILES[key].heal,
    terms: EMOTION_PROFILES[key].terms.tw.join(' / '),
  })),
);

function onKeydown(event) {
  if (event.key === 'Escape' && open.value) closeAlgorithm();
}

onMounted(() => window.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="open" class="modal-mask" @click.self="closeAlgorithm">
        <section class="modal" role="dialog" aria-modal="true" aria-label="算法说明">
          <header class="modal-head">
            <div>
              <div class="panel-title"><AppIcon name="algorithm" :size="17" /> 算法说明</div>
              <p class="panel-sub">从人脸采集到歌曲推荐的完整链路</p>
            </div>
            <button class="icon-btn" type="button" aria-label="关闭" @click="closeAlgorithm">
              <AppIcon name="close" :size="17" />
            </button>
          </header>

          <div class="modal-body">
            <section>
              <h4>1. 本地推理流水线</h4>
              <p class="lead">
                工作画布（图片 ≤ {{ APP_CONFIG.engine.imageMaxWidth }}px，视频 ≤
                {{ APP_CONFIG.engine.videoMaxWidth }}px）→ TinyFaceDetector → FaceLandmark68Net（68 点）→
                FaceExpressionNet（7 类表情）→ 几何特征 + 表情融合 → 质量门控 → 时间平滑。
                三个模型位于 <code>public/models</code>，全部在浏览器 WebGL/CPU 上运行。
              </p>
            </section>

            <section>
              <h4>2. 几何特征</h4>
              <p class="lead">
                先按双眼连线去滚转，再以瞳距 d 归一化。嘴角上扬、嘴角下垂、眼睛开合、挑眉、内眉上抬、
                皱眉、怒眉、张口、嘴宽、抿嘴、上唇上提、低唤醒等特征，各自用 smoothstep 映射到 0–1。
                公式与阈值见 <code>src/core/emotion/geometry.js</code>。
              </p>
            </section>

            <section>
              <h4>3. 融合评分</h4>
              <p class="lead formula">
                R(e) = Σ w<sub>i</sub> · f<sub>i</sub> + w<sub>expr</sub> · E(e)
                <br />
                P(e) = R(e)<sup>1.15</sup> / Σ R(j)<sup>1.15</sup>
              </p>
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr><th>情绪</th><th>几何项</th><th>表情项</th></tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in weightRows" :key="row.key">
                      <td>{{ row.label }}</td>
                      <td class="mono">{{ row.geo }}</td>
                      <td class="mono">{{ row.expr }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p class="lead">
                置信度低于 {{ APP_CONFIG.thresholds.confidence }} 或第一名与第二名差值小于
                {{ APP_CONFIG.thresholds.margin }} 时，判为「情绪不明显」，推荐侧改用平静方案。
                视频流还会做 5 帧中值 + EMA（τ={{ APP_CONFIG.smoothing.tauMs }}ms）与
                {{ APP_CONFIG.smoothing.hysteresis }} 的滞回，避免标签闪烁。
              </p>
            </section>

            <section>
              <h4>4. 情绪 → 歌曲</h4>
              <p class="lead">
                每首歌有主/次情绪标签、效价 V、唤醒度 A。推荐分：
              </p>
              <p class="lead formula">
                S = 40·tag + 22·(1−|V−V<sub>t</sub>|) + 18·(1−|A−A<sub>t</sub>|) + 10·freshness +
                5·local + 5·jitter
              </p>
              <p class="lead">
                目标向量由「治愈 ↔ 共情」滑杆插值；选完第一首后对同艺人 −15、同曲风 −8，并对最近听过的
                歌曲降权。结果中始终保留至少一首本地/已缓存曲目，保证断网可播放。
              </p>
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr><th>情绪</th><th>共情 V/A</th><th>治愈 V/A</th><th>中文检索词</th></tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in profileRows" :key="row.key">
                      <td>{{ row.label }}</td>
                      <td class="mono">{{ row.empathy.valence }} / {{ row.empathy.arousal }}</td>
                      <td class="mono">{{ row.heal.valence }} / {{ row.heal.arousal }}</td>
                      <td>{{ row.terms }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h4>5. 在线与离线</h4>
              <p class="lead">
                在线曲库使用 iTunes Search API，每次刷新最多 1 个请求，结果缓存 10 分钟。
                点击「缓存到本地」会把 30 秒试听 Blob 存入 IndexedDB（上限
                {{ APP_CONFIG.cache.maxSongs }} 首 / 150MB，LRU 淘汰），断网后可继续播放。
                在线结果的 V/A 是按检索词映射的代理值，不做音频分析。
              </p>
            </section>

            <p class="privacy">
              <AppIcon name="shield" :size="14" />
              图像、视频、关键点与情绪历史均不离开本机；仅在线曲库检索访问 iTunes。
            </p>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-mask {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(2, 5, 12, 0.66);
  backdrop-filter: blur(5px);
}

.modal {
  display: flex;
  flex-direction: column;
  width: min(760px, calc(100vw - 32px));
  max-height: min(820px, 90vh);
  border-radius: 20px;
  border: 1px solid var(--border);
  background: linear-gradient(180deg, #0d1527, #080d18);
  box-shadow: 0 40px 100px rgba(0, 0, 0, 0.6);
}

.modal-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 20px;
  border-bottom: 1px solid var(--border);
}

.modal-body {
  display: grid;
  gap: 18px;
  padding: 18px 20px 26px;
  min-width: 0;
  overflow-x: hidden;
  overflow-y: auto;
}

.modal-body > section {
  min-width: 0;
}

h4 {
  margin-bottom: 6px;
  font-size: 12.5px;
  font-weight: 700;
}

.lead {
  color: var(--muted);
  font-size: 11px;
  line-height: 1.7;
  overflow-wrap: anywhere;
}

.formula {
  margin: 8px 0;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: rgba(5, 8, 16, 0.45);
  color: var(--text);
  font-family: var(--mono);
  font-size: 10.5px;
  line-height: 1.8;
  overflow-wrap: anywhere;
}

code {
  padding: 1px 5px;
  border-radius: 5px;
  background: rgba(148, 176, 255, 0.1);
  font-family: var(--mono);
  font-size: 10px;
  overflow-wrap: anywhere;
}

.table-wrap {
  max-width: 100%;
  min-width: 0;
  margin: 8px 0;
  overflow-x: auto;
  border-radius: 10px;
  border: 1px solid var(--border);
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 9.5px;
  white-space: nowrap;
}

th,
td {
  padding: 7px 9px;
  text-align: left;
  border-bottom: 1px solid rgba(148, 176, 255, 0.07);
}

th {
  color: var(--muted);
  font-weight: 700;
  background: rgba(148, 176, 255, 0.05);
}

td {
  color: var(--muted-2);
}

td.mono {
  font-family: var(--mono);
  font-size: 9px;
}

.privacy {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--success);
  font-size: 10.5px;
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
