/**
 * 情绪分类定义。key 与 face-api 的表情键、推荐配置、UI 颜色一一对应。
 * 注意：face-api 输出 neutral，本项目把它映射为「平静 calm」。
 */
export const EMOTION_ORDER = [
  'happy',
  'sad',
  'angry',
  'calm',
  'surprised',
  'fearful',
  'disgusted',
];

export const EMOTIONS = {
  happy: {
    key: 'happy',
    label: '高兴',
    en: 'Happy',
    color: '#ffb23e',
    soft: 'rgba(255, 178, 62, 0.16)',
    gradient: ['#ffb23e', '#ff7a3d'],
    hint: '嘴角上扬、眼睛微眯',
  },
  sad: {
    key: 'sad',
    label: '悲伤',
    en: 'Sad',
    color: '#5b8def',
    soft: 'rgba(91, 141, 239, 0.16)',
    gradient: ['#5b8def', '#3d4f9f'],
    hint: '内眉上抬、嘴角下垂',
  },
  angry: {
    key: 'angry',
    label: '愤怒',
    en: 'Angry',
    color: '#ff5a5f',
    soft: 'rgba(255, 90, 95, 0.16)',
    gradient: ['#ff5a5f', '#a1122b'],
    hint: '皱眉、抿嘴、目光收紧',
  },
  calm: {
    key: 'calm',
    label: '平静',
    en: 'Calm',
    color: '#2ed6b3',
    soft: 'rgba(46, 214, 179, 0.16)',
    gradient: ['#2ed6b3', '#127a86'],
    hint: '面部放松、低唤醒',
  },
  surprised: {
    key: 'surprised',
    label: '惊讶',
    en: 'Surprised',
    color: '#b983ff',
    soft: 'rgba(185, 131, 255, 0.16)',
    gradient: ['#b983ff', '#5b3fd6'],
    hint: '睁眼、张嘴、挑眉',
  },
  fearful: {
    key: 'fearful',
    label: '恐惧',
    en: 'Fearful',
    color: '#7b6cff',
    soft: 'rgba(123, 108, 255, 0.16)',
    gradient: ['#7b6cff', '#2c2a6e'],
    hint: '睁眼、内眉上抬、紧张',
  },
  disgusted: {
    key: 'disgusted',
    label: '厌恶',
    en: 'Disgusted',
    color: '#a3d65c',
    soft: 'rgba(163, 214, 92, 0.16)',
    gradient: ['#a3d65c', '#41663a'],
    hint: '上唇上提、皱鼻',
  },
};

/** face-api 的 7 个表情键。 */
export const EXPRESSION_KEYS = [
  'neutral',
  'happy',
  'sad',
  'angry',
  'fearful',
  'disgusted',
  'surprised',
];

export const EXPRESSION_LABELS = {
  neutral: '平静',
  happy: '高兴',
  sad: '悲伤',
  angry: '愤怒',
  fearful: '恐惧',
  disgusted: '厌恶',
  surprised: '惊讶',
};

export function isEmotion(key) {
  return Object.prototype.hasOwnProperty.call(EMOTIONS, key);
}

export function emotionMeta(key) {
  return EMOTIONS[key] ?? EMOTIONS.calm;
}

export function emptyExpressionMap() {
  return Object.fromEntries(EXPRESSION_KEYS.map((key) => [key, 0]));
}
