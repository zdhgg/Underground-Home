<script setup lang="ts">
import type { DepthView } from '../render/camera'

defineProps<{ view: DepthView; crystalAvailable?: boolean; hallAvailable?: boolean; gardenAvailable?: boolean;finaleAvailable?:boolean;ruinsAvailable?:boolean;ventilationAvailable?:boolean;reservoirAvailable?:boolean }>()
defineEmits<{ home: []; water: []; crystal: []; hall: []; garden: [];reservoir:[];finale:[];ruins:[];ventilation:[]; overview: [] }>()
</script>

<template>
  <nav class="depth-nav" aria-label="地下楼层">
    <button type="button" :aria-current="!view.overview && view.layer === 'home' ? 'location' : undefined" @click="$emit('home')"><span aria-hidden="true">⌂</span><span class="long">1层 · 暖窝</span><span class="short">1 暖窝</span></button>
    <button type="button" class="water" :aria-current="!view.overview && view.layer === 'water' ? 'location' : undefined" @click="$emit('water')"><span aria-hidden="true">↓</span><span class="long">2层 · 泉水</span><span class="short">2 泉水</span></button>
    <button type="button" class="crystal" :disabled="!crystalAvailable" :title="crystalAvailable ? '查看晶簇层当前目标' : '和大家吃完第一顿饭后开放'" :aria-current="!view.overview && view.layer === 'crystal' ? 'location' : undefined" @click="$emit('crystal')"><span aria-hidden="true">◇</span><span class="long">3层 · 晶簇</span><span class="short">3 晶簇</span></button>
    <button type="button" class="hall" :disabled="!hallAvailable" :title="hallAvailable ? '查看暖光大厅当前目标' : '三层电梯第一次回家后开放'" :aria-current="!view.overview && view.layer === 'hall' ? 'location' : undefined" @click="$emit('hall')"><span aria-hidden="true">♧</span><span class="long">4层 · 大厅</span><span class="short">4 大厅</span></button>
    <button type="button" class="garden" :disabled="!gardenAvailable" :title="gardenAvailable ? '查看菌光花园当前目标' : '六人暖屋宴后开放'" :aria-current="!view.overview && view.layer === 'garden' ? 'location' : undefined" @click="$emit('garden')"><span aria-hidden="true">♧</span><span class="long">5层 · 花园</span><span class="short">5 花园</span></button>
    <button type="button" class="reservoir" :disabled="!reservoirAvailable" :title="reservoirAvailable?'查看蓄水回廊当前目标':'完成菌光花园散步后开放'" :aria-current="!view.overview&&view.layer==='reservoir'?'location':undefined" @click="$emit('reservoir')"><span aria-hidden="true">≈</span><span class="long">6层 · 蓄水</span><span class="short">6 蓄水</span></button>
    <button type="button" class="ventilation" :disabled="!ventilationAvailable" :title="ventilationAvailable?'查看听风工区当前目标':'完成蓄水回廊巡游后开放'" :aria-current="!view.overview&&view.layer==='ventilation'?'location':undefined" @click="$emit('ventilation')"><span aria-hidden="true">〰</span><span class="long">7层 · 听风</span><span class="short">7 听风</span></button>
    <button type="button" class="ruins" :disabled="!ruinsAvailable" :title="ruinsAvailable?'查看旧地脉遗迹当前目标':'完成听风工区巡游后开放'" :aria-current="!view.overview&&view.layer==='ruins'?'location':undefined" @click="$emit('ruins')"><span aria-hidden="true">▥</span><span class="long">8层 · 遗迹</span><span class="short">8 遗迹</span></button>
    <button type="button" class="finale" :disabled="!finaleAvailable" :title="finaleAvailable?'查看地心暖光终章':'完成第八章故事回望后开放'" :aria-current="!view.overview&&view.layer==='finale'?'location':undefined" @click="$emit('finale')"><span aria-hidden="true">☼</span><span class="long">9层 · 暖光</span><span class="short">9 暖光</span></button>
    <button type="button" :aria-current="view.overview ? 'location' : undefined" @click="$emit('overview')"><span aria-hidden="true">⊞</span><span>全景</span></button>
  </nav>
</template>

<style scoped>
.short { display:none; }
.depth-nav { display: flex; align-items: center; flex: none; gap: 4px; }
button { display: flex; align-items: center; justify-content: center; gap: 7px; min-height: 44px; padding: 0 16px; border-radius: 10px; background: transparent; color: #61736b; font-size: 14px; white-space: nowrap; }
button > span:first-child { font-size: 18px; }
button:hover { background: #edf2ee; }
button[aria-current] { background: #dfede3; color: #315f48; font-weight: 700; }
.water[aria-current] { color: #325f73; background: #deedf2; }
.reservoir[aria-current]{color:#3e6e7d;background:#dceaf0}
.garden[aria-current] { color:#3d7358; background:#dcebe0; }
.hall[aria-current] { color: #80603a; background: #efe4d1; }
.crystal[aria-current] { color: #5b6586; background: #e6e9f3; }button:disabled { opacity: .38; cursor: default; }
button:active { background: #d5e4dc; }
@media (max-width: 1280px) { .long { display:none; } .short { display:inline; } button > span:first-child { display:none; } .depth-nav { width: 100%; }button { flex: 1; padding: 0 4px; font-size: 11px; } }
.finale[aria-current]{color:#886929;background:#f0e4c6}
.ruins[aria-current]{color:#866a41;background:#efe3cd}
@media(max-width:600px){.depth-nav{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:1px}button{padding:0 2px;min-height:44px;font-size:11px}}
.ventilation[aria-current]{color:#736184;background:#e9e3ef}
</style>
