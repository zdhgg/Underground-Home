<script setup lang="ts">
import type { DepthView } from '../render/camera'

defineProps<{ view: DepthView }>()
defineEmits<{ home: []; water: []; overview: [] }>()
</script>

<template>
  <nav class="depth-nav" aria-label="地下楼层">
    <button type="button" :aria-current="!view.overview && view.layer === 'home' ? 'location' : undefined" @click="$emit('home')"><span aria-hidden="true">⌂</span><span>1层 · 暖窝</span></button>
    <button type="button" class="water" :aria-current="!view.overview && view.layer === 'water' ? 'location' : undefined" @click="$emit('water')"><span aria-hidden="true">↓</span><span>2层 · 泉水</span></button>
    <button type="button" :aria-current="view.overview ? 'location' : undefined" @click="$emit('overview')"><span aria-hidden="true">⊞</span><span>全景</span></button>
  </nav>
</template>

<style scoped>
.depth-nav { display: flex; align-items: center; flex: none; gap: 4px; }
button { display: flex; align-items: center; justify-content: center; gap: 7px; min-height: 44px; padding: 0 16px; border-radius: 10px; background: transparent; color: #61736b; font-size: 14px; white-space: nowrap; }
button > span:first-child { font-size: 18px; }
button:hover { background: #edf2ee; }
button[aria-current] { background: #dfede3; color: #315f48; font-weight: 700; }
.water[aria-current] { color: #325f73; background: #deedf2; }
button:active { background: #d5e4dc; }
@media (max-width: 720px) { .depth-nav { width: 100%; }button { flex: 1; padding: 0 8px; font-size: 13px; } }
</style>
