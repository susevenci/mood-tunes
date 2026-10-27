/**
 * workCanvas.js — 把图片/视频帧缩放到固定宽度的工作画布，供 face-api 推理。
 * 复用同一块 canvas，避免每帧分配大对象。
 */
let shared = null;

function getShared() {
  if (!shared) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: false });
    shared = { canvas, ctx };
  }
  return shared;
}

function sourceSize(source) {
  return {
    width: source?.videoWidth || source?.naturalWidth || source?.width || 0,
    height: source?.videoHeight || source?.naturalHeight || source?.height || 0,
  };
}

/**
 * 把 source 画到共享工作画布。
 * @returns {{canvas:HTMLCanvasElement,width:number,height:number,sourceWidth:number,sourceHeight:number,scale:number}|null}
 */
export function drawToWork(source, maxWidth) {
  const { width: sw, height: sh } = sourceSize(source);
  if (!sw || !sh) return null;
  const { canvas, ctx } = getShared();
  const scale = Math.min(1, maxWidth / sw);
  const width = Math.max(1, Math.round(sw * scale));
  const height = Math.max(1, Math.round(sh * scale));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(source, 0, 0, width, height);
  return { canvas, width, height, sourceWidth: sw, sourceHeight: sh, scale };
}

/** 以原始分辨率冻结当前视频帧。 */
export function captureFrame(video) {
  const { width, height } = sourceSize(video);
  if (!width || !height) return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(video, 0, 0, width, height);
  return canvas;
}

/** 把 canvas 转成显示用的 JPEG DataURL。 */
export function canvasToDataUrl(canvas, quality = 0.92) {
  if (!canvas) return '';
  try {
    return canvas.toDataURL('image/jpeg', quality);
  } catch {
    return '';
  }
}
