# 人脸情绪识别算法说明书

本文档描述 MoodTunes 从画面输入到稳定情绪标签的完整逻辑。所有常量都能在代码中找到对应位置；修改权重或阈值时请同步本文与 `src/core/emotion/` 下的常量，并运行 `npm test`。

## 1. 总体流水线

```text
图片 / 视频帧 / 摄像头帧
  → 工作画布（等比缩放到固定宽度，复用同一 canvas）
  → TinyFaceDetector（人脸框 + 置信度）
  → FaceLandmark68Net（68 个 iBUG 关键点）
  → FaceExpressionNet（7 类表情 softmax）
  → 去滚转 + 按瞳距归一化
  → 几何特征（0–1）
  → 几何 + 表情加权融合 R(e)
  → 归一化 P(e)
  → 质量门控（惩罚置信度）
  → 单张直接输出 / 视频流中值 + EMA + 滞回
  → EmotionResult
```

推理完全在浏览器内执行，模型来自 `public/models`，不访问网络。

## 2. 模型与输入

| 模型 | 文件 | 作用 |
|---|---|---|
| TinyFaceDetector | `tiny_face_detector_model-*` | 检测人脸框与人脸置信度 |
| FaceLandmark68Net | `face_landmark_68_model-*` | 68 个关键点 |
| FaceExpressionNet | `face_expression_model-*` | `neutral / happy / sad / angry / fearful / disgusted / surprised` 7 类概率 |

参数（`src/config.js`）：

| 参数 | 图片 | 视频/摄像头 | CPU 降级 |
|---|---|---|---|
| 工作画布最大宽度 | 960px | 640px | 640px |
| `inputSize` | 512 | 320 | 224 |
| 检测阈值 | 0.35 | 0.35 | 0.35 |
| 目标帧率 | — | 8 FPS | 4 FPS |

- 每帧只保留面积最大的人脸作为主结果；多脸时其他脸也会画出框与点，但推荐只使用主脸。
- 全局 `busy` 锁避免上一帧推理未完成时重复调用。
- 模型加载后会用 96×96 空白画布做一次 warmup，减少首帧卡顿。

## 3. 归一化

### 3.1 去滚转

左右眼中心：

\[
L=\operatorname{mean}(p_{36..41}),\quad R=\operatorname{mean}(p_{42..47})
\]

眼线角度：

\[
\theta=\operatorname{atan2}(R_y-L_y,\ R_x-L_x)
\]

将所有点绕双眼中点旋转 \(-\theta\)，使眼线水平；`tiltDeg = |θ|·180/π` 用于质量门控。

### 3.2 尺度归一化

\[
d=\|R-L\|,\quad x'=\frac{x-c_x}{d},\quad y'=\frac{y-c_y}{d}
\]

之后所有距离、垂直差都以 \(d\) 为单位，因此对画面缩放、分辨率、人脸远近不敏感。`d < 1e-6` 或点数不足 68 时返回无效特征（全 0），由评分层判为不确定。

## 4. 几何特征

`softRange(x, lo, hi)` 是带 smoothstep 的线性映射：低于 `lo` 为 0，高于 `hi` 为 1，中间平滑过渡。图像坐标 y 向下为正。

| 特征 | 关键点 | 公式（归一化后） | 映射区间 | 含义 |
|---|---|---|---|---|
| `smile` | 48,54,62,66 | `mouthCenterY − cornerMeanY`，其中 mouthCenter=(62.y+66.y)/2，cornerMean=(48.y+54.y)/2 | 0.00–0.06 | 嘴角高于内唇中心 |
| `frown` | 同上 | `cornerMeanY − mouthCenterY` | 0.02–0.08 | 嘴角低于内唇中心 |
| `eyeOpen` | 36–47 | 左右眼 EAR 均值：`(dist(37,41)+dist(38,40))/(2·dist(36,39))` | 0.16–0.32 | 睁开度 |
| `eyeWide` | 同上 | `softRange(EAR, 0.20, 0.36)` | — | 睁大 |
| `eyeSquint` | 同上 | `1 − eyeOpen` | — | 眯眼/脸颊上提 |
| `browRaise` | 17–26,37,38,43,44 | 眉中到上眼睑的垂直距离均值 | 0.15–0.35 | 挑眉 |
| `innerBrowRaise` | 21,22,37,44 | 内眉到内眼角上方的垂直距离均值 | 0.10–0.24 | 内眉上抬 |
| `browFurrow` | 21,22 | `1 − softRange(dist(21,22), 0.15, 0.32)` | — | 双眉内收 |
| `browSlope` | 17,21,22,26 | 内眉均值 y − 外眉均值 y | 0.00–0.06 | 内眉下压（怒眉） |
| `mouthOpen` | 62,66 | `abs(66.y − 62.y)` | 0.02–0.28 | 张口 |
| `mouthWidth` | 48,54 | `abs(48.x − 54.x)` | 0.75–1.15 | 嘴横向拉伸 |
| `lipPress` | 62,66,48,54 | `(1 − mouthOpen) · mouthTightness`，`mouthTightness = 1 − softRange(mouthWidthRaw, 0.65, 0.95)` | 0–1 | 抿嘴 |
| `upperLipRaise` | 51,33 | `(1 − softRange(51.y−33.y, 0.20, 0.34)) · (1 − mouthWidth)` | 0–1 | 上唇上提；用嘴宽抑制大笑造成的假厌恶 |
| `lowActivation` | 上述 | `mean(1−eyeWide, 1−mouthOpen, 1−smile, 1−browRaise)` | 0–1 | 低唤醒（平静） |
| `maxGeo` | 上述 | `max(smile, frown, eyeWide, mouthOpen, browRaise, browFurrow, browSlope)` | 0–1 | 平静公式中的反向项 |

说明：

- 内唇中心（62/66）比外上唇（51）更适合作为“嘴角高度”的参照，因为大笑张口时 51 会被牙齿和上唇一起抬高，容易把笑容误判成“嘴角下垂”。
- 上唇上提同时受到嘴宽抑制：大笑时嘴宽接近 1，`upperLipRaise` 会接近 0；真正厌恶时嘴通常收窄，特征才会保留。
- 这些阈值是经验值，可在 `geometry.js` 顶部的 `FEATURE_RANGES` 中调整。

## 5. 融合评分

对每个情绪 \(e\)：

\[
R(e)=\sum_i w_{e,i}\,f_i + w_{e,expr}\,E(e)
\]

其中 \(f_i\) 是几何特征（0–1），\(E(e)\) 是表情 CNN 对应类别的概率。权重（`src/core/emotion/scoring.js` 的 `WEIGHTS`，每行合计 1.0）：

| 情绪 | 几何项 | 表情项 |
|---|---|---|
| 高兴 happy | smile .20 + mouthWidth .10 + eyeSquint .10 | expr.happy .60 |
| 悲伤 sad | frown .20 + innerBrowRaise .12 + lipPress .08 | expr.sad .60 |
| 愤怒 angry | browFurrow .10 + browSlope .08 + lipPress .12 + eyeSquint .10 | expr.angry .60 |
| 惊讶 surprised | eyeWide .15 + mouthOpen .15 + browRaise .05 | expr.surprised .65 |
| 恐惧 fearful | eyeWide .12 + innerBrowRaise .10 + browRaise .06 + mouthOpen .06 | expr.fearful .66 |
| 厌恶 disgusted | upperLipRaise .10 + lipPress .05 + browFurrow .03 | expr.disgusted .82 |
| 平静 calm | lowActivation .15 + (1 − maxGeo) .10 | expr.neutral .75 |

设计取舍：

- 表情 CNN 是主信号（60%–82%），几何特征是可见、可解释的校正项，避免纯黑盒。
- 厌恶的几何线索（68 点无法直接测鼻皱）最弱，因此表情权重最高（82%）。
- 平静使用 `neutral` 概率 + 低唤醒 + 反向最大几何激活，避免“没有明显表情”被误判成悲伤/愤怒。
- 若所有几何特征和表情概率都为 0（模型异常/空输入），直接返回均匀分布、置信度 0、判为不确定。

### 5.1 归一化

\[
P(e)=\frac{R(e)^{1.15}}{\sum_j R(j)^{1.15}}
\]

指数 1.15 轻微锐化分布。`confidence = P_top × qualityPenalty`，`margin = P_top − P_second`。

判定规则：

- `confidence ≥ 0.34` 且 `margin ≥ 0.06`：输出 top 情绪。
- 否则：`emotion = null`，保留 `candidate` 供 UI 显示“情绪不明显 / 候选 X”。

### 5.2 已实测示例（高兴示例照片）

表情 CNN：happy = 1.00，其余 0。几何：smile 1.00、mouthWidth 0.919、eyeSquint 0.103、mouthOpen 0.913、browRaise 0.589、innerBrowRaise 1.00、upperLipRaise 0.081、maxGeo 1.00。

\[
R(happy)=0.20(1)+0.10(0.919)+0.10(0.103)+0.60(1)=0.902
\]

其余原始分约为：fearful 0.259、surprised 0.253、sad 0.120、calm 0.035、angry 0.010、disgusted 0.008。归一化后：

```text
happy 62.4% · fearful 14.9% · surprised 14.5% · sad 6.1% · calm 1.5% · angry 0.4% · disgusted 0.3%
confidence = 62.4%，margin = 47.5% → 稳定判为「高兴」
```

这与浏览器实测结果一致，可用于回归验证（示例照片 `public/demo/happy.png`）。

悲伤示例照片的 CNN 同样饱和为 sad=1.00，几何提供 `innerBrowRaise=1.00` 与 `lipPress≈0.89`，最终稳定判为悲伤（约 58%）。

## 6. 质量门控

`assessQuality()` 只惩罚置信度，不直接丢弃结果：

| 条件 | 惩罚 | 提示 |
|---|---|---|
| 人脸宽度 / 工作画布宽度 < 0.10 | ×0.70 | 人脸过小，请靠近镜头 |
| `abs(tilt) > 32°` | ×0.75 | 头部倾斜较大，请正对镜头 |
| 检测置信度 < 0.50 | ×0.70 | 人脸置信度偏低 |
| 关键点无效 | ×0.50 | 关键点无效，请重新采集 |

多个惩罚相乘。UI 会在情绪面板显示质量警告；调试面板显示 `faceSize / tilt / det / penalty / tensors`。

## 7. 单张图片与视频流

### 单张 / 拍照

- 每张图片独立分析，不做时间平滑。
- 直接使用 `confidence` 阈值与 `margin` 判断是否“情绪不明显”。
- 多脸时取面积最大者，其他脸仅绘制框和点。

### 视频 / 摄像头

- 目标 8 FPS（CPU 4 FPS），优先使用 `requestVideoFrameCallback`，不支持时退回 `requestAnimationFrame` + 时间门限。
- 最近 5 帧每个情绪取中值，再做 EMA：

\[
\alpha=1-e^{-\Delta t/\tau},\quad \tau=450ms
\]

- 滞回：候选标签必须比当前标签高 `0.07`，并持续 `500ms`，才允许切换。
- 连续 `1200ms` 无人脸：清空当前情绪，并通知推荐层进入“情绪不明显”方案。
- 切换采集源、停止、页面隐藏时取消循环并重置平滑器。
- 页面隐藏时跳过推理；恢复可见后自动继续。

## 8. 调试与可解释性

情绪面板右上角的“眼睛”按钮打开 `FeatureDebug`：

- 表情 CNN 7 类概率；
- 全部几何特征（0–1）；
- 当前候选的逐项融合贡献（weight × value）；
- 归一化后的 7 类概率；
- 质量门控值、惩罚、Tensor 数量；
- 引擎后端、单帧推理耗时、实时 FPS。

这些数值与本文公式一一对应，便于课堂演示、调参与回归。

## 9. 调参指南

| 现象 | 调整 |
|---|---|
| 大笑被误判为惊讶/恐惧 | 提高 happy 的 `mouthWidth` 权重，或降低 surprised/fearful 的 `mouthOpen` 权重 |
| 闭嘴微笑识别不出 | 降低 `smile` 的 `hi`（如 0.05），或提高 happy 几何权重 |
| 所有人被识别成平静 | 降低 calm 的 `exprWeight`（0.75 → 0.65），或提高 threshold 以上的几何信号 |
| 标签频繁跳动 | 增大 `hysteresis`（0.07 → 0.10）或 `holdMs`（500 → 700ms） |
| 侧脸误判多 | 收紧质量门控（tilt 32° → 25°），或提示用户正对镜头 |
| 想完全离线调参 | 修改 `src/config.js` 与 `geometry.js` / `scoring.js` 常量，刷新即可 |

## 10. 局限性

- 表情模型是通用 7 类分类器，训练数据与个体差异会造成偏差；本项目不做个体校准。
- 68 点无法可靠测量鼻皱、眼周细纹等 FACS 动作单元，因此厌恶/恐惧更依赖 CNN。
- 强逆光、遮挡（口罩、手）、侧脸、儿童、合成人像的准确率会下降。
- 结果仅用于娱乐与演示，不构成心理或医学建议。

## 11. 代码索引

| 模块 | 位置 |
|---|---|
| 情绪定义/颜色 | `src/core/emotion/taxonomy.js` |
| 几何特征/质量门控 | `src/core/emotion/geometry.js` |
| 融合评分/权重 | `src/core/emotion/scoring.js` |
| 时间平滑/滞回 | `src/core/emotion/smoother.js` |
| face-api 封装 | `src/core/emotion/faceEngine.js` |
| 工作画布/拍照 | `src/core/emotion/workCanvas.js` |
| 框/68 点绘制 | `src/core/emotion/overlay.js` |
| 采集状态机 | `src/composables/useFaceAnalysis.js` |
| 参数 | `src/config.js` |
| 单测 | `tests/geometry.test.mjs`、`tests/scoring.test.mjs`、`tests/smoother.test.mjs` |
