<script setup lang="ts">
import type { GardenUI } from '../app/gardenChapter'
import type { GardenFacilityKind } from '../core/world'
import type { DeepAction } from '../core/deep'
import taitai from '../assets/art/garden/taitai-v2.png'
import bell from '../assets/art/garden/bell-v1.png'
import fan from '../assets/art/garden/fan-v1.png'
import rill from '../assets/art/garden/rill-v1.png'
import atu from '../assets/art/characters/atu-portrait-v1.png'
import xiaoman from '../assets/art/characters/xiaoman-idle-v1.png'
import xiaoquan from '../assets/art/characters/xiaoquan-idle-v1.png'
import adeng from '../assets/art/characters/adeng-idle-v1.png'
import ayan from '../assets/art/deep/ayan-v1.png'
import amu from '../assets/art/deep/amu-v1.png'
defineProps<{ state: GardenUI; traveling?: boolean }>()
defineEmits<{ close: []; stop: []; primary: []; select: [kind: GardenFacilityKind]; add: [kind: GardenFacilityKind]; variety: []; ride: [action: DeepAction] }>()
const portraits: Record<string, string> = { 苔苔: taitai, 阿土: atu, 小满: xiaoman, 小泉: xiaoquan, 阿灯: adeng, 阿岩: ayan, 阿木: amu }
</script>
<template>
  <section class="garden-panel" :data-attention-panel="state.busy ? 'garden-work' : state.celebrating ? 'garden-celebration' : 'garden'" aria-label="菌光花园当前目标">
    <header><span>第 5 章 · 菌光花园</span><button type="button" aria-label="收起菌光花园面板" @click="$emit('close')">✕</button></header>
    <div class="chapter-line"><span :style="{ width: `${state.done / 14 * 100}%` }" /></div>
    <div class="heading"><h2>{{ state.title }}</h2><small>{{ state.completed ? '成园啦' : `${state.done} / 14` }}</small></div>
    <div class="illustration" aria-hidden="true"><img :src="!state.joined ? taitai : state.placing === 'rill' || state.selected === 'rill' ? rill : state.variety === 'fan' ? fan : bell" alt="" /></div>
    <div class="speech"><img :src="portraits[state.speaker] ?? taitai" alt="" /><div><b>{{ state.speaker }}</b><p>{{ state.speech }}</p></div></div>
    <ol v-if="state.selected === 'bed' && !state.busy" class="growth" aria-label="菌苗生长阶段"><li v-for="(name, index) in ['菌苗', '小芽', '展开']" :key="name" :aria-current="state.growth === index ? 'step' : undefined"><span>{{ index < state.growth ? '✓' : index + 1 }}</span>{{ name }}</li></ol>
    <div v-if="state.joined" class="facts"><span>收成 <b>{{ state.harvests }} 次</b></span><span>菌毯 <b>{{ state.trail }} 格</b></span><span>苔苔 <b>{{ state.bedded ? '有床啦' : '还缺床' }}</b></span></div>
    <p v-if="state.hint" class="hint" role="status">{{ state.hint }}</p>
    <button v-if="!state.busy" type="button" class="primary" data-primary-action :disabled="traveling || !!state.placing && !state.valid" @click="$emit('primary')">{{ state.label }}<span aria-hidden="true">→</span></button>
    <div v-else class="working" role="status"><span />伙伴正在动手…<button type="button" @click="$emit('stop')">停下来</button></div>
    <button v-if="state.canChangeVariety && !state.busy" type="button" class="quiet" @click="$emit('variety')">换成{{ state.variety === 'bell' ? '暖杏色扇伞菌' : '蓝绿色铃伞菌' }}</button>
    <button v-if="state.selected && ['bed','lamp','bench'].includes(state.selected) && !state.busy" type="button" class="quiet" @click="$emit('add', state.selected)">在另一处再放一个</button>
    <details v-if="state.joined && !state.busy && !state.celebrating" :key="`${state.selected}-${state.placing}`"><summary>花园建设与电梯</summary><div class="choices"><button v-for="b in state.buildings" :key="b.kind" type="button" :aria-pressed="state.selected === b.kind || state.placing === b.kind" @click="$emit('select', b.kind)">{{ b.name }}<small>{{ b.count ? `${b.count} 件` : '选位置' }}</small></button></div>
      <nav v-if="state.lift" class="ride" aria-label="乘五层电梯"><span>到</span><button v-for="(action, i) in (['ride-home','ride-water','ride-crystal','ride-hall','ride-garden'] as const)" :key="action" type="button" :disabled="traveling" @click="$emit('ride', action)">{{ i + 1 }} 层</button><button v-if="state.reservoirLift" type="button" :disabled="traveling" @click="$emit('ride','ride-reservoir')">6 层</button><button v-if="state.ventilationLift" type="button" :disabled="traveling" @click="$emit('ride','ride-ventilation')">7 层</button><button v-if="state.ruinsLift" type="button" :disabled="traveling" @click="$emit('ride','ride-ruins')">8 层</button><button v-if="state.finaleLift" type="button" :disabled="traveling" @click="$emit('ride','ride-finale')">9 层</button></nav>
    </details>
    <p class="exit-hint">随时收起、自由扩建 · Esc 退出 · 菌苗不会因离开而枯萎</p>
  </section>
</template>
<style scoped>
.garden-panel{position:absolute;z-index:5;left:16px;top:16px;width:320px;max-width:calc(100% - 80px);max-height:calc(100% - 94px);overflow-y:auto;padding:16px;border:1px solid #aabeb3;border-radius:16px;background:#f2f7f4f7;color:#3b5148;box-shadow:0 5px 18px #14241c26}header{display:flex;align-items:center;justify-content:space-between;font-size:12px;letter-spacing:1px;color:#789083}header button{width:36px;height:36px;margin:-9px -7px -6px 0;background:transparent;color:#6b8275;border-radius:8px}.chapter-line{height:3px;margin:9px 0 14px;background:#dce7df;border-radius:3px;overflow:hidden}.chapter-line span{display:block;height:100%;background:#7aa08a;transition:width .25s}.heading{display:flex;align-items:center;justify-content:space-between;gap:8px}h2{font-size:20px;margin:0}.heading small{font-size:11px;white-space:nowrap;color:#81988a}.illustration{height:94px;margin:10px 0 6px;display:flex;justify-content:center}.illustration img{height:100%;width:100%;object-fit:contain}.speech{display:flex;gap:11px;align-items:flex-end;margin:12px 0}.speech>img{width:49px;height:60px;object-fit:contain;object-position:bottom;flex:none}.speech b{font-size:12px;color:#658471}.speech p{font-size:14px;line-height:1.75;margin:4px 0 0}.facts{display:flex;justify-content:space-between;gap:5px;border-block:1px solid #dce6de;padding:9px 0;font-size:11px;color:#819386}.facts b{font-size:13px;color:#516e5d}.hint{font-size:12px;line-height:1.65;color:#788d7f;margin:10px 0}.primary{display:flex;justify-content:space-between;align-items:center;gap:8px;width:100%;min-height:48px;margin-top:12px;padding:12px 14px;border-radius:10px;background:#4e7a64;color:#f6fff7;font-size:14px;font-weight:600}.primary:hover{background:#3c6551}.primary:disabled{background:#dbe6de;color:#88998c;cursor:default}.working{display:flex;align-items:center;gap:8px;margin-top:12px;font-size:13px;color:#6b8976}.working>span{width:7px;height:7px;border-radius:50%;background:#82ac91}.working button{margin-left:auto;min-height:42px;padding:9px 12px;background:#dfeae1;color:#597561;border-radius:8px}details{font-size:12px;color:#6d8877;margin-top:10px}summary{padding:10px 0;min-height:40px;cursor:pointer}.choices{display:grid;gap:5px}.choices button{display:flex;justify-content:space-between;align-items:center;min-height:44px;padding:10px;background:#e3ede6;color:#526f5e;border-radius:8px;font-size:12px}.choices small{font-size:10px;color:#84998b}.choices button[aria-pressed=true]{background:#d4e4d9}.ride{flex-wrap:wrap;display:flex;align-items:center;gap:5px;margin-top:12px;font-size:11px}.ride button{min-height:40px;flex:1;background:#dfebe2;color:#577661;border-radius:7px}.exit-hint{font-size:10px;color:#93a598;margin:12px 0 0}.quiet{min-height:40px;display:block;padding:8px 0;background:transparent;color:#718d7a;font-size:12px}.growth{list-style:none;display:flex;justify-content:space-between;padding:0;margin:10px 0;font-size:12px;color:#8d9e91}.growth li{display:flex;gap:6px;align-items:center}.growth span{display:grid;place-items:center;width:22px;height:22px;border-radius:50%;background:#e1eae3}.growth li[aria-current]{color:#426b52;font-weight:600}.growth li[aria-current] span{background:#c4ddcb}
@media(max-height:650px){.illustration{display:none}.garden-panel{padding:12px;max-height:calc(100% - 76px)}.speech{margin:8px 0}.speech p{font-size:13px;line-height:1.6}.speech>img{height:42px;width:39px}.exit-hint{display:none}.chapter-line{margin:7px 0 9px}}
@media(max-width:720px){.garden-panel{top:auto;bottom:66px;left:12px;width:calc(100% - 24px);max-width:none;max-height:48%;padding:12px}.illustration{display:none}.heading h2{font-size:18px}.speech{margin:9px 0}.speech>img{height:46px;width:39px}.speech p{font-size:13px;line-height:1.6}.facts{padding:6px 0}.primary{margin-top:9px}.exit-hint{display:none}.chapter-line{margin-bottom:9px}}
@media(prefers-reduced-motion:reduce){.chapter-line span{transition:none}}
</style>
