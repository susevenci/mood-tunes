# 情绪 → 歌曲推荐规则

本文档描述从稳定情绪标签到最终歌单的全部规则。代码位置：`src/core/recommend/`、`src/composables/useRecommendations.js`、`src/data/localSongs.js`。

## 1. 统一歌曲模型

```js
{
  id, source: 'local' | 'itunes' | 'cache',
  title, artist, album, cover, audioUrl, duration,
  preview,                 // 是否 30 秒试听
  emotionTags: ['sad', 'calm'], // 主标签在前
  valence, arousal,        // 0..1
  tempo, genre,
  local, cached,           // 是否可离线播放
  trackViewUrl, attribution
}
```

- 本地曲目：手动标注 V/A、tempo、genre 与主/次标签。
- 在线曲目：`emotionTags=[当前检索情绪]`，V/A 取当前目标向量 ±0.06 的种子抖动；这是**关键词代理值**，不做音频分析。
- 缓存曲目：保留在线曲目的元数据，`cached=true`、`local=true`，音频 Blob 存 IndexedDB。

## 2. 情绪 → 目标向量

「共情 ↔ 治愈」滑杆 `blend`（0=治愈，1=共情，默认 0.7）：

\[
V_t = blend\cdot V_{empathy}+(1-blend)\cdot V_{heal}
\]

\[
A_t = blend\cdot A_{empathy}+(1-blend)\cdot A_{heal}
\]

| 情绪 | 共情 V/A | 治愈 V/A | 本地曲目 | 在线检索词（US / TW） |
|---|---|---|---|---|
| 高兴 | 0.82 / 0.68 | 0.82 / 0.68 | Happy Alley | happy upbeat / 快乐 轻快 |
| 悲伤 | 0.28 / 0.28 | 0.55 / 0.38 | Heartbreaking | sad piano melancholy / 伤感 钢琴 |
| 愤怒 | 0.28 / 0.85 | 0.45 / 0.55 | Volatile Reaction | angry rock intense / 摇滚 愤怒 |
| 平静 | 0.55 / 0.25 | 0.55 / 0.25 | Peaceful Desolation | calm ambient relaxing / 轻音乐 放松 |
| 惊讶 | 0.78 / 0.78 | 0.65 / 0.55 | Monkeys Spinning Monkeys | quirky playful / 俏皮 欢快 |
| 恐惧 | 0.24 / 0.62 | 0.55 / 0.35 | Anxiety | dark ambient suspense / 悬疑 配乐 |
| 厌恶 | 0.30 / 0.45 | 0.55 / 0.45 | The House of Leaves | dark jazz moody / 暗黑 爵士 |

低置信度或 `emotion=null` 时：固定使用平静方案（`blend=0.5`），并在 UI 显示「情绪不明显，先来点舒缓的」。

## 3. 单曲打分

\[
S = 40\cdot tag+22\cdot(1-|V_s-V_t|)+18\cdot(1-|A_s-A_t|)+10\cdot freshness+5\cdot local+5\cdot jitter
\]

| 项 | 规则 |
|---|---|
| `tag` | 主标签 = 1.0；次标签包含目标情绪 = 0.6；相关标签 = 0.25；否则 0 |
| `freshness` | 最近播放过 = 0.35，否则 1.0 |
| `local` | 本地/已缓存 = 1，在线 = 0 |
| `jitter` | `mulberry32(seed + song.id)` 映射到 [-1,1]，范围 ±5 分 |
| 总分 | 截断到 0–100，保留两位小数 |

相关标签表（`profiles.js` 的 `RELATED_TAGS`）：

```text
happy → surprised
sad → calm
angry → disgusted
calm → sad
surprised → happy
fearful → disgusted, sad
disgusted → angry
```

### 示例：高兴 + Happy Alley

目标 V/A = 0.82/0.68（高兴的共情与治愈相同）。Happy Alley：主标签 happy、V=0.82、A=0.68、本地。

```text
tag      = 1.00 × 40 = 40.0
valence  = (1 − 0.00) × 22 = 22.0
arousal  = (1 − 0.00) × 18 = 18.0
freshness= 1.00 × 10 = 10.0
local    = 1.00 × 5  = 5.0
jitter   ≈ −2.0
合计     ≈ 93.0
```

这与桌面截图中的 93 分一致。

## 4. 多样性重排

按分数做贪心选择，每选一首后对剩余歌曲施加：

| 冲突 | 惩罚 |
|---|---|
| 同艺人 | −15 |
| 同 genre | −8 |
| 同一主标签已选 ≥ 2 首 | −6 |
| 属于上一批前 2 首（换一批时） | −20 |

最终取前 6 首。这样既保留高分匹配，又避免整页都是同一艺人/曲风。

## 5. 本地兜底

在所有候选（本地 + 缓存 + 在线）排序完成后：

- 如果结果中没有本地/已缓存歌曲，取本地最高分插入第 3 位（`Math.min(2, length)`），再截断到 6 首。
- 这样即使完全断网或 iTunes 不可用，用户始终有可播放内容。

注意：在线歌曲可以排第一（例如平静方案下在线匹配分 93 > 本地 91）；本地兜底只保证“至少一首”，不强行霸占第一名。

## 6. 换一批与可复现性

- 点击「换一批」：`seed += 1`，重新计算 jitter；在线检索词按 `seed % terms.length` 轮换。
- 同一 `seed`、同一曲库、同一目标向量下，排序完全可复现（`tests/rank.test.mjs` 验证）。
- 上一批前 2 首会获得 −20 软惩罚，减少重复感。

## 7. 触发时机

- 单张图片：每次分析完成（`stableToken` 增加）立即刷新。
- 视频/摄像头：只在平滑器确认标签切换时刷新；置信度小幅波动不重排。
- 设置改变：`blend` / `online` / `country` 变化后 280ms 防抖重排。
- 历史 chip 点击：用该情绪以 0.9 置信度重新生成歌单。

## 8. 在线曲库（iTunes Search API）

- 端点：`https://itunes.apple.com/search`，参数 `term`、`media=music`、`entity=song`、`limit=20`、`country=tw|us`。
- 每次刷新最多 1 个请求；全局最小间隔 1.5 秒；`AbortController` 8 秒超时。
- 相同 `country:term` 结果缓存 10 分钟；`seed` 轮换检索词以增加多样性。
- 只保留 `kind === 'song'` 且 `previewUrl` 非空的条目，按 `trackId` 去重。
- 字段映射：`id=itunes-<trackId>`；封面 `100x100bb` → `400x400bb`；`duration=30`；保留 `trackViewUrl`。
- 429/403：提示「在线曲库限流，稍后再试」，保留本地歌单；网络错误：提示离线；封面失败：用情绪渐变占位。
- 适配层接口：

```js
{
  id: 'itunes',
  label: 'Apple iTunes 试听',
  available(): boolean,
  search({ emotion, confidence, blend, seed, country, signal }): Promise<Song[]>
}
```

已注册 `local`、`cache`、`itunes`。`registry.js` 中保留了未启用的 `neteaseProviderStub` 作为扩展点，不发起任何请求。

## 9. 本地缓存

- 「缓存到本地」：`fetch(previewUrl)`（CORS `*`）→ 流式读取并显示进度 → Blob 存入 IndexedDB。
- 数据库 `moodtunes` v1：`catalog` 存元数据、`audio` 存 Blob、`plays` 存播放记录。
- 上限 30 首 / 150MB，超出按 `savedAt` LRU 淘汰。
- 启动时只加载 `catalog` 元数据参与推荐；播放时再取 Blob，避免把全部音频读入内存。
- 缓存歌曲进入候选池，`local=true`、`cached=true`，断网可播放；设置面板可查看占用、清空缓存。

## 10. 可解释性

每张歌曲卡可展开「推荐依据」，显示：

- `tag / valence / arousal / freshness / local / jitter` 六项各加了多少分；
- 推荐理由 chip：标签匹配、次标签、相关情绪、效价接近、唤醒度接近、本地可离线、30 秒试听、最近听过降权；
- 在线歌曲的署名与来源链接。

推荐面板顶部显示当前目标 `V/A`、策略百分比、批次号、本地/缓存数量，便于演示“情绪变了 → 目标向量变了 → 排序变了”。

## 11. 调参

| 现象 | 调整 |
|---|---|
| 总推同一首 | 增大 `jitter` 或 `freshness` 权重；点击「换一批」 |
| 在线歌曲太多 | 提高 `local` 权重，或在 UI 关闭在线补充 |
| 悲伤时推太多欢快歌 | 降低 `blend`（更偏治愈）会提高目标 V；若想更贴近悲伤，提高 `blend` 并增加 sad 主标签权重 |
| 推荐不够多样 | 增大同艺人/同 genre 惩罚 |
| 断网无歌 | 检查本地 7 首是否完整、缓存是否被清空 |

## 12. 测试

`tests/rank.test.mjs` 覆盖：

- 7 种情绪的第一名与主标签匹配；
- 每种情绪结果至少含 1 首本地/缓存；
- 同 seed 结果完全一致；
- 同艺人惩罚生效；
- 低置信度回落平静方案；
- 空曲库安全返回。

`tests/itunesMapper.test.mjs` 覆盖试听过滤、封面升级、字段映射与空输入。

## 13. 已知边界

- 在线 V/A 是关键词代理，不是音频分析；同一首歌在不同情绪下可能被赋予不同 V/A。
- iTunes 只有 30 秒试听，且曲库/地区可用性由 Apple 决定。
- 本地曲目的 V/A 是人工标注，用于演示推荐公式；不代表音乐学上的精确测量。
- 推荐结果不代表心理治疗建议。
