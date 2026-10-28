<script setup lang="ts">
import { computed, ref } from 'vue'
import type { DepthView } from '../render/camera'
import { STRATA } from '../core/world'
import { CHAPTER_ACCESS, type ChapterLayer } from '../app/depthAccess'

const props = defineProps<{ view: DepthView; crystalAvailable?: boolean; hallAvailable?: boolean; gardenAvailable?: boolean; finaleAvailable?: boolean; ruinsAvailable?: boolean; ventilationAvailable?: boolean; reservoirAvailable?: boolean }>()
const emit = defineEmits<{ home: []; water: []; crystal: []; hall: []; garden: []; reservoir: []; finale: []; ruins: []; ventilation: []; overview: []; locked: [reason: string] }>()
type Destination = DepthView['layer'] | 'overview'
const expanded = ref(false)
const root = ref<HTMLElement | null>(null)
const toggle = ref<HTMLButtonElement | null>(null)
const floors = computed(() => [
  { id: 'home', name: '1层 · 暖窝', short: '1 暖窝', available: true },
  { id: 'water', name: '2层 · 泉水', short: '2 泉水', available: true },
  { id: 'crystal', name: '3层 · 晶簇', short: '3 晶簇', available: props.crystalAvailable },
  { id: 'hall', name: '4层 · 大厅', short: '4 大厅', available: props.hallAvailable },
  { id: 'garden', name: '5层 · 花园', short: '5 花园', available: props.gardenAvailable },
  { id: 'reservoir', name: '6层 · 蓄水', short: '6 蓄水', available: props.reservoirAvailable },
  { id: 'ventilation', name: '7层 · 听风', short: '7 听风', available: props.ventilationAvailable },
  { id: 'ruins', name: '8层 · 遗迹', short: '8 遗迹', available: props.ruinsAvailable },
  { id: 'finale', name: '9层 · 暖光', short: '9 暖光', available: props.finaleAvailable },
  { id: 'overview', name: '家园全景', short: '全景', available: true },
] as const)
const current = computed(() => floors.value.find(floor => floor.id === (props.view.overview ? 'overview' : props.view.layer))?.name ?? STRATA[props.view.layer].name)
function navigate(id: Destination, available: boolean | undefined): void {
  closeMenu()
  if (!available) { emit('locked', CHAPTER_ACCESS[id as ChapterLayer].reason); return }
  // 各事件均为既有镜头/章节入口，不执行伙伴移动。
  switch (id) {
    case 'home': emit('home'); break
    case 'water': emit('water'); break
    case 'crystal': emit('crystal'); break
    case 'hall': emit('hall'); break
    case 'garden': emit('garden'); break
    case 'reservoir': emit('reservoir'); break
    case 'ventilation': emit('ventilation'); break
    case 'ruins': emit('ruins'); break
    case 'finale': emit('finale'); break
    case 'overview': emit('overview'); break
  }
}
function closeMenu(): void {
  if (!expanded.value) return
  expanded.value = false
  toggle.value?.focus({ preventScroll: true })
}
function leaveMenu(event: FocusEvent): void {
  if (!(event.relatedTarget instanceof Node) || !root.value?.contains(event.relatedTarget)) expanded.value = false
}
</script>

<template>
  <nav ref="root" class="depth-nav" aria-label="地下楼层" @keydown.esc.stop="closeMenu" @focusout="leaveMenu">
    <button ref="toggle" class="depth-toggle" type="button" :aria-expanded="expanded" aria-controls="depth-options" @click="expanded = !expanded">楼层 · {{ current }} <span aria-hidden="true">▾</span></button>
    <div id="depth-options" class="depth-options" :class="{ expanded }">
      <button v-for="floor in floors" :key="floor.id" type="button" :class="floor.id" :aria-disabled="!floor.available || undefined"
        :aria-label="`${floor.name}${floor.available ? '' : '，未开放，点按了解原因'}`"
        :aria-current="(view.overview ? floor.id === 'overview' : view.layer === floor.id) ? 'location' : undefined" @click="navigate(floor.id, floor.available)">
        <span v-if="!floor.available" class="lock" aria-hidden="true">🔒</span><span class="long">{{ floor.name }}</span><span class="short">{{ floor.short }}</span>
      </button>
    </div>
  </nav>
</template>

<style scoped>
.short, .depth-toggle { display: none; }
.depth-nav { position: relative; flex: none; }
.depth-options { display: flex; align-items: center; gap: 4px; }
button { display: flex; align-items: center; justify-content: center; gap: 4px; min-height: 44px; padding: 0 12px; border-radius: 10px; background: transparent; color: #61736b; font-size: 14px; white-space: nowrap; }
.depth-toggle { display: none; }
button:hover { background: #edf2ee; }
button:focus-visible { outline: 2px solid #577863; outline-offset: -2px; }
button[aria-current] { background: #dfede3; color: #315f48; font-weight: 700; }
button[aria-disabled] { color: #828881; background: #f1f1eb; }
.lock { font-size: 12px; }
.water[aria-current], .reservoir[aria-current] { color: #325f73; background: #deedf2; }
.garden[aria-current] { color: #3d7358; background: #dcebe0; }
.hall[aria-current], .ruins[aria-current] { color: #80603a; background: #efe4d1; }
.crystal[aria-current] { color: #5b6586; background: #e6e9f3; }
.ventilation[aria-current] { color: #736184; background: #e9e3ef; }
.finale[aria-current] { color: #886929; background: #f0e4c6; }
@media (max-width: 1280px) {
  .long { display: none; } .short { display: inline; }
  .depth-nav { width: 100%; } .depth-options { width: 100%; } button { flex: 1; padding: 0 4px; font-size: 11px; }
}
@media (max-width: 600px) {
  .depth-toggle { display: flex; width: 100%; font-size: 13px; }
  .depth-options { display: none; position: absolute; z-index: 8; top: 100%; right: 0; padding: 8px; background: #f9fcf9; border: 1px solid #dae5dc; box-shadow: 0 8px 24px #142c2433; border-radius: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .depth-options.expanded { display: grid; }
  .depth-options .long { display: inline; } .depth-options .short { display: none; }
  .depth-options button { font-size: 13px; }
}
</style>
