/**
 * smoother.js — 视频流的情绪时间平滑（纯类，可注入时间戳）
 *
 * 流程：最近 N 帧中值 → 指数滑动平均 EMA → 滞回切换。
 * 目的：抑制单帧误判导致的标签闪烁，同时保证情绪变化能在 ~0.5s 内跟上。
 */
import { EMOTION_ORDER } from './taxonomy.js';

const clamp01 = (v) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));

function medianOf(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export class EmotionSmoother {
  constructor(options = {}) {
    this.window = options.window ?? 5;
    this.tauMs = options.tauMs ?? 450;
    this.hysteresis = options.hysteresis ?? 0.07;
    this.holdMs = options.holdMs ?? 500;
    this.lostFaceMs = options.lostFaceMs ?? 1200;
    this.threshold = options.threshold ?? 0.34;
    this.reset();
  }

  reset() {
    this.buffer = [];
    this.ema = null;
    this.current = null;
    this.candidate = null;
    this.candidateSince = 0;
    this.lastTs = 0;
    this.lastFaceTs = 0;
  }

  _rank(probabilities) {
    return [...EMOTION_ORDER].sort((a, b) => (probabilities[b] ?? 0) - (probabilities[a] ?? 0));
  }

  _state(ts, changed = false) {
    const probabilities = this.ema ? { ...this.ema } : null;
    if (!probabilities) {
      return {
        emotion: null,
        confidence: 0,
        margin: 0,
        probabilities: null,
        candidate: null,
        changed,
        ts,
      };
    }
    const ranked = this._rank(probabilities);
    const top = ranked[0];
    const topProbability = probabilities[top] ?? 0;
    const others = ranked.filter((key) => key !== this.current);
    const second = others[0] ?? top;
    const confidence = this.current ? probabilities[this.current] ?? 0 : topProbability;
    const margin = this.current
      ? confidence - (probabilities[second] ?? 0)
      : topProbability - (probabilities[ranked[1]] ?? 0);
    return {
      emotion: this.current,
      confidence: clamp01(confidence),
      margin,
      probabilities,
      candidate: top,
      changed,
      ts,
    };
  }

  /** 没有检测到人脸时调用。 */
  handleNoFace(ts = Date.now()) {
    let changed = false;
    if (this.current && ts - this.lastFaceTs > this.lostFaceMs) {
      this.current = null;
      this.ema = null;
      this.buffer = [];
      this.candidate = null;
      this.candidateSince = 0;
      changed = true;
    }
    return this._state(ts, changed);
  }

  /**
   * @param {object|null} probabilities 7 类概率（键为 EMOTION_ORDER）
   * @param {number} ts 时间戳（ms）
   */
  push(probabilities, ts = Date.now()) {
    if (!probabilities) return this.handleNoFace(ts);

    this.lastFaceTs = ts;
    this.buffer.push({ ...probabilities });
    if (this.buffer.length > this.window) this.buffer.shift();

    const median = {};
    for (const key of EMOTION_ORDER) {
      median[key] = medianOf(this.buffer.map((item) => clamp01(item[key] ?? 0)));
    }

    if (!this.ema) {
      this.ema = { ...median };
    } else {
      const dt = this.lastTs ? Math.max(0, ts - this.lastTs) : 125;
      const alpha = 1 - Math.exp(-dt / this.tauMs);
      for (const key of EMOTION_ORDER) {
        this.ema[key] = alpha * median[key] + (1 - alpha) * (this.ema[key] ?? 0);
      }
    }
    this.lastTs = ts;

    const ranked = this._rank(this.ema);
    const top = ranked[0];
    const topProbability = this.ema[top] ?? 0;
    let changed = false;

    if (!this.current) {
      if (topProbability >= this.threshold) {
        this.current = top;
        changed = true;
      }
      this.candidate = null;
      this.candidateSince = 0;
      return this._state(ts, changed);
    }

    if (top === this.current) {
      this.candidate = null;
      this.candidateSince = 0;
      return this._state(ts, false);
    }

    const lead = topProbability - (this.ema[this.current] ?? 0);
    if (lead > this.hysteresis) {
      if (this.candidate !== top) {
        this.candidate = top;
        this.candidateSince = ts;
      }
      if (ts - this.candidateSince >= this.holdMs) {
        this.current = top;
        this.candidate = null;
        this.candidateSince = 0;
        changed = true;
      }
    } else {
      this.candidate = null;
      this.candidateSince = 0;
    }

    return this._state(ts, changed);
  }

  get state() {
    return this._state(this.lastTs, false);
  }
}
