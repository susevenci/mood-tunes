<script setup>
import { computed } from 'vue';

const props = defineProps({
  name: { type: String, default: 'music' },
  size: { type: [Number, String], default: 18 },
});

const ICONS = {
  upload: ['M12 16V4', 'm7 9 5-5 5 5', 'M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3'],
  image: ['M4 4h16v16H4z', 'm4 16 5-5 4 4 3-3 4 4', 'M15 8.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0'],
  video: ['M4 6h11v12H4z', 'm15 10 5-3v10l-5-3'],
  camera: ['M4 8h3l2-3h6l2 3h3v12H4z', 'M12 13a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7'],
  snapshot: ['M4 8h3l2-3h6l2 3h3v12H4z', 'M12 13a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7', 'm18 4 .8 2.2L21 7l-2.2.8L18 10l-.8-2.2L15 7l2.2-.8z'],
  play: ['m8 5 11 7-11 7z'],
  pause: ['M8 5v14', 'M16 5v14'],
  next: ['m6 5 9 7-9 7z', 'M19 5v14'],
  prev: ['m18 5-9 7 9 7z', 'M5 5v14'],
  settings: ['M4 7h10', 'M18 7h2', 'M4 17h4', 'M12 17h8', 'M14 7a2 2 0 1 0 0.01 0', 'M8 17a2 2 0 1 0 0.01 0'],
  close: ['m6 6 12 12', 'M18 6 6 18'],
  sparkles: ['m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z', 'm19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7z'],
  music: ['M9 18V5l10-2v13', 'M6 18a3 3 0 1 0 6 0v-1H6z', 'M16 16a3 3 0 1 0 6 0v-1h-6z'],
  info: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 11v5', 'M12 8h.01'],
  check: ['m5 13 4 4L19 7'],
  trash: ['M4 7h16', 'M9 7V5h6v2', 'm6 7 1 13h10l1-13'],
  offline: ['M3 3l18 18', 'M8.5 8.5A6 6 0 0 1 18 12', 'M5 12a7 7 0 0 1 2-3', 'M12 20h.01'],
  volume: ['M4 10v4h3l4 3V7l-4 3z', 'M15 9a4 4 0 0 1 0 6', 'M17.5 6.5a8 8 0 0 1 0 11'],
  download: ['M12 4v10', 'm8 10 4 4 4-4', 'M5 20h14'],
  refresh: ['M20 12a8 8 0 1 1-2.3-5.7', 'M20 4v4h-4'],
  shuffle: ['M4 7h3l10 10h3', 'm17 4 3 3-3 3', 'M4 17h3l3-3', 'm17 14 3 3-3 3'],
  chevron: ['m9 6 6 6-6 6'],
  heart: ['M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z'],
  shield: ['M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6z', 'm9 12 2 2 4-4'],
  link: ['M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1', 'M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1'],
  algorithm: ['M5 5h5v5H5z', 'M14 14h5v5h-5z', 'M10 7.5h4a2 2 0 0 1 2 2V14', 'M7.5 10v4a2 2 0 0 0 2 2H14'],
  database: ['M12 3c4 0 7 1.3 7 3s-3 3-7 3-7-1.3-7-3 3-3 7-3z', 'M5 6v6c0 1.7 3 3 7 3s7-1.3 7-3V6', 'M5 12v6c0 1.7 3 3 7 3s7-1.3 7-3v-6'],
  clock: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 7v5l3 2'],
  alert: ['M12 3 2.5 20h19z', 'M12 9v5', 'M12 17h.01'],
  eye: ['M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
  external: ['M14 4h6v6', 'M20 4 10 14', 'M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5'],
  plus: ['M12 5v14', 'M5 12h14'],
  wave: ['M4 12h2l2-6 3 12 3-9 2 3h4'],
};

const iconPaths = computed(() => ICONS[props.name] || ICONS.music);
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path v-for="(path, index) in iconPaths" :key="index" :d="path" />
  </svg>
</template>
