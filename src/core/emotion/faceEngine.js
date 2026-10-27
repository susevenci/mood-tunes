/**
 * faceEngine.js — face-api 的加载与推理封装（纯本地，无网络请求）。
 * 动态 import 让 TFJS 不阻塞首屏；所有模型来自 public/models。
 */
import { APP_CONFIG } from '../../config.js';

let lib = null;
let loadingPromise = null;
let busy = false;

const engine = {
  status: 'idle',
  backend: '',
  progress: 0,
  step: '等待加载',
  error: null,
  light: false,
};

export function getEngineState() {
  return { ...engine };
}

export function getTensorCount() {
  try {
    return lib?.tf?.memory?.().numTensors ?? 0;
  } catch {
    return 0;
  }
}

/**
 * 加载模型；重复调用返回同一个 Promise。
 */
export function loadEngine(onProgress) {
  if (engine.status === 'ready') return Promise.resolve(lib);
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    engine.status = 'loading';
    engine.step = '加载推理引擎';
    engine.progress = 0.05;
    onProgress?.(getEngineState());

    try {
      lib = await import('@vladmandic/face-api');
      const tf = lib.tf;

      const webglOk = await tf.setBackend('webgl').catch(() => false);
      if (!webglOk) await tf.setBackend('cpu');
      await tf.ready();
      engine.backend = tf.getBackend();
      engine.light = engine.backend !== 'webgl';
      engine.step = engine.light ? 'CPU 模式（性能降级）' : 'WebGL 就绪';
      engine.progress = 0.12;
      onProgress?.(getEngineState());

      const uri = APP_CONFIG.modelsPath;
      const steps = [
        ['tinyFaceDetector', '加载人脸检测模型', 0.25],
        ['faceLandmark68Net', '加载 68 关键点模型', 0.5],
        ['faceExpressionNet', '加载表情模型', 0.75],
      ];
      for (const [net, step, progress] of steps) {
        engine.step = step;
        engine.progress = progress;
        onProgress?.(getEngineState());
        await lib.nets[net].loadFromUri(uri);
      }

      engine.step = '预热推理引擎';
      engine.progress = 0.92;
      onProgress?.(getEngineState());
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 96;
        canvas.height = 96;
        const options = new lib.TinyFaceDetectorOptions({
          inputSize: APP_CONFIG.engine.lowPowerInputSize,
          scoreThreshold: APP_CONFIG.engine.detectionThreshold,
        });
        await lib.detectAllFaces(canvas, options).withFaceLandmarks().withFaceExpressions();
      } catch {
        // 空白画布可能检测不到人脸，预热失败不影响正式推理。
      }

      engine.status = 'ready';
      engine.progress = 1;
      engine.step = '就绪';
      engine.error = null;
      onProgress?.(getEngineState());
      return lib;
    } catch (err) {
      engine.status = 'error';
      engine.error = err?.message || String(err);
      engine.step = '模型加载失败';
      loadingPromise = null;
      onProgress?.(getEngineState());
      throw err;
    }
  })();

  return loadingPromise;
}

/**
 * 对工作画布执行检测 + 68 点 + 表情。
 * @returns {Promise<{faces:Array,elapsedMs:number}|null>} null 表示上一帧仍在忙
 */
export async function detectFaces(source, { mode = 'image', inputSize, scoreThreshold } = {}) {
  if (!lib || engine.status !== 'ready') await loadEngine();
  if (busy) return null;
  busy = true;
  const started = performance.now();
  try {
    const size =
      inputSize ??
      (engine.light
        ? APP_CONFIG.engine.lowPowerInputSize
        : mode === 'image'
          ? APP_CONFIG.engine.imageInputSize
          : APP_CONFIG.engine.videoInputSize);
    const options = new lib.TinyFaceDetectorOptions({
      inputSize: size,
      scoreThreshold: scoreThreshold ?? APP_CONFIG.engine.detectionThreshold,
    });
    const results = await lib
      .detectAllFaces(source, options)
      .withFaceLandmarks()
      .withFaceExpressions();

    return {
      faces: (results ?? []).map((result) => ({
        box: {
          x: result.detection.box.x,
          y: result.detection.box.y,
          width: result.detection.box.width,
          height: result.detection.box.height,
        },
        score: result.detection.score,
        landmarks: result.landmarks.positions.map((point) => ({ x: point.x, y: point.y })),
        expressions: { ...result.expressions },
      })),
      elapsedMs: performance.now() - started,
    };
  } finally {
    busy = false;
  }
}

/** 选择面积最大的人脸作为主结果。 */
export function pickPrimaryFace(faces) {
  if (!faces?.length) return null;
  return faces.reduce((best, face) => {
    const area = face.box.width * face.box.height;
    return area > best.area ? { face, area } : best;
  }, { face: faces[0], area: faces[0].box.width * faces[0].box.height }).face;
}
