/**
 * 本地曲库元数据。音频文件由 scripts/download-audio.mjs 预下载到 public/audio/local。
 */
const BASE = import.meta.env?.BASE_URL ?? '/';

export function attributionText(title) {
  return `"${title}" Kevin MacLeod (incompetech.com) Licensed under Creative Commons: By Attribution 4.0 License http://creativecommons.org/licenses/by/4.0/`;
}

const TRACKS = [
  {
    id: 'local-happy-alley',
    title: 'Happy Alley',
    slug: 'happy-alley',
    emotion: 'happy',
    tags: ['happy', 'upbeat'],
    valence: 0.82,
    arousal: 0.68,
    tempo: 126,
    genre: 'pop',
    duration: 0,
  },
  {
    id: 'local-heartbreaking',
    title: 'Heartbreaking',
    slug: 'heartbreaking',
    emotion: 'sad',
    tags: ['sad', 'calm'],
    valence: 0.22,
    arousal: 0.28,
    tempo: 68,
    genre: 'piano',
    duration: 0,
  },
  {
    id: 'local-volatile-reaction',
    title: 'Volatile Reaction',
    slug: 'volatile-reaction',
    emotion: 'angry',
    tags: ['angry', 'intense'],
    valence: 0.3,
    arousal: 0.85,
    tempo: 150,
    genre: 'electronic',
    duration: 0,
  },
  {
    id: 'local-peaceful-desolation',
    title: 'Peaceful Desolation',
    slug: 'peaceful-desolation',
    emotion: 'calm',
    tags: ['calm', 'sad'],
    valence: 0.48,
    arousal: 0.22,
    tempo: 60,
    genre: 'ambient',
    duration: 0,
  },
  {
    id: 'local-monkeys-spinning-monkeys',
    title: 'Monkeys Spinning Monkeys',
    slug: 'monkeys-spinning-monkeys',
    emotion: 'surprised',
    tags: ['surprised', 'happy', 'playful'],
    valence: 0.78,
    arousal: 0.78,
    tempo: 132,
    genre: 'orchestral',
    duration: 0,
  },
  {
    id: 'local-anxiety',
    title: 'Anxiety',
    slug: 'anxiety',
    emotion: 'fearful',
    tags: ['fearful', 'tense'],
    valence: 0.24,
    arousal: 0.62,
    tempo: 104,
    genre: 'cinematic',
    duration: 0,
  },
  {
    id: 'local-the-house-of-leaves',
    title: 'The House of Leaves',
    slug: 'the-house-of-leaves',
    emotion: 'disgusted',
    tags: ['disgusted', 'dark', 'mysterious'],
    valence: 0.3,
    arousal: 0.45,
    tempo: 88,
    genre: 'dark-ambient',
    duration: 0,
  },
];

export const LOCAL_SONGS = TRACKS.map((track) => ({
  id: track.id,
  source: 'local',
  title: track.title,
  artist: 'Kevin MacLeod',
  album: 'Incompetech · CC BY 4.0',
  cover: `${BASE}covers/${track.emotion}.svg`,
  audioUrl: `${BASE}audio/local/${track.slug}.mp3`,
  duration: track.duration,
  preview: false,
  emotionTags: track.tags,
  valence: track.valence,
  arousal: track.arousal,
  tempo: track.tempo,
  genre: track.genre,
  local: true,
  cached: false,
  mainEmotion: track.emotion,
  trackViewUrl: 'https://incompetech.com/music/royalty-free/',
  attribution: {
    text: attributionText(track.title),
    url: 'https://incompetech.com/music/royalty-free/',
    license: 'CC BY 4.0',
  },
}));

export const LOCAL_ATTRIBUTIONS = TRACKS.map((track) => ({
  title: track.title,
  slug: track.slug,
  text: attributionText(track.title),
}));
