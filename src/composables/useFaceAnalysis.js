/**
 * useFaceAnalysis.js — 情绪分析的状态机与采集循环。
 * 负责：模型加载、单张分析、视频/摄像头实时循环、拍照冻结、历史与稳定标签。
 */
import { reactive } from 'vue';
import { APP_CONFIG } from '../config.js';
import {
  loadEngine,
  detectFaces,
  getEngineState,
  pickPrimaryFace,
} from '../core/emotion/faceEngine.js';
import { drawToWork, captureFrame, canvasToDataUrl } from '../core/emotion/workCanvas.js';
import { extractFeatures, assessQuality } from '../core/emotion/geometry.js';
import { scoreEmotions } from '../core/emotion/scoring.js';
import { EmotionSmoother } from '../core/emotion/smoother.js';
import { loadHistory, saveHistory, clearHistoryStorage } from '../core/storage/history.js';
import { startCamera, stopCamera, useCamera } from './useCamera.js';

const { camera } = useCamera();

const state = reactive({
  mode: 'idle',
  source: 'none',
  status: 'idle',
  engine: {
    status: 'idle',
    backend: '',
    progress: 0,
    step: '等待加载',
    error: null,
    light: false,
  },
  result: null,
  faces: [],
  workWidth: 0,
  workHeight: 0,
  mirrored: false,
  fps: 0,
  inferenceMs: 0,
  faceCount: 0,
  error: null,
  history: loadHistory(),
  stableEmotion: null,
  stableToken: 0,
  snapshotUrl: '',
  busy: false,
});

const smoother = new EmotionSmoother({
  window: APP_CONFIG.smoothing.window,
  tauMs: APP_CONFIG.smoothing.tauMs,
  hysteresis: APP_CONFIG.smoothing.hysteresis,
  holdMs: APP_CONFIG.smoothing.holdMs,
  lostFaceMs: APP_CONFIG.smoothing.lostFaceMs,
  threshold: APP_CONFIG.thresholds.confidence,
});

let initPromise = null;
let loopHandle = null;
let loopVideo = null;
let lastDetect = 0;
let fpsSamples = [];

function init() {
  if (initPromise) return initPromise;
  state.engine.status = 'loading';
  initPromise = loadEngine((snapshot) => {
    Object.assign(state.engine, snapshot);
  })
    .then(() => {
      Object.assign(state.engine, getEngineState());
      return true;
    })
    .catch((err) => {
      Object.assign(state.engine, getEngineState());
      state.engine.error = err?.message || '模型加载失败';
      return false;
    });
  return initPromise;
}

function retryEngine() {
  initPromise = null;
  state.engine.error = null;
  return init();
}

function cancelFrame() {
  if (!loopHandle) return;
  const { type, id, element } = loopHandle;
  loopHandle = null;
  if (type === 'rvfc' && element?.cancelVideoFrameCallback) {
    element.cancelVideoFrameCallback(id);
  } else {
    cancelAnimationFrame(id);
  }
}

function scheduleFrame(callback) {
  if (!loopVideo) return;
  if (typeof loopVideo.requestVideoFrameCallback === 'function') {
    loopHandle = {
      type: 'rvfc',
      element: loopVideo,
      id: loopVideo.requestVideoFrameCallback(callback),
    };
  } else {
    loopHandle = { type: 'raf', element: loopVideo, id: requestAnimationFrame(callback) };
  }
}

function processFace(face, work) {
  const geometry = extractFeatures(face.landmarks);
  const quality = assessQuality({
    features: geometry.features,
    diagnostics: geometry.diagnostics,
    box: face.box,
    frameWidth: work.width,
    detectionScore: face.score,
    thresholds: APP_CONFIG.thresholds,
  });
  const scored = scoreEmotions(geometry.features, face.expressions, quality.penalty);
  return {
    box: face.box,
    score: face.score,
    landmarks: face.landmarks,
    features: geometry.features,
    diagnostics: geometry.diagnostics,
    quality,
    candidate: scored.candidate,
    emotion: scored.emotion,
    confidence: scored.confidence,
    margin: scored.margin,
    uncertain: scored.uncertain,
    probabilities: scored.probabilities,
    rawScores: scored.rawScores,
    expressions: scored.expressions,
    contributions: scored.contributions,
    allContributions: scored.allContributions,
  };
}

function updateFps(ts) {
  fpsSamples.push(ts);
  while (fpsSamples.length && fpsSamples[0] < ts - 2000) fpsSamples.shift();
  if (fpsSamples.length > 1) {
    const span = fpsSamples[fpsSamples.length - 1] - fpsSamples[0];
    state.fps = span > 0 ? Math.round(((fpsSamples.length - 1) * 1000) / span) : 0;
  }
}

function pushHistory(result) {
  if (!result?.emotion) return;
  const last = state.history[0];
  if (last && last.emotion === result.emotion && result.ts - last.ts < 2500) return;
  state.history.unshift({
    ts: result.ts,
    emotion: result.emotion,
    confidence: result.confidence,
    mode: result.mode,
    faceCount: result.faceCount,
  });
  state.history = state.history.slice(0, 20);
  saveHistory(state.history);
}

function applyDetection(detection, work, { smooth }) {
  const ts = Date.now();
  const processed = detection.faces.map((face) => processFace(face, work));
  const primary = pickPrimaryFace(processed);

  state.workWidth = work.width;
  state.workHeight = work.height;
  state.inferenceMs = Math.round(detection.elapsedMs);
  state.faceCount = processed.length;
  state.faces = processed.map((face) => ({ ...face, isPrimary: face === primary }));

  if (!primary) {
    if (smooth) {
      const snapshot = smoother.handleNoFace(ts);
      if (snapshot.changed && state.stableEmotion) {
        state.stableEmotion = null;
        state.stableToken += 1;
      }
    } else {
      state.stableEmotion = null;
      state.stableToken += 1;
    }
    state.result = null;
    return;
  }

  if (smooth) {
    const snapshot = smoother.push(primary.probabilities, ts);
    const result = {
      ...primary,
      emotion: snapshot.emotion,
      confidence: snapshot.confidence,
      margin: snapshot.margin,
      probabilities: snapshot.probabilities ?? primary.probabilities,
      uncertain: !snapshot.emotion,
      ts,
      faceCount: processed.length,
      mode: state.source,
    };
    state.result = result;
    if (snapshot.changed) {
      state.stableEmotion = snapshot.emotion;
      state.stableToken += 1;
      pushHistory(result);
    }
    return;
  }

  const result = {
    ...primary,
    ts,
    faceCount: processed.length,
    mode: state.source,
  };
  state.result = result;
  state.stableEmotion = primary.emotion;
  state.stableToken += 1;
  pushHistory(result);
}

async function analyzeStill(source, { mode = 'image', mirrored = false } = {}) {
  cancelFrame();
  loopVideo = null;
  state.mode = mode;
  state.source = mode === 'snapshot' ? 'camera' : mode === 'video' ? 'video' : 'image';
  state.mirrored = mirrored;
  state.status = 'analyzing';
  state.error = null;
  state.faces = [];
  smoother.reset();

  const ready = await init();
  if (!ready || state.engine.status !== 'ready') {
    state.status = 'error';
    state.error = state.engine.error || '模型未就绪，请重试。';
    return null;
  }

  const work = drawToWork(source, APP_CONFIG.engine.imageMaxWidth);
  if (!work) {
    state.status = 'error';
    state.error = '无法读取画面，请更换图片或视频。';
    return null;
  }

  try {
    let detection = await detectFaces(work.canvas, { mode: 'image' });
    if (!detection) {
      state.status = 'paused';
      return null;
    }
    // 首次加载后偶发漏检：用更大输入与更低阈值再试一次。
    if (!detection.faces.length) {
      const retry = await detectFaces(work.canvas, {
        mode: 'image',
        inputSize: 640,
        scoreThreshold: 0.25,
      });
      if (retry) detection = retry;
    }
    applyDetection(detection, work, { smooth: false });
    state.status = 'paused';
    return state.result;
  } catch (err) {
    state.status = 'error';
    state.error = err?.message || '分析失败，请重试。';
    return null;
  }
}

async function tick() {
  if (!loopVideo || state.status !== 'live') return;
  scheduleFrame(tick);

  if (document.hidden || loopVideo.readyState < 2 || loopVideo.paused) return;
  const now = performance.now();
  const targetFps =
    state.engine.backend === 'cpu' ? APP_CONFIG.engine.lowPowerFps : APP_CONFIG.engine.targetFps;
  if (now - lastDetect < 1000 / targetFps) return;
  lastDetect = now;
  if (state.busy) return;

  const work = drawToWork(loopVideo, APP_CONFIG.engine.videoMaxWidth);
  if (!work) return;

  state.busy = true;
  try {
    const detection = await detectFaces(work.canvas, { mode: 'video' });
    if (!detection || state.status !== 'live') return;
    updateFps(now);
    applyDetection(detection, work, { smooth: true });
  } catch (err) {
    state.error = err?.message || '实时推理失败，请重试。';
    state.status = 'error';
    cancelFrame();
  } finally {
    state.busy = false;
  }
}

async function startLoop(videoElement, { mode = 'video', mirrored = false } = {}) {
  cancelFrame();
  loopVideo = videoElement;
  state.mode = mode;
  state.source = mode === 'camera' ? 'camera' : 'video';
  state.mirrored = mirrored;
  state.status = 'live';
  state.error = null;
  state.faces = [];
  state.result = null;
  state.stableEmotion = null;
  state.fps = 0;
  state.snapshotUrl = '';
  fpsSamples = [];
  lastDetect = 0;
  smoother.reset();

  const ready = await init();
  if (!ready || state.engine.status !== 'ready') {
    state.status = 'error';
    state.error = state.engine.error || '模型未就绪，请重试。';
    return false;
  }
  if (state.status === 'live' && loopVideo) scheduleFrame(tick);
  return true;
}

async function startCameraLoop(videoElement) {
  state.error = null;
  try {
    await startCamera(videoElement);
  } catch {
    state.status = 'error';
    state.error = camera.error || '摄像头启动失败。';
    return false;
  }
  const ok = await startLoop(videoElement, { mode: 'camera', mirrored: true });
  if (!ok) {
    stopCamera();
  }
  return ok;
}

function stopLoop() {
  cancelFrame();
  loopVideo = null;
  if (state.status === 'live') state.status = 'paused';
}

function stop() {
  cancelFrame();
  loopVideo = null;
  stopCamera();
  smoother.reset();
  state.mode = 'idle';
  state.source = 'none';
  state.status = 'idle';
  state.faces = [];
  state.result = null;
  state.stableEmotion = null;
  state.snapshotUrl = '';
  state.error = null;
  state.fps = 0;
  state.busy = false;
}

async function analyzeCurrentFrame(videoElement) {
  stopLoop();
  return analyzeStill(videoElement, { mode: 'video', mirrored: false });
}

async function captureSnapshot(videoElement) {
  const width = videoElement?.videoWidth ?? 0;
  const height = videoElement?.videoHeight ?? 0;
  if (!width || !height || width < 64 || height < 64) {
    state.error = '摄像头画面尚未就绪，请稍候再拍照。';
    return null;
  }
  const frame = captureFrame(videoElement);
  if (!frame) {
    state.error = '拍照失败，请确认摄像头画面正常。';
    return null;
  }
  state.snapshotUrl = canvasToDataUrl(frame);
  stopLoop();
  stopCamera();
  smoother.reset();
  await analyzeStill(frame, { mode: 'snapshot', mirrored: false });
  return { canvas: frame, dataUrl: state.snapshotUrl };
}

function clearHistory() {
  state.history = [];
  clearHistoryStorage();
}

export function useFaceAnalysis() {
  return {
    state,
    camera,
    init,
    retryEngine,
    analyzeStill,
    analyzeCurrentFrame,
    startLoop,
    startCameraLoop,
    stopLoop,
    stop,
    captureSnapshot,
    clearHistory,
  };
}
