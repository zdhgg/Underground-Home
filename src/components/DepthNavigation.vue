<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import type { DepthView } from '../render/camera'
import { STRATA } from '../core/world'
import { CHAPTER_ACCESS, type ChapterLayer } from '../app/depthAccess'

const props = defineProps<{ view: DepthView; crystalAvailable?: boolean; hallAvailable?: boolean; gardenAvailable?: boolean; finaleAvailable?: boolean; ruinsAvailable?: boolean; ventilationAvailable?: boolean; reservoirAvailable?: boolean }>()
const emit = defineEmits<{ home: []; water: []; crystal: []; hall: []; garden: []; reservoir: []; finale: []; ruins: []; ventilation: []; overview: []; locked: [reason: string] }>()
type Destination = DepthView['layer'] | 'overview'
/** 未开放楼层默认收起，先让孩子看见可以去的几层。 */
const deeperOpen = ref(false)
const floorList = ref<HTMLElement | null>(null)
const floors = computed(() => [
  { id: 'home', name: '1层 · 暖窝', available: true },
  { id: 'water', name: '2层 · 泉水', available: true },
  { id: 'crystal', name: '3层 · 晶簇', available: props.crystalAvailable },
  { id: 'hall', name: '4层 · 大厅', available: props.hallAvailable },
  { id: 'garden', name: '5层 · 花园', available: props.gardenAvailable },
  { id: 'reservoir', name: '6层 · 蓄水', available: props.reservoirAvailable },
  { id: 'ventilation', name: '7层 · 听风', available: props.ventilationAvailable },
  { id: 'ruins', name: '8层 · 遗迹', available: props.ruinsAvailable },
  { id: 'finale', name: '9层 · 暖光', available: props.finaleAvailable },
  { id: 'overview', name: '家园全景', available: true },
] as const)
const availableFloors = computed(() => floors.value.filter(floor => floor.id !== 'overview' && floor.available))
const lockedFloors = computed(() => floors.value.filter(floor => floor.id !== 'overview' && !floor.available))
/** 只是“正在看”的显示层：镜头中心仍然决定游戏规则。 */
const lookingId = computed(() => props.view.overview ? 'overview' : props.view.displayLayer ?? props.view.layer)
const looking = computed(() => floors.value.find(floor => floor.id === lookingId.value)?.name ?? STRATA[props.view.layer].name)
/** 楼层行自己会标“正在看”；只有岩盖等没有对应行的位置才需要这一行说明。 */
const showLookingCaption = computed(() => !floors.value.some(floor => floor.id === lookingId.value && floor.id !== 'overview'))
/** 只滚动楼层列表自身；不调用 scrollIntoView，避免带动外层小本子或整页。 */
function revealFirstLocked(): void {
  const list = floorList.value
  const first = list?.querySelector<HTMLElement>('.locked-floors button')
  if (!list || !first) return
  const listRect = list.getBoundingClientRect()
  const targetRect = first.getBoundingClientRect()
  const padding = 6
  // 已经完整露出时保持原位；否则把第一条锁定楼层移到列表上方。
  if (targetRect.top >= listRect.top + padding && targetRect.bottom <= listRect.bottom - padding) return
  list.scrollTop += targetRect.top - listRect.top - padding
}
async function toggleDeeper(): Promise<void> {
  deeperOpen.value = !deeperOpen.value
  await nextTick()
  const list = floorList.value
  if (!list) return
  if (deeperOpen.value) revealFirstLocked()
  else list.scrollTop = 0
}
function navigate(id: Destination, available: boolean | undefined): void {
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
</script>

<template>
  <nav class="depth-nav" aria-label="地下楼层">
    <p v-if="showLookingCaption" class="looking" aria-live="polite">正在看 · <b>{{ looking }}</b></p>
    <div class="floor-stack">
      <div ref="floorList" class="floors">
        <button v-for="floor in availableFloors" :key="floor.id" type="button" :class="floor.id"
          :aria-current="!view.overview && lookingId === floor.id ? 'location' : undefined"
          :aria-label="`${floor.name}${!view.overview && lookingId === floor.id ? '，正在看' : ''}`"
          @click="navigate(floor.id, floor.available)">
          <span class="dot" aria-hidden="true" /><span class="floor-name">{{ floor.name }}</span>
          <span v-if="!view.overview && lookingId === floor.id" class="here" aria-hidden="true">正在看</span>
        </button>
        <div v-show="deeperOpen" id="deeper-floors" class="locked-floors">
          <button v-for="floor in lockedFloors" :key="floor.id" type="button" class="locked" :class="floor.id"
            aria-disabled="true" :aria-label="`${floor.name}，未开放，点按了解原因`" @click="navigate(floor.id, false)">
            <span class="lock" aria-hidden="true">🔒</span><span class="floor-name">{{ floor.name }}</span>
          </button>
        </div>
      </div>
      <button v-if="lockedFloors.length" class="deeper-toggle" type="button" :aria-expanded="deeperOpen" aria-controls="deeper-floors" @click="toggleDeeper">
        <span aria-hidden="true">{{ deeperOpen ? '▾' : '▸' }}</span>{{ deeperOpen ? '收起没开放的楼层' : '看看更深的地方' }}
      </button>
    </div>
    <button class="overview" type="button" :aria-current="view.overview ? 'location' : undefined" @click="navigate('overview', true)">🗺️ 家园全景</button>
  </nav>
</template>

<style scoped>
.depth-nav { display: grid; gap: 7px; }
.looking { margin: 0; font-size: 11px; color: #7b8d7f; }
.looking b { color: #38644d; font-weight: 700; }
.floor-stack { display: grid; gap: 4px; }
.floors { display: grid; gap: 4px; max-height: 238px; overflow-y: auto; overscroll-behavior: contain; padding-right: 2px; }
button { display: flex; align-items: center; gap: 8px; width: 100%; min-height: 44px; padding: 8px 10px; border-radius: 10px; background: #f1f6ef; color: #3f5c4c; font-size: 14px; text-align: left; }
button:hover { background: #e7f0e4; }
button:focus-visible { outline: 3px solid #548c70; outline-offset: -2px; }
button[aria-current] { background: #dcecdf; color: #2f634a; font-weight: 700; }
.dot { width: 10px; height: 10px; flex: none; border-radius: 50%; border: 2px solid #a4bcaa; }
button[aria-current] .dot { background: #3f8a64; border-color: #3f8a64; }
.floor-name { min-width: 0; overflow-wrap: anywhere; }
.here { margin-left: auto; font-size: 11px; font-weight: 400; color: #3f8a64; white-space: nowrap; }
.deeper-toggle { background: transparent; color: #5d7868; font-size: 13px; }
.deeper-toggle:hover { background: #edf3ec; }
.locked-floors { display: grid; gap: 4px; }
.locked { background: #f4f3ee; color: #8b9088; font-size: 13px; }
.locked:hover { background: #efeee8; }
.locked .lock { flex: none; font-size: 12px; }
.overview { margin-top: 1px; background: #eaf2ea; color: #3f5c4c; font-weight: 600; }
.overview[aria-current] { background: #dcecdf; color: #2f634a; }
.water[aria-current] { color: #325f73; background: #deedf2; }
.garden[aria-current] { color: #3d7358; background: #dcebe0; }
.hall[aria-current], .ruins[aria-current] { color: #80603a; background: #efe4d1; }
.crystal[aria-current] { color: #5b6586; background: #e6e9f3; }
.ventilation[aria-current] { color: #736184; background: #e9e3ef; }
.finale[aria-current] { color: #886929; background: #f0e4c6; }
@media (prefers-reduced-motion: reduce) { button { transition: none; } }
</style>
