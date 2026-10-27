/**
 * geometry.js — 68 点几何特征（纯函数，无 DOM / 无 face-api 依赖）
 *
 * 约定：
 * - 输入为 iBUG 68 点，形如 [{x,y}, ...] 或 [[x,y], ...]，单位为像素；
 * - 先按双眼连线做去滚转，再以瞳距 d 归一化，最后计算 0..1 的特征；
 * - 图像坐标 y 向下为正；
 * - 所有阈值集中在此文件顶部，便于对照文档调参。
 */

/** 特征 softRange 的上下界（归一化后）。 */
export const FEATURE_RANGES = {
  smile: [0.0, 0.06],
  frown: [0.02, 0.08],
  eyeOpen: [0.16, 0.32],
  eyeWide: [0.2, 0.36],
  browRaise: [0.15, 0.35],
  innerBrowRaise: [0.1, 0.24],
  browFurrow: [0.15, 0.32],
  browSlope: [0.0, 0.06],
  mouthOpen: [0.02, 0.28],
  mouthWidth: [0.75, 1.15],
  mouthTightness: [0.65, 0.95],
  upperLipRaise: [0.2, 0.34],
};

const clamp01 = (v) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));

function smoothstep(t) {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

/** 把 value 从 [lo, hi] 平滑映射到 [0, 1]，超出范围截断。 */
export function softRange(value, lo, hi) {
  if (!Number.isFinite(value)) return 0;
  if (hi === lo) return value >= hi ? 1 : 0;
  return smoothstep((value - lo) / (hi - lo));
}

const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function asPoint(p) {
  if (!p) return null;
  if (Array.isArray(p)) return { x: Number(p[0]), y: Number(p[1]) };
  return { x: Number(p.x), y: Number(p.y) };
}

function center(points, indices) {
  const list = indices.map((i) => points[i]).filter(Boolean);
  return { x: mean(list.map((p) => p.x)), y: mean(list.map((p) => p.y)) };
}

/**
 * 去滚转 + 按瞳距归一化。
 * @param {Array} landmarks
 * @returns {{ok:boolean, points:Array<{x:number,y:number}>, d:number, angle:number, tiltDeg:number, reason?:string}}
 */
export function normalizeLandmarks(landmarks) {
  const points = Array.isArray(landmarks) ? landmarks.map(asPoint) : [];
  if (points.length < 68 || points.slice(0, 68).some((p) => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y))) {
    return { ok: false, points: [], d: 0, angle: 0, tiltDeg: 0, reason: 'landmark_invalid' };
  }

  const leftEye = center(points, [36, 37, 38, 39, 40, 41]);
  const rightEye = center(points, [42, 43, 44, 45, 46, 47]);
  const d = dist(leftEye, rightEye);
  if (!Number.isFinite(d) || d < 1e-6) {
    return { ok: false, points: [], d: 0, angle: 0, tiltDeg: 0, reason: 'interocular_zero' };
  }

  const cx = (leftEye.x + rightEye.x) / 2;
  const cy = (leftEye.y + rightEye.y) / 2;
  const angle = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);
  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);

  const normalized = points.slice(0, 68).map((p) => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    return {
      x: (dx * cos - dy * sin) / d,
      y: (dx * sin + dy * cos) / d,
    };
  });

  return {
    ok: true,
    points: normalized,
    d,
    angle,
    tiltDeg: Math.abs((angle * 180) / Math.PI),
  };
}

export function zeroFeatures() {
  return {
    smile: 0,
    frown: 0,
    eyeOpen: 0,
    eyeWide: 0,
    eyeSquint: 0,
    browRaise: 0,
    innerBrowRaise: 0,
    browFurrow: 0,
    browSlope: 0,
    mouthOpen: 0,
    mouthWidth: 0,
    lipPress: 0,
    upperLipRaise: 0,
    lowActivation: 0,
    maxGeo: 0,
  };
}

function eyeAspect(points, topA, topB, bottomA, bottomB, cornerA, cornerB) {
  const horizontal = dist(points[cornerA], points[cornerB]);
  if (horizontal < 1e-6) return 0;
  const vertical = Math.abs(points[topA].y - points[bottomA].y) + Math.abs(points[topB].y - points[bottomB].y);
  return vertical / (2 * horizontal);
}

/**
 * 从 68 点提取全部几何特征。
 * @param {Array} landmarks
 * @returns {{ok:boolean, features:object, diagnostics:object}}
 */
export function extractFeatures(landmarks) {
  const norm = normalizeLandmarks(landmarks);
  if (!norm.ok) {
    return {
      ok: false,
      features: zeroFeatures(),
      diagnostics: {
        reason: norm.reason,
        tiltDeg: 0,
        interocular: 0,
        ear: 0,
      },
    };
  }

  const n = norm.points;

  const earLeft = eyeAspect(n, 37, 38, 41, 40, 36, 39);
  const earRight = eyeAspect(n, 43, 44, 47, 46, 42, 45);
  const ear = (earLeft + earRight) / 2;

  const eyeOpen = softRange(ear, ...FEATURE_RANGES.eyeOpen);
  const eyeWide = softRange(ear, ...FEATURE_RANGES.eyeWide);
  const eyeSquint = clamp01(1 - eyeOpen);

  const browLeftY = mean([17, 18, 19, 20, 21].map((i) => n[i].y));
  const browRightY = mean([22, 23, 24, 25, 26].map((i) => n[i].y));
  const eyeTopLeftY = mean([37, 38].map((i) => n[i].y));
  const eyeTopRightY = mean([43, 44].map((i) => n[i].y));
  const browRaiseRaw = ((eyeTopLeftY - browLeftY) + (eyeTopRightY - browRightY)) / 2;

  const innerBrowRaiseRaw = ((n[37].y - n[21].y) + (n[44].y - n[22].y)) / 2;
  const browFurrowRaw = dist(n[21], n[22]);
  const browSlopeRaw = (n[21].y + n[22].y) / 2 - (n[17].y + n[26].y) / 2;

  const mouthCenterY = (n[62].y + n[66].y) / 2;
  const cornerMeanY = (n[48].y + n[54].y) / 2;
  const smileRaw = mouthCenterY - cornerMeanY;
  const frownRaw = cornerMeanY - mouthCenterY;

  const mouthOpenRaw = Math.abs(n[66].y - n[62].y);
  const mouthWidthRaw = dist(n[48], n[54]);
  const upperLipRaiseRaw = n[51].y - n[33].y;

  const smile = softRange(smileRaw, ...FEATURE_RANGES.smile);
  const frown = softRange(frownRaw, ...FEATURE_RANGES.frown);
  const mouthOpen = softRange(mouthOpenRaw, ...FEATURE_RANGES.mouthOpen);
  const mouthWidth = softRange(mouthWidthRaw, ...FEATURE_RANGES.mouthWidth);
  const browRaise = softRange(browRaiseRaw, ...FEATURE_RANGES.browRaise);
  const innerBrowRaise = softRange(innerBrowRaiseRaw, ...FEATURE_RANGES.innerBrowRaise);
  const browFurrow = 1 - softRange(browFurrowRaw, ...FEATURE_RANGES.browFurrow);
  const browSlope = softRange(browSlopeRaw, ...FEATURE_RANGES.browSlope);
  const upperLipRaiseBase = 1 - softRange(upperLipRaiseRaw, ...FEATURE_RANGES.upperLipRaise);
  // 大笑时上唇也会被拉高，用嘴宽抑制这类“假厌恶”。
  const upperLipRaise = clamp01(upperLipRaiseBase * (1 - mouthWidth));
  // 抿嘴 = 嘴巴闭合 + 嘴宽收窄（相对于中性嘴宽），避免中性脸也拿到高 lipPress。
  const mouthTightness = 1 - softRange(mouthWidthRaw, ...FEATURE_RANGES.mouthTightness);
  const lipPress = clamp01((1 - mouthOpen) * mouthTightness);

  const lowActivation = clamp01(
    mean([1 - eyeWide, 1 - mouthOpen, 1 - smile, 1 - browRaise]),
  );

  const maxGeo = Math.max(
    smile,
    frown,
    eyeWide,
    mouthOpen,
    browRaise,
    browFurrow,
    browSlope,
  );

  return {
    ok: true,
    features: {
      smile,
      frown,
      eyeOpen,
      eyeWide,
      eyeSquint,
      browRaise,
      innerBrowRaise,
      browFurrow,
      browSlope,
      mouthOpen,
      mouthWidth,
      lipPress,
      upperLipRaise,
      lowActivation,
      maxGeo,
    },
    diagnostics: {
      tiltDeg: norm.tiltDeg,
      interocular: norm.d,
      ear,
      smileRaw,
      frownRaw,
      mouthOpenRaw,
      mouthWidthRaw,
      browRaiseRaw,
      innerBrowRaiseRaw,
      browFurrowRaw,
      browSlopeRaw,
      upperLipRaiseRaw,
    },
  };
}

/**
 * 质量门控：只惩罚置信度，不丢弃结果。
 */
export function assessQuality({
  features,
  diagnostics,
  box,
  frameWidth,
  detectionScore,
  thresholds = { faceSize: 0.1, tiltDeg: 32, detectionScore: 0.5 },
}) {
  const penalties = [];
  const width = Number(box?.width) || 0;
  const faceSize = frameWidth > 0 ? width / frameWidth : 0;

  if (!features || !diagnostics || diagnostics.reason) {
    penalties.push({ code: 'invalid', message: '关键点无效，请重新采集', factor: 0.5 });
  }
  if (faceSize > 0 && faceSize < thresholds.faceSize) {
    penalties.push({ code: 'smallFace', message: '人脸过小，请靠近镜头', factor: 0.7 });
  }
  if ((diagnostics?.tiltDeg ?? 0) > thresholds.tiltDeg) {
    penalties.push({ code: 'tiltedFace', message: '头部倾斜较大，请正对镜头', factor: 0.75 });
  }
  if (Number.isFinite(detectionScore) && detectionScore < thresholds.detectionScore) {
    penalties.push({ code: 'lowDetection', message: '人脸置信度偏低', factor: 0.7 });
  }

  const penalty = penalties.reduce((acc, item) => acc * item.factor, 1);
  return {
    faceSize,
    tiltDeg: diagnostics?.tiltDeg ?? 0,
    detectionScore: Number.isFinite(detectionScore) ? detectionScore : 0,
    penalty,
    penalties,
    ok: penalties.length === 0,
  };
}
