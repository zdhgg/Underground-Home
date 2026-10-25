<script setup lang="ts">
import type { DeepUI } from '../app/deepChapter'
import type { DeepAction } from '../core/deep'
import type { DeepFacilityKind } from '../core/world'
import ayan from '../assets/art/deep/ayan-v1.png'
import amu from '../assets/art/deep/amu-v1.png'
import atu from '../assets/art/characters/atu-portrait-v1.png'
import adeng from '../assets/art/characters/adeng-idle-v1.png'
import workshop from '../assets/art/deep/workshop-v1.png'
import rig from '../assets/art/deep/crystal-rig-v1.png'
import lift from '../assets/art/deep/lift-v1.png'
import { computed } from 'vue'
const props = defineProps<{ state: DeepUI; traveling?: boolean }>()
defineEmits<{ close: []; stop: []; primary: []; select: [kind: DeepFacilityKind]; lamp: []; upgrade: [action: DeepAction, label: string]; ride: [action: DeepAction] }>()
const portraits: Record<string, string> = { 阿岩: ayan, 阿木: amu, 阿土: atu, 阿灯: adeng }
const art = computed(() => props.state.done <= 2 ? ayan : props.state.selected === 'workshop' || props.state.selected === 'furnace' || props.state.done >= 7 && props.state.done <= 10 ? workshop : props.state.done >= 11 ? lift : rig)
</script>

<template>
  <section class="deep-panel" :data-attention-panel="state.busy ? 'deep-construction' : 'deep'" aria-label="晶簇层当前目标">
    <header><span>第 3 层 <i>·</i> 晶簇与工坊</span><button type="button" aria-label="收起晶簇层面板" @click="$emit('close')">✕</button></header>
    <div class="chapter-line"><span :style="{ width: `${Math.min(100, state.done / 13 * 100)}%` }" /></div>
    <div class="heading"><h2>{{ state.title }}</h2><small>{{ state.completed ? '完成啦' : `${state.done} / 13` }}</small></div>
    <div class="illustration" aria-hidden="true"><img :src="art" alt="" /></div>
    <div class="speech"><img :src="portraits[state.speaker] ?? atu" alt="" /><div><b>{{ state.speaker }}</b><p>{{ state.speech }}</p></div></div>
    <div v-if="state.entered" class="materials" aria-label="晶簇层材料"><span>晶簇 <b>{{ state.resources.crystals }}</b></span><span>矿石 <b>{{ state.resources.ore }}</b></span><span>金属锭 <b>{{ state.resources.ingots }}</b></span><span>部件 <b>{{ state.resources.parts }}</b></span></div>
    <p v-if="state.hint" class="hint" role="status">{{ state.hint }}</p>
    <button v-if="!state.busy" type="button" class="primary" data-primary-action :disabled="traveling || !!state.placing && !state.valid" @click="$emit('primary')">{{ state.label }} <span aria-hidden="true">→</span></button>
    <div v-else class="working" role="status"><span class="working-dot" />伙伴正在动手… <button type="button" @click="$emit('stop')">停下来</button></div>
    <button v-if="state.selected && !state.busy" type="button" class="return-goal" @click="$emit('close')">收起设施，继续探索</button>
    <button v-if="state.selected === 'lamp' && !state.busy" type="button" class="return-goal" @click="$emit('lamp')">在另一处岩壁再安一盏</button>
    <details v-if="state.entered && !state.busy" class="choices" :key="`${state.selected}-${state.placing}`"><summary>建设、工具与电梯</summary>
      <div class="facilities"><button v-for="item in state.buildings" :key="item.kind" type="button" :aria-pressed="state.selected === item.kind || state.placing === item.kind" @click="$emit('select', item.kind)"><span>{{ item.icon }}</span>{{ item.name }}<small>{{ item.built ? '已建好' : '选位置' }}</small></button></div>
      <div v-if="state.buildings.some(f => f.kind === 'workshop' && f.built)" class="upgrades"><button v-for="item in state.upgrades" :key="item.action" type="button" :disabled="item.done" @click="$emit('upgrade', item.action, item.label)">{{ item.done ? '✓' : '＋' }} {{ item.label }}</button><button v-if="!state.lift" type="button" @click="$emit('upgrade', 'lift', '家园电梯 · 部件 3')">＋ 家园电梯 · 部件 3</button></div>
      <nav v-if="state.lift" class="ride" aria-label="乘电梯"><span>乘电梯到</span><button type="button" :disabled="traveling" @click="$emit('ride', 'ride-home')">1 层</button><button type="button" :disabled="traveling" @click="$emit('ride', 'ride-water')">2 层</button><button type="button" :disabled="traveling" @click="$emit('ride', 'ride-crystal')">3 层</button><button v-if="state.hallLift" type="button" :disabled="traveling" @click="$emit('ride', 'ride-hall')">4 层</button><button v-if="state.gardenLift" type="button" :disabled="traveling" @click="$emit('ride', 'ride-garden')">5 层</button><button v-if="state.reservoirLift" type="button" :disabled="traveling" @click="$emit('ride','ride-reservoir')">6 层</button><button v-if="state.ventilationLift" type="button" :disabled="traveling" @click="$emit('ride','ride-ventilation')">7 层</button><button v-if="state.ruinsLift" type="button" :disabled="traveling" @click="$emit('ride','ride-ruins')">8 层</button><button v-if="state.finaleLift" type="button" :disabled="traveling" @click="$emit('ride','ride-finale')">9 层</button></nav>
    </details>
    <p class="exit-hint">随时收起，继续挖土和布置家园 · Esc 退出</p>
  </section>
</template>

<style scoped>
.deep-panel { position: absolute; z-index: 5; left: 16px; top: 16px; width: 310px; max-width: calc(100% - 80px); max-height: calc(100% - 94px); overflow-y: auto; border: 1px solid #aebcc5; border-radius: 16px; background: #f3f7f9f5; color: #354755; box-shadow: 0 5px 18px #101b2926; padding: 16px; }
header { display: flex; justify-content: space-between; align-items: center; gap: 12px; color: #758593; font-size: 12px; letter-spacing: 1px; }header i { margin: 0 4px; font-style: normal; }header button { background: transparent; color: #657582; width: 36px; height: 36px; margin: -9px -7px -6px 0; border-radius: 8px; }header button:hover { background: #e2eaef; }
.chapter-line { margin: 9px 0 14px; height: 3px; background: #dfe7ec; border-radius: 3px; overflow: hidden; }.chapter-line span { display: block; height: 100%; background: #7596ac; transition: width .3s; }
.heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; }h2 { font-size: 20px; font-weight: 700; margin: 0; letter-spacing: .2px; }.heading small { color: #758693; font-size: 11px; white-space: nowrap; }
.illustration { height: 95px; margin: 10px 0 6px; background: radial-gradient(ellipse at center, #d7e4ee66, transparent 65%); display: flex; justify-content: center; align-items: center; }.illustration img { width: 100%; height: 100%; object-fit: contain; }
.speech { display: flex; align-items: flex-end; gap: 11px; margin: 12px 0; }.speech > img { width: 49px; height: 60px; object-fit: contain; object-position: bottom; flex: none; }.speech b { font-size: 12px; color: #647f90; }.speech p { margin: 4px 0 0; font-size: 14px; line-height: 1.75; }
.materials { display: flex; gap: 5px; justify-content: space-between; padding: 9px 0; border-block: 1px solid #dde6ec; color: #7c8994; font-size: 10px; }.materials span { display: flex; align-items: center; gap: 4px; }.materials b { font-size: 14px; color: #4b6576; font-variant-numeric: tabular-nums; }
.hint { color: #75818b; font-size: 12px; line-height: 1.65; margin: 10px 0; }.primary { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; padding: 12px 14px; min-height: 48px; border-radius: 10px; background: #47758c; color: white; font-size: 14px; font-weight: 600; margin-top: 12px; }.primary:hover { background: #3c677d; }.primary:disabled { background: #d9e2e7; color: #87949e; cursor: default; }.primary span { font-size: 18px; }
.choices { margin-top: 10px; font-size: 12px; color: #6d8290; }.choices summary { cursor: pointer; min-height: 40px; padding: 10px 0; }.facilities { display: grid; gap: 5px; }.facilities button { display: flex; gap: 9px; align-items: center; min-height: 42px; text-align: left; padding: 9px 10px; border-radius: 8px; background: #e6edf1; color: #496371; font-size: 12px; }.facilities button small { margin-left: auto; color: #8997a0; font-size: 10px; }.facilities button[aria-pressed="true"] { background: #d4e3eb; }.upgrades { display: grid; gap: 5px; margin-top: 10px; }.upgrades button { text-align: left; font-size: 12px; min-height: 42px; padding: 8px; background: transparent; color: #658093; border: 1px dashed #bccbd4; border-radius: 8px; }.upgrades button:disabled { color: #96a6af; border-color: #dce4e9; }.exit-hint { margin: 12px 0 0; color: #94a0a8; font-size: 10px; }.ride { flex-wrap:wrap; display: flex; align-items: center; gap: 7px; margin-top: 12px; font-size: 11px; }.ride button { min-height: 40px; padding: 8px 11px; border-radius: 7px; background: #e2ebf0; color: #536d7d; }
.working { display: flex; align-items: center; gap: 8px; margin-top: 12px; font-size: 13px; color: #6b8594; }.working button { margin-left: auto; padding: 9px 12px; min-height: 40px; border-radius: 8px; background: #e0e9ee; color: #566c79; }.working-dot { width: 7px; height: 7px; border-radius: 50%; background: #83adbc; }
.return-goal { display: block; padding: 8px 0; min-height: 40px; background: transparent; color: #7c8d98; font-size: 12px; }
@media (max-height: 650px) { .illustration { display: none; }.deep-panel { padding: 12px; max-height: calc(100% - 76px); }.speech { margin: 8px 0; }.speech p { font-size: 13px; line-height: 1.6; }.speech > img { height: 42px; width: 39px; }.exit-hint { display: none; }.chapter-line { margin: 7px 0 9px; } }
@media (max-width: 720px) { .deep-panel { top: auto; bottom: 66px; left: 12px; width: calc(100% - 24px); max-width: none; max-height: 48%; padding: 12px; }.illustration { display: none; }.heading h2 { font-size: 18px; }.speech { margin: 9px 0; }.speech > img { height: 46px; width: 39px; }.speech p { font-size: 13px; line-height: 1.6; }.materials { padding: 6px 0; }.primary { margin-top: 9px; }.exit-hint { display: none; }.chapter-line { margin-bottom: 9px; } }
@media (prefers-reduced-motion: reduce) { .chapter-line span { transition: none; } }
</style>
