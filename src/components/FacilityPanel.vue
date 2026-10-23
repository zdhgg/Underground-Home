<script setup lang="ts">
import type { FacilityUI } from '../app/facilityPanel'
const props = defineProps<{ state: FacilityUI }>()
const emit = defineEmits<{ close: []; primary: []; plant: []; look: [] }>()
const STAGE_ICONS = ['·', '🌱', '🌿', '🥕'] as const
const stageIcon = (stage: number): string => STAGE_ICONS[Math.min(stage, STAGE_ICONS.length - 1)]
</script>

<template>
  <section class="facility-tools" data-attention-panel="facility" aria-label="设施详情" @keydown.esc.stop="emit('close')">
    <header>
      <div><small>泉边的设施</small><strong>{{ state.icon }} {{ state.title }}</strong></div>
      <button class="close" type="button" aria-label="收起设施面板" @click="emit('close')">×</button>
    </header>
    <p v-if="state.slots.length" class="slots" aria-label="菜园状态">
      <span v-for="(slot, index) in state.slots" :key="index" :class="{ ripe: slot.stage >= 3 }">{{ stageIcon(slot.stage) }}</span>
    </p>
    <p class="summary">{{ state.summary }}</p>
    <button type="button" class="primary" data-primary-action :disabled="state.primary.kind === 'none'" @click="emit('primary')">{{ state.primary.label }}</button>
    <p class="hint">{{ state.hint }}</p>
    <div class="secondary">
      <button v-if="state.canPlant" type="button" @click="emit('plant')">🌱 自己摆菜槽</button>
      <button type="button" @click="emit('look')">看看它</button>
    </div>
  </section>
</template>

<style scoped>
.facility-tools { position: absolute; z-index: 4; left: 12px; top: 12px; width: 266px; max-width: calc(100% - 88px); max-height: calc(100% - 96px); overflow-y: auto; padding: 16px; border-radius: 16px; background: #f7faf7fa; color: #365447; box-shadow: 0 4px 16px #142c2424; }
header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
header div { display: grid; gap: 4px; } header small { color: #718278; font-size: 12px; } header strong { font-size: 20px; }
button { min-height: 44px; border-radius: 9px; color: #365b4b; background: #e9f0e9; font-size: 14px; }
button:hover { background: #dceadd; } button:focus-visible { outline: 3px solid #76ad91; outline-offset: 2px; } button:disabled { opacity: .55; cursor: default; }
.close { width: 44px; flex: none; font-size: 26px; background: transparent; }
.slots { display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 0 8px; padding: 10px 12px; border-radius: 10px; background: #eef4ea; font-size: 20px; }
.slots span { line-height: 1.4; }
.slots span.ripe { filter: drop-shadow(0 0 4px #d8b64faa); }
.summary { margin: 10px 0 12px; font-size: 14px; color: #4c6154; }
.primary { width: 100%; background: #3c8063; color: white; font-size: 16px; font-weight: 700; }
.primary:hover { background: #326f55; }
.hint { margin: 10px 0 12px; font-size: 12px; line-height: 1.6; color: #6e8577; }
.secondary { display: flex; gap: 8px; }
.secondary button { flex: 1; font-size: 13px; }
@media (max-width: 720px) {
  .facility-tools { top: auto; bottom: 80px; left: 12px; width: calc(100% - 24px); max-width: calc(100% - 24px); max-height: 46%; padding: 12px; }
  .slots { font-size: 17px; gap: 6px; }
}
</style>
