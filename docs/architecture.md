# MoodTunes 代码结构梳理

本文档描述项目的目录分层、模块职责、依赖方向与运行时数据流，供二次开发与代码评审使用。算法细节见 [algorithm.md](algorithm.md)，推荐规则见 [recommendation.md](recommendation.md)。

- 统计口径：`src/` 52 个文件、约 7 000 行（含 Vue 单文件组件）；全项目源码（`src/` + `tests/` + `scripts/`）约 9 044 行。
- 技术栈：Vue 3.5（`<script setup>`） + Vite 7 + `@vladmandic/face-api` 1.7；无状态管理库、无 UI 框架、无 CSS 预处理器。

---

## 1. 设计原则

| 原则 | 落地方式 |
|---|---|
| 纯计算与运行时解耦 | `src/core/` 全部为纯 JS，不 import `vue`，可直接被 `node --test` 覆盖 |
| 单一配置源 | 所有阈值、权重、限流、缓存上限集中在 `src/config.js`，文档与代码共用同一组数字 |
| 隐私优先 | 图像、视频帧、关键点均不离开浏览器；仅 iTunes 检索产生外部请求 |
| 可降级 | 无 WebGL 时降级 CPU 与低帧率；IndexedDB 不可用时退化为纯在线/本地播放 |
| 可解释 | 推荐结果携带逐项得分 `breakdown`，情绪结果携带几何/表情分项贡献 |

---

## 2. 目录结构

```text
mood-tunes/
├─ index.html                  # Vite HTML 入口，仅挂载 #app
├─ vite.config.js              # Vue 插件、dev 端口 5173、排除 face-api 预打包
├─ package.json                # 脚本：dev / build / preview / setup:* / test
├─ start.cmd                   # Windows 一键启动（缺依赖时先 npm install）
├─ .editorconfig               # 跨编辑器缩进与行尾约定
├─ .gitattributes              # LF 统一 + 二进制资源标记
├─ .gitignore                  # 忽略依赖、构建产物、模型、临时截图
├─ LICENSE                     # MIT（代码）
├─ README.md                   # 项目说明与验收清单
├─ docs/
│  ├─ architecture.md          # 本文件：结构梳理
│  ├─ algorithm.md             # 情绪识别算法说明书
│  ├─ recommendation.md        # 推荐规则说明书
│  └─ screenshots/             # README 引用的界面截图
├─ public/                     # 静态资源，构建时原样复制到 dist/
│  ├─ models/                  # face-api 三组权重（生成物，不入版本库）
│  ├─ audio/local/             # 7 首 CC BY 4.0 MP3 + ATTRIBUTION.md
│  ├─ covers/                  # 7 张情绪渐变封面 SVG
│  ├─ demo/                    # 示例高兴/悲伤照片
│  └─ favicon.svg
├─ scripts/                    # 资源准备脚本（Node ESM，零第三方依赖）
│  ├─ prepare-assets.mjs       # 从 node_modules 复制模型并校验字节数（幂等）
│  ├─ download-audio.mjs       # 下载 CC BY 曲目（已执行，文件随库保留）
│  └─ generate-covers.mjs      # 生成情绪封面 SVG
├─ src/                        # 应用源码
│  ├─ main.js                  # createApp + 全局样式注入
│  ├─ App.vue                  # 页面骨架、情绪主题变量、模块装配
│  ├─ config.js                # 全局可调参数（唯一魔法数字来源）
│  ├─ core/                    # 纯逻辑层（无 Vue、无组件依赖）
│  │  ├─ emotion/              # 检测、几何、评分、平滑、绘制
│  │  ├─ recommend/            # 目标向量、排序、曲库适配器
│  │  └─ storage/              # IndexedDB / localStorage 持久化
│  ├─ composables/             # 组合式状态编排（单例）
│  ├─ components/              # 视图层，按业务域分目录
│  │  ├─ capture/              # 图片 / 视频 / 摄像头 / 拍照
│  │  ├─ emotion/              # 情绪球、概率条、轨迹、调试面板
│  │  ├─ recommend/            # 歌单面板与歌曲卡
│  │  ├─ player/               # 播放条与音频可视化
│  │  ├─ layout/               # 页头
│  │  └─ ui/                   # 图标、开关、弹窗、设置抽屉、Toast
│  ├─ stores/uiState.js        # 轻量全局 UI 状态（tab、弹窗、toast）
│  ├─ data/localSongs.js       # 7 首本地曲目元数据与署名
│  └─ styles/                  # tokens.css（设计变量）+ base.css（基础样式）
└─ tests/                      # node --test 单测 + fixtures
```

---

## 3. 依赖方向

分层严格单向，箭头表示"可以依赖"：

```text
components/  ──▶  composables/  ──▶  core/  ──▶  config.js
     │                 │
     └──▶ stores/ ─────┘            （stores 仅依赖 vue 的 reactive）
```

约束与现状：

| 规则 | 现状 |
|---|---|
| `core/` 不得 import `vue` 或任何组件 | ✅ 全部满足（`grep "from 'vue'" src/core` 无结果） |
| `core/` 不得访问 DOM（除 `overlay.js` / `workCanvas.js` 的 canvas） | ✅ 绘图模块是仅有的 DOM 依赖，且不被单测覆盖 |
| `composables/` 负责状态与副作用，不写模板 | ✅ 5 个 composable 均为单例工厂 |
| `components/` 不直接调用存储层 | ✅ 仅 `useRecommendations` 调用 `core/storage` |
| `components/` 可读取 `core/` 常量与纯函数 | ⚠️ 例外：`FeatureDebug.vue` 直接调用 `faceEngine.getTensorCount()` 取调试计数，属只读诊断用途 |

---

## 4. 模块职责清单

### 4.1 `core/emotion/` — 人脸情绪识别

| 文件 | 职责 | 关键导出 |
|---|---|---|
| `faceEngine.js` | face-api 动态加载与单帧推理；WebGL/CPU 后端探测 | `loadEngine` `detectFaces` `pickPrimaryFace` |
| `workCanvas.js` | 复用单块画布把输入缩放到工作宽度，避免每帧分配 | `drawToWork` `captureFrame` `canvasToDataUrl` |
| `geometry.js` | 68 点归一化与几何特征提取（嘴角、眉眼、张口等），质量评估 | `extractFeatures` `assessQuality` |
| `scoring.js` | 几何项 + 表情 CNN 加权融合，输出 7 类概率与贡献明细 | `scoreEmotions` `WEIGHTS` |
| `smoother.js` | 视频流平滑：中值滤波 → EMA → 滞回切换 | `EmotionSmoother` |
| `taxonomy.js` | 情绪元数据（键、中文名、颜色、渐变、顺序）；`neutral → calm` 映射 | `EMOTIONS` `EMOTION_ORDER` |
| `overlay.js` | 在媒体舞台绘制人脸框、68 点与标签，处理 contain 留白、镜像、DPR | `drawOverlay` |

### 4.2 `core/recommend/` — 情绪到歌单

| 文件 | 职责 | 关键导出 |
|---|---|---|
| `profiles.js` | 情绪 → 目标效价/唤醒度、检索词、修复目标、三种推荐模式、相关标签 | `EMOTION_PROFILES` `RECOMMEND_MODES` `resolveBlend` |
| `rank.js` | 六项加权打分 + 贪心多样性重排 + 本地兜底（纯函数） | `recommend` |
| `seed.js` | FNV-1a + mulberry32 可复现随机，支撑「换一批」 | `seededRandom` `pickSeeded` |
| `providers/registry.js` | 曲库适配层注册表，当前启用 `local` / `cache` / `itunes` | `registerProvider` `getOnlineCandidates` `getOfflineCandidates` |
| `providers/localProvider.js` | 内置 7 首曲目（`src/data/localSongs.js`） | `localProvider` |
| `providers/cacheProvider.js` | 已缓存到 IndexedDB 的在线试听 | `cacheProvider` |
| `providers/itunesProvider.js` | iTunes Search API：全局限速 1.5s、TTL 10min、429/403 降级 | `itunesProvider` |
| `providers/itunesMapper.js` | iTunes JSON → 统一 Song 模型（纯函数，单测覆盖） | `mapITunesResults` |

### 4.3 `core/storage/` — 持久化

| 文件 | 职责 |
|---|---|
| `idb.js` | 极简 IndexedDB Promise 封装，库名 `moodtunes` v1 |
| `audioCache.js` | 试听 Blob 缓存：元数据进 `catalog`、音频进 `audio`，上限 30 首 / 150MB，LRU 淘汰 |
| `settings.js` | 设置读写与归一化（含旧版 `blend` 字段迁移），失败静默降级 |
| `history.js` | 情绪历史，仅存标签/置信度/时间/采集方式，上限 20 条 |

### 4.4 `composables/` — 状态编排

| 文件 | 职责 |
|---|---|
| `useFaceAnalysis.js` | 分析状态机：模型加载、单图分析、视频/摄像头循环、拍照冻结、稳定标签与历史 |
| `useRecommendations.js` | 推荐编排：本地结果同步出、在线结果异步补充、缓存与播放衔接 |
| `useAudioPlayer.js` | 单例播放器，支持本地 URL、在线 URL、缓存 Blob 三种来源 |
| `useSettings.js` | 全局设置单例，localStorage 持久化 |
| `useCamera.js` | `getUserMedia` 薄封装：错误映射、流清理、单例状态 |

### 4.5 `components/` — 视图层

| 目录 | 文件 | 说明 |
|---|---|---|
| `capture/` | `CapturePanel` `ImageSource` `VideoSource` `CameraSource` `MediaStage` | 四种采集入口；`MediaStage` 统一承载画面与叠加层 |
| `emotion/` | `EmotionPanel` `EmotionOrb` `EmotionBars` `EmotionHistory` `FeatureDebug` | 情绪可视化与调试面板 |
| `recommend/` | `RecommendationPanel` `SongCard` | 歌单列表、模式切换、缓存操作 |
| `player/` | `PlayerBar` `AudioVisualizer` | 播放控制与频谱绘制 |
| `layout/` | `AppHeader` | 顶栏与弹窗入口 |
| `ui/` | `AppIcon` `AppToggle` `SettingsDrawer` `CreditsDialog` `AlgorithmDialog` `ToastHost` | 通用基础组件 |

---

## 5. 运行时数据流

### 5.1 采集 → 识别

```text
用户选择来源
  → useCamera / 文件读取 / 示例图
  → workCanvas：等比缩放到工作宽度（图片 960、视频 640）
  → faceEngine.detectFaces：TinyFaceDetector → Landmark68 → Expression
  → geometry：去滚转 + 瞳距归一化 → 几何特征 + 质量分
  → scoring：几何项 × 权重 + 表情项 × 权重 → R(e) → P(e)
  → 质量门控（小人脸 / 倾斜 / 低检测分 → 置信度打折）
  → 单张：直接输出；视频/摄像头：smoother 中值 → EMA → 滞回
  → EmotionResult + stableToken 自增
```

`stableToken` 是唯一的刷新信号：仅当情绪稳定切换时自增，`App.vue` 监听它把结果交给推荐层，避免高频抖动导致歌单反复重排。

### 5.2 稳定情绪 → 歌单

```text
stableToken 变化
  → useRecommendations.applyResult(result)
  → profiles：情绪 → target{V,A}，按模式与置信度解算 blend
  → registry.getOfflineCandidates()（本地 7 首 + 已缓存）
  → rank.recommend()：tag / valence / arousal / freshness / local / jitter 加权
  → 多样性重排，保证至少 1 首本地或已缓存
  → 首屏立即出结果
  → 若开启在线曲库：itunesProvider 异步检索（≤1 请求/次，间隔 1.5s）
  → 合并后再次排序，重新渲染
```

### 5.3 播放

```text
SongCard 点击
  → useAudioPlayer.load(song)：本地 URL / 在线 previewUrl / 缓存 Blob
  → PlayerBar 控制播放，AudioVisualizer 读取 AnalyserNode 频谱
  → 可选「缓存到本地」：audioCache 写入 IndexedDB，随后断网可播
```

---

## 6. 状态与持久化

| 载体 | 键 / 库 | 内容 | 上限 |
|---|---|---|---|
| localStorage | `moodtunes:settings:v1` | 推荐模式、微调、在线开关、地区、调试、音量、自动播放 | 单条 |
| localStorage | `moodtunes:history:v1` | 情绪标签、置信度、时间戳、采集方式 | 20 条 |
| IndexedDB | `moodtunes` v1 · `audio` | `{ id, blob }` 试听音频 | 30 首 / 150MB |
| IndexedDB | `moodtunes` v1 · `catalog` | 曲目元数据与缓存时间（LRU 依据） | 同上 |
| IndexedDB | `moodtunes` v1 · `plays` | 播放记录（自增主键） | — |
| IndexedDB | `moodtunes` v1 · `meta` | 缓存用量等杂项 | — |

运行时状态不上云：`uiState` 为内存对象，`useFaceAnalysis` / `useRecommendations` / `useAudioPlayer` / `useSettings` 均为模块级单例，跨组件共享同一份 `reactive` 状态。

---

## 7. 资源管线

```text
npm install
  → 安装依赖，无 postinstall 钩子
npm run dev / build（predev / prebuild 钩子）
  → prepare-assets.mjs：node_modules/@vladmandic/face-api/model → public/models
  → vite：public/ 原样复制，src/ 打包为单入口 chunk
  → dist/（约 38MB，其中音频 33MB）
```

| 资源 | 来源 | 是否入库 | 说明 |
|---|---|---|---|
| `public/models/*` | face-api npm 包 | ❌ 忽略 | 首次安装后由脚本生成，缺失时构建前直接报错 |
| `public/audio/local/*.mp3` | `download-audio.mjs` 预下载 | ✅ 入库 | 单文件 3.2–7.9MB，CC BY 4.0，需保留署名 |
| `public/covers/*.svg` | `generate-covers.mjs` | ✅ 入库 | 7 张情绪渐变封面，体积极小 |
| `public/demo/*.png` | 图像生成工具合成 | ✅ 入库 | 仅演示用 |

---

## 8. 测试策略

| 覆盖对象 | 测试文件 | 用例数 |
|---|---|---|
| 几何特征与归一化 | `tests/geometry.test.mjs` | 6 |
| 融合评分与权重合法性 | `tests/scoring.test.mjs` | 6 |
| 平滑与滞回 | `tests/smoother.test.mjs` | 4 |
| 排序打分与多样性 | `tests/rank.test.mjs` | 6 |
| iTunes JSON 映射 | `tests/itunesMapper.test.mjs` | 4 |
| 合计 | 5 个文件 | 26 |

单测只覆盖纯函数，不依赖浏览器、模型权重与网络。涉及 canvas、getUserMedia、IndexedDB 的路径依靠 README 中的人工验收清单验证。

---

## 9. 扩展指引

| 需求 | 改动点 |
|---|---|
| 新增一种情绪 | `taxonomy.js` 增加元数据 → `scoring.js` 增加权重行（合计需为 1.0）→ `profiles.js` 增加 target 与相关标签 → 界面自动跟随 `EMOTION_ORDER` |
| 新增曲库来源 | 实现 `{ id, label, available(), search(ctx) }` 后调用 `registerProvider`，无需改动推荐与播放层 |
| 新增采集方式 | 在 `components/capture/` 增加来源组件，复用 `MediaStage`，由 `useFaceAnalysis` 提供帧循环入口 |
| 调整推荐手感 | 只改 `config.js` 的 `recommend.weights` 与 `profiles.js` 的 target，并同步 `docs/recommendation.md` 表格 |
| 调整识别灵敏度 | 改 `config.js` 的 `engine` / `thresholds` / `smoothing`，并同步 `docs/algorithm.md` |

---

## 10. 结构体检结论

已具备：分层清晰、纯逻辑可测、配置集中、资源生成可复现、文档与代码互相索引。

已处理的整理项：

1. 补 `.gitattributes`，统一 LF 并标记 MP3/BIN/PNG 为二进制，避免 Windows 提交产生全文件 diff。
2. 补 `.editorconfig`，约束缩进与行尾。
3. 完善 `.gitignore`：排除部署平台元数据（`*.qoder.site`）、临时截图（`.tmp/`）、模型生成物、环境变量与编辑器文件。
4. 补本文件，并在 README 中挂载入口。

待改进（不影响当前运行）：

1. `components/` 存在少量跨层读取（`FeatureDebug` 直接调 `faceEngine` 计数），建议后续通过 composable 暴露。
2. 未引入 TypeScript 或 `jsconfig.json` 路径别名，深层相对路径（`../../core/...`）在移动文件时易出错。
3. 单测尚未覆盖 `audioCache` 的 LRU 淘汰与 `settings` 的旧版本迁移逻辑。
4. Vue 组件无组件级测试，人工验收清单是当前唯一回归手段。
