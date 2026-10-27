/**
 * useCamera.js — getUserMedia 的薄封装：错误映射、清理、单例流。
 */
import { reactive } from 'vue';

const state = reactive({
  status: 'idle',
  error: null,
});

let stream = null;
let videoEl = null;

const MESSAGES = {
  NotAllowedError: '摄像头权限被拒绝，请点击地址栏的摄像头图标允许后重试。',
  NotFoundError: '没有找到可用的摄像头。',
  NotReadableError: '摄像头可能被其他应用占用，请关闭其他程序后重试。',
  OverconstrainedError: '摄像头不支持请求的分辨率，请更换设备。',
  SecurityError: '摄像头需要 https 或 localhost 环境才能使用。',
  AbortError: '摄像头启动被中断，请重试。',
};

function mapError(err) {
  if (!err) return '摄像头启动失败。';
  const name = err.name || '';
  return MESSAGES[name] || `摄像头启动失败：${err.message || name}`;
}

export function stopCamera() {
  if (stream) {
    for (const track of stream.getTracks()) track.stop();
    stream = null;
  }
  if (videoEl) {
    try {
      videoEl.pause();
    } catch {
      // ignore
    }
    videoEl.srcObject = null;
    videoEl = null;
  }
  state.status = 'idle';
}

export async function startCamera(element) {
  stopCamera();
  state.error = null;

  if (!window.isSecureContext) {
    state.status = 'error';
    state.error = MESSAGES.SecurityError;
    throw new Error(state.error);
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    state.status = 'error';
    state.error = '当前浏览器不支持摄像头采集。';
    throw new Error(state.error);
  }

  state.status = 'starting';
  videoEl = element;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user',
      },
    });
    videoEl.srcObject = stream;
    await videoEl.play();
    state.status = 'active';
    return stream;
  } catch (err) {
    state.status = 'error';
    state.error = mapError(err);
    stopCamera();
    throw err;
  }
}

export function useCamera() {
  return {
    camera: state,
    start: startCamera,
    stop: stopCamera,
    getStream: () => stream,
  };
}
