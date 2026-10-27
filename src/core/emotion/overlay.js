/**
 * overlay.js — 在媒体舞台上绘制人脸框、68 点与情绪标签。
 * 处理 object-fit: contain 的留白、摄像头镜像、DPR。
 */
import { EMOTIONS } from './taxonomy.js';

function contentRect(width, height, mediaAspect) {
  const boxAspect = width / height;
  if (boxAspect > mediaAspect) {
    const contentHeight = height;
    const contentWidth = contentHeight * mediaAspect;
    return { x: (width - contentWidth) / 2, y: 0, width: contentWidth, height: contentHeight };
  }
  const contentWidth = width;
  const contentHeight = contentWidth / mediaAspect;
  return { x: 0, y: (height - contentHeight) / 2, width: contentWidth, height: contentHeight };
}

function labelFor(face) {
  if (!face.isPrimary) return '人脸';
  const key = face.emotion || face.candidate;
  const meta = EMOTIONS[key];
  const name = face.emotion ? meta?.label : '情绪不明显';
  const confidence = Math.round((face.confidence || 0) * 100);
  return `${name || '分析中'} ${confidence}%`;
}

function roundRect(ctx, x, y, w, h, r) {
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawOverlay(canvas, container, faces, workWidth, workHeight, options = {}) {
  const { mirrored = false, primaryOnly = false } = options;
  if (!canvas || !container) return;
  const rect = container.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  const dpr = Math.min(2, window.devicePixelRatio || 1);

  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  if (!faces?.length || !workWidth || !workHeight) return;
  const content = contentRect(width, height, workWidth / workHeight);
  const sx = content.width / workWidth;
  const sy = content.height / workHeight;

  for (const face of faces) {
    if (primaryOnly && !face.isPrimary) continue;
    const box = face.box;
    const rawX = mirrored ? content.x + content.width - (box.x + box.width) * sx : content.x + box.x * sx;
    const y = content.y + box.y * sy;
    const w = box.width * sx;
    const h = box.height * sy;
    const key = face.emotion || face.candidate;
    const color = face.isPrimary ? EMOTIONS[key]?.color || '#6ea8ff' : 'rgba(180, 200, 255, 0.55)';

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = face.isPrimary ? 2 : 1.2;
    ctx.shadowColor = color;
    ctx.shadowBlur = face.isPrimary ? 14 : 0;
    roundRect(ctx, rawX, y, w, h, 10);
    ctx.stroke();
    ctx.shadowBlur = 0;

    if (face.landmarks?.length) {
      ctx.fillStyle = color;
      ctx.globalAlpha = face.isPrimary ? 0.9 : 0.55;
      for (const point of face.landmarks) {
        const px = mirrored ? content.x + content.width - point.x * sx : content.x + point.x * sx;
        const py = content.y + point.y * sy;
        ctx.beginPath();
        ctx.arc(px, py, face.isPrimary ? 1.5 : 1.1, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    const label = labelFor(face);
    ctx.font = '600 12px "Segoe UI", "Microsoft YaHei", system-ui, sans-serif';
    const textWidth = ctx.measureText(label).width;
    const labelW = textWidth + 16;
    const labelH = 24;
    let labelX = Math.min(Math.max(rawX, 4), width - labelW - 4);
    let labelY = y - labelH - 6;
    if (labelY < 4) labelY = y + 6;

    ctx.fillStyle = 'rgba(7, 11, 20, 0.82)';
    roundRect(ctx, labelX, labelY, labelW, labelH, 8);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.fillText(label, labelX + 8, labelY + 16);
    ctx.restore();
  }
}
