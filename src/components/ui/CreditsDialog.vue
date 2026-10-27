<script setup>
import { computed, onBeforeUnmount, onMounted } from 'vue';
import AppIcon from './AppIcon.vue';
import { LOCAL_ATTRIBUTIONS } from '../../data/localSongs.js';
import { APP_CONFIG } from '../../config.js';
import { closeCredits, uiState } from '../../stores/uiState.js';

const open = computed(() => uiState.creditsOpen);

function onKeydown(event) {
  if (event.key === 'Escape' && open.value) closeCredits();
}

onMounted(() => window.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="open" class="modal-mask" @click.self="closeCredits">
        <section class="modal" role="dialog" aria-modal="true" aria-label="音乐与模型署名">
          <header class="modal-head">
            <div>
              <div class="panel-title"><AppIcon name="heart" :size="17" /> 音乐与署名</div>
              <p class="panel-sub">MoodTunes v{{ APP_CONFIG.version }} · 感谢这些开放资源</p>
            </div>
            <button class="icon-btn" type="button" aria-label="关闭" @click="closeCredits">
              <AppIcon name="close" :size="17" />
            </button>
          </header>

          <div class="modal-body">
            <section>
              <h4>本地曲目 · Kevin MacLeod</h4>
              <p class="lead">
                7 首器乐曲来自
                <a href="https://incompetech.com/" target="_blank" rel="noreferrer">incompetech.com</a>，
                采用
                <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
                  Creative Commons Attribution 4.0
                </a>
                许可。页面页脚与本弹窗同时展示署名。
              </p>
              <ul class="credits-list">
                <li v-for="item in LOCAL_ATTRIBUTIONS" :key="item.slug">
                  <strong>{{ item.title }}</strong>
                  <span>{{ item.text }}</span>
                </li>
              </ul>
            </section>

            <section>
              <h4>人脸模型 · face-api.js</h4>
              <p class="lead">
                使用
                <a href="https://github.com/vladmandic/face-api" target="_blank" rel="noreferrer">
                  @vladmandic/face-api
                </a>
                的 TinyFaceDetector、68 关键点与表情模型，模型权重随 npm 包分发，运行时从本地
                <code>public/models</code> 加载。face-api.js 采用 MIT 许可。
              </p>
            </section>

            <section>
              <h4>在线试听 · Apple iTunes Search API</h4>
              <p class="lead">
                在线歌曲通过
                <a href="https://performance-partners.apple.com/search-api" target="_blank" rel="noreferrer">
                  iTunes Search API
                </a>
                获取 30 秒试听与封面。试听片段版权归原权利人所有，本应用仅做本地演示与推荐，
                不做下载分发；缓存仅保存在当前浏览器的 IndexedDB 中。
              </p>
            </section>

            <section>
              <h4>技术栈</h4>
              <p class="lead">
                HTML5 · CSS3 · JavaScript · Vue 3 · Vite · @vladmandic/face-api（TFJS）。
                无后端、无统计脚本、无外部字体。
              </p>
            </section>

            <p class="privacy">
              <AppIcon name="shield" :size="14" />
              图像与视频不会离开本机。只有在线曲库检索会访问 itunes.apple.com。
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
  width: min(680px, calc(100vw - 32px));
  max-height: min(760px, 88vh);
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
  padding: 18px 20px 24px;
  min-width: 0;
  overflow-x: hidden;
  overflow-y: auto;
}

.modal-body > section {
  min-width: 0;
}

h4 {
  margin-bottom: 6px;
  color: var(--text);
  font-size: 12.5px;
  font-weight: 700;
}

.lead {
  color: var(--muted);
  font-size: 11px;
  line-height: 1.65;
  overflow-wrap: anywhere;
}

code {
  padding: 1px 5px;
  border-radius: 5px;
  background: rgba(148, 176, 255, 0.1);
  font-family: var(--mono);
  font-size: 10px;
}

.credits-list {
  display: grid;
  gap: 8px;
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
}

.credits-list li {
  display: grid;
  gap: 2px;
  padding: 8px 10px;
  border-radius: 9px;
  border: 1px solid var(--border);
  background: rgba(148, 176, 255, 0.035);
}

.credits-list strong {
  font-size: 11px;
}

.credits-list span {
  color: var(--muted-2);
  font-size: 9.5px;
  line-height: 1.5;
  word-break: break-word;
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
