<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { DeepUI } from '../app/deepChapter'
import { DEEP_MILESTONES, type DeepAction } from '../core/deep'
import type { DeepFacilityKind } from '../core/world'
import ayan from '../assets/art/deep/ayan-v1.png'
import amu from '../assets/art/deep/amu-v1.png'
import atu from '../assets/art/characters/atu-portrait-v1.png'
import adeng from '../assets/art/characters/adeng-idle-v1.png'

const props = defineProps<{ state: DeepUI; traveling?: boolean; embedded?: boolean }>()
defineEmits<{ close: []; stop: []; primary: []; dig: []; select: [kind: DeepFacilityKind]; lamp: []; upgrade: [action: DeepAction, label: string]; ride: [action: DeepAction]; scout: [] }>()
const content = ref<HTMLElement | null>(null)
const portraits: Record<string, string> = { 阿岩: ayan, 阿木: amu, 阿土: atu, 阿灯: adeng }
const hasWorkshop = computed(() => props.state.buildings.some(f => f.kind === 'workshop' && f.built))
const goalView = computed(() => !props.state.placing && !props.state.selected && !props.state.choicesOpen && !props.state.digging)
const attention = computed(() => props.state.busy ? 'deep-construction' : props.state.feedback ? 'deep-result' : props.state.digging ? 'deep-digging' : 'deep')
const chainNote = computed(() => {
  const left = props.state.partsNeed - props.state.resources.parts
  return left > 0 ? `还差 ${left} 个部件，就能${props.state.partsFor}。` : '部件够啦！'
})
watch([
  () => props.state.title, () => props.state.feedback?.title,
  () => props.state.placing, () => props.state.selected, () => props.state.busy,
  () => props.state.digging, () => props.state.digAvailable, () => props.state.choicesOpen,
], async () => {
  await nextTick()
  if (!content.value) return
  content.value.scrollTop = 0
  content.value.querySelectorAll('details[open]').forEach(details => details.removeAttribute('open'))
})
</script>

<template>
  <section class="deep-panel" :class="{ embedded }" :data-attention-panel="attention" aria-label="晶簇层当前目标">
    <header><span>{{ state.header || '第 3 章 · 晶簇与工坊' }}</span><button type="button" aria-label="收起晶簇层面板" @click="$emit('close')">✕</button></header>
    <div ref="content" class="deep-content">
      <div v-if="state.feedback && !state.busy" class="result-feedback" data-effect-feedback role="status">
        <span class="result-icon" aria-hidden="true">{{ state.feedback.icon }}</span>
        <h2>{{ state.feedback.title }}</h2><p>{{ state.feedback.detail }}</p>
      </div>
      <template v-else>
        <p v-if="state.plan && goalView && !state.busy" class="big-goal">{{ state.completed ? '🛗 三层家园连通啦' : '🛗 一起造电梯，回家不用爬长梯' }}</p>
        <ol v-if="state.plan && goalView && !state.busy" class="milestones" aria-label="本章大目标进度">
          <li v-for="(m, i) in DEEP_MILESTONES" :key="m.label" :class="{ done: i < state.milestone, current: i === state.milestone && !state.completed }"><span aria-hidden="true">{{ i < state.milestone ? '✓' : m.icon }}</span>{{ m.label }}</li>
        </ol>
        <h2>{{ state.title }}</h2>
        <div class="speech"><img :src="portraits[state.speaker] ?? atu" alt="" /><div><b>{{ state.speaker }}</b><p>{{ state.speech }}</p></div></div>
        <details v-if="state.entered && !state.busy && !state.digging" class="optional-tools materials-tools">
          <summary>材料和加工方法</summary>
          <div class="materials" aria-label="晶簇层材料"><span>晶簇 <b>{{ state.resources.crystals }}</b></span><span>矿石 <b>{{ state.resources.ore }}</b></span><span>金属锭 <b>{{ state.resources.ingots }}</b></span><span>部件 <b>{{ state.resources.parts }}</b></span></div>
          <template v-if="state.chain"><p class="chain" aria-label="部件是怎么做出来的">矿石 → 金属锭 → 部件</p><p class="chain-note">小石炉炼金属锭，工坊做部件。{{ chainNote }}</p></template>
        </details>
        <button v-if="state.scout && !state.busy" type="button" class="quiet" @click="$emit('scout')">我自己去地图上找</button>
        <button v-if="state.selected && !state.busy" type="button" class="quiet" @click="$emit('close')">收起设施，继续探索</button>
        <button v-if="state.selected === 'lamp' && !state.busy" type="button" class="quiet" @click="$emit('lamp')">在另一处岩壁再安一盏</button>
        <details v-if="state.builds.length && !state.busy && goalView" class="optional-tools builds" aria-label="也可以先建的设施">
          <summary>我想自己布置（可选）</summary><div class="optional-list"><button v-for="b in state.builds" :key="b.kind" type="button" :disabled="!!b.locked" @click="$emit('select', b.kind)">{{ b.locked ? '🔒' : b.icon }} {{ b.name }}<small>{{ b.locked ?? b.cost }}</small></button></div>
        </details>
        <details v-if="state.entered && !state.busy && !state.placing && !state.digging && hasWorkshop && !state.choicesOpen && (goalView || state.selected === 'workshop')" class="optional-tools upgrades-block">
          <summary>想试试工具升级（可选）</summary><div class="upgrades"><button v-for="item in state.upgrades" :key="item.action" type="button" :disabled="item.done" @click="$emit('upgrade', item.action, item.label)">{{ item.done ? '✓' : '＋' }} {{ item.label }}</button></div>
        </details>
        <details v-if="state.lift && state.completed && !state.busy && goalView" class="optional-tools ride-tools">
          <summary>去别的楼层（可选）</summary><nav class="ride" aria-label="乘电梯">
            <button type="button" :disabled="traveling" @click="$emit('ride', 'ride-home')">1 层</button><button type="button" :disabled="traveling" @click="$emit('ride', 'ride-water')">2 层</button><button type="button" :disabled="traveling" @click="$emit('ride', 'ride-crystal')">3 层</button><button v-if="state.hallLift" type="button" :disabled="traveling" @click="$emit('ride', 'ride-hall')">4 层</button><button v-if="state.gardenLift" type="button" :disabled="traveling" @click="$emit('ride', 'ride-garden')">5 层</button><button v-if="state.reservoirLift" type="button" :disabled="traveling" @click="$emit('ride','ride-reservoir')">6 层</button><button v-if="state.ventilationLift" type="button" :disabled="traveling" @click="$emit('ride','ride-ventilation')">7 层</button><button v-if="state.ruinsLift" type="button" :disabled="traveling" @click="$emit('ride','ride-ruins')">8 层</button><button v-if="state.finaleLift" type="button" :disabled="traveling" @click="$emit('ride','ride-finale')">9 层</button>
          </nav>
        </details>
      </template>
    </div>
    <footer class="deep-actions">
      <div v-if="state.busy" class="working" role="status"><span>伙伴正在动手…</span><button type="button" @click="$emit('stop')">停下来</button></div>
      <template v-else>
        <p v-if="state.hint && !state.feedback" class="hint" role="status">{{ state.hint }}</p>
        <button v-if="state.digAvailable" type="button" class="primary dig-here" data-primary-action :disabled="traveling" @click="$emit('dig')">⛏ 先挖开这里 <span aria-hidden="true">→</span></button>
        <button v-else type="button" class="primary" data-primary-action :disabled="traveling || !state.feedback && !!state.placing && !state.valid" @click="$emit('primary')">{{ state.feedback ? state.feedback.nextLabel || '看看下一步' : state.label }} <span aria-hidden="true">→</span></button>
      </template>
    </footer>
  </section>
</template>

<style scoped>
.deep-panel { position:absolute; z-index:5; left:16px; top:16px; width:310px; max-width:calc(100% - 80px); max-height:calc(100% - 94px); display:flex; flex-direction:column; overflow:hidden; padding:16px; border:1px solid #aebcc5; border-radius:16px; background:#f3f7f9fa; color:#354755; box-shadow:0 5px 18px #101b2926; }
.deep-panel.embedded { position:static; width:100%; max-width:none; max-height:none; padding:0; border:0; border-radius:0; background:transparent; box-shadow:none; flex:1; min-height:0; }
header { display:flex; align-items:center; justify-content:space-between; gap:8px; flex:none; font-size:12px; color:#647c8b; }header button { width:44px; height:44px; background:transparent; color:#617785; border-radius:8px; flex:none; }header button:hover { background:#e2eaef; }
.deep-content { min-height:0; overflow:auto; overscroll-behavior:contain; padding:2px 2px 8px; }h2 { margin:8px 0 0; font-size:20px; line-height:1.4; }.big-goal { margin:5px 0; color:#617989; font-size:12px; line-height:1.5; }
.milestones { display:flex; gap:5px; list-style:none; padding:0; margin:10px 0 14px; }.milestones li { flex:1; display:flex; flex-direction:column; gap:3px; align-items:center; text-align:center; font-size:10px; color:#97a5ae; }.milestones li span { font-size:16px; }.milestones .done { color:#618772; }.milestones .current { color:#3f6176; font-weight:700; }
.speech { display:flex; align-items:flex-end; gap:9px; margin:10px 0; }.speech img { width:38px; height:48px; object-fit:contain; flex:none; }.speech b { font-size:12px; color:#647c8b; }.speech p { margin:4px 0 0; font-size:14px; line-height:1.65; }
.result-feedback { padding:12px 2px; }.result-icon { font-size:30px; }.result-feedback h2 { color:#35634b; }.result-feedback p { margin:8px 0 0; font-size:15px; line-height:1.7; color:#526f61; }
.deep-actions { flex:none; padding-top:9px; border-top:1px solid #dce5e8; background:inherit; }.hint { margin:0 0 8px; font-size:12px; line-height:1.5; color:#647c8b; }.primary { display:flex; width:100%; align-items:center; justify-content:space-between; gap:8px; min-height:48px; padding:11px 12px; border-radius:10px; background:#47758c; color:white; font-size:14px; font-weight:700; line-height:1.45; text-align:left; }.primary:hover { background:#3c677d; }.primary:disabled { background:#d9e2e7; color:#7b8b95; cursor:default; }.primary span { flex:none; font-size:18px; }
.working { display:flex; align-items:center; justify-content:space-between; gap:8px; font-size:13px; }.working button { min-height:44px; padding:8px 12px; background:#e0e9ee; border-radius:8px; color:#536c7a; }.quiet { display:block; min-height:44px; padding:8px 0; background:transparent; color:#6e8290; font-size:12px; text-align:left; }
.optional-tools { margin-top:4px; }.optional-tools summary { min-height:44px; padding:12px 0; color:#748793; font-size:12px; cursor:pointer; list-style-position:inside; }.optional-list, .upgrades { display:grid; gap:5px; }.optional-list button, .upgrades button { text-align:left; min-height:44px; padding:8px; color:#557286; background:transparent; border:1px dashed #bccbd4; border-radius:8px; font-size:12px; }.optional-list button:disabled, .upgrades button:disabled { color:#98a6af; cursor:default; }.optional-list small { display:block; margin-top:3px; color:#788e9c; font-size:11px; }
.materials { display:flex; flex-wrap:wrap; gap:8px 14px; padding:8px 0; font-size:12px; color:#647c8b; }.materials b { color:#405e71; }.chain, .chain-note { margin:6px 0; font-size:12px; color:#647c8b; line-height:1.5; }.ride { display:flex; flex-wrap:wrap; gap:6px; }.ride button { min-height:44px; padding:8px 12px; background:#e2ebf0; color:#536d7d; border-radius:8px; font-size:12px; }
button:focus-visible, summary:focus-visible { outline:3px solid #b68a39; outline-offset:2px; }
@media(max-width:720px) { .deep-panel:not(.embedded) { top:auto; bottom:62px; left:8px; width:calc(100% - 16px); max-width:none; max-height:50%; padding:12px; }.milestones { display:none; }h2 { font-size:18px; }.speech { margin:8px 0; }.speech p { font-size:14px; line-height:1.5; }.speech img { width:30px; height:38px; }.big-goal { margin:3px 0; font-size:11px; }.hint { font-size:12px; }.result-feedback { padding:6px 2px 12px; }.result-icon { font-size:26px; }.result-feedback p { font-size:14px; line-height:1.6; } }
</style>
