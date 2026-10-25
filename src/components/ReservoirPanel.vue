<script setup lang="ts">
import type { ReservoirUI } from '../app/reservoirChapter'
import type { ReservoirFacilityKind, WaterRoute } from '../core/world'
import type { DeepAction } from '../core/deep'
import tuantuan from '../assets/art/reservoir/tuantuan-v1.png'
import basin from '../assets/art/reservoir/basin-v1.png'
import wheel from '../assets/art/reservoir/wheel-v1.png'
import intake from '../assets/art/reservoir/intake-v1.png'
import atu from '../assets/art/characters/atu-portrait-v1.png'
import xiaoquan from '../assets/art/characters/xiaoquan-idle-v1.png'
import ayan from '../assets/art/deep/ayan-v1.png'
import amu from '../assets/art/deep/amu-v1.png'
defineProps<{state:ReservoirUI;traveling?:boolean}>()
defineEmits<{close:[];stop:[];primary:[];select:[kind:ReservoirFacilityKind];route:[route:WaterRoute];ride:[action:DeepAction]}>()
const portraits:Record<string,string>={团团:tuantuan,阿土:atu,小泉:xiaoquan,阿岩:ayan,阿木:amu}
</script>
<template>
  <section class="reservoir-panel" :data-attention-panel="state.busy?'reservoir-work':state.celebrating?'reservoir-celebration':'reservoir'" aria-label="蓄水回廊当前目标">
    <header><span>第 6 章 · 蓄水回廊</span><button type="button" aria-label="收起蓄水回廊面板" @click="$emit('close')">✕</button></header>
    <div class="chapter-line"><span :style="{width:`${state.done/18*100}%`}" /></div>
    <div class="panel-content">
    <div class="heading"><h2>{{state.title}}</h2><small>{{state.completed?'连回家啦':`${state.done} / 18`}}</small></div>
    <div class="illustration" aria-hidden="true"><img :src="!state.joined?tuantuan:state.placing==='wheel'||state.selected==='wheel'?wheel:state.placing==='intake'||state.selected==='intake'?intake:basin" alt="" /></div>
    <div class="speech"><img :src="portraits[state.speaker]??tuantuan" alt="" /><div><b>{{state.speaker}}</b><p>{{state.speech}}</p></div></div>
    <div v-if="state.joined" class="water" aria-label="蓄水池水位"><span>存水</span><i v-for="n in 3" :key="n" :class="{full:state.water>=n}" /><b>{{state.water}} / 3</b></div>
    <p v-if="state.connected" class="route-state">水闸：{{state.valve==='closed'?'关闭':state.valve==='garden'?'菌光花园':'暖光大厅'}} <span>· 花园清水照料 {{state.irrigation}} 次</span></p>
    <div v-if="state.selected==='gate'&&state.connected&&!state.busy" class="route-choices" aria-label="选择下一条水路"><button v-for="r in (['closed','garden','hall'] as const)" :key="r" type="button" :aria-pressed="(state.routeChoice??state.valve)===r" @click="$emit('route',r)">{{r==='closed'?'关闸':r==='garden'?'送花园':'送大厅'}}</button></div>
    <p v-if="state.hint" class="hint" role="status">{{state.hint}}</p>
    <details v-if="state.joined&&!state.busy&&!state.celebrating" :key="`${state.selected}-${state.placing}`"><summary>水工建设与电梯</summary><div class="choices"><button v-for="b in state.buildings" :key="b.kind" type="button" :aria-pressed="state.selected===b.kind||state.placing===b.kind" @click="$emit('select',b.kind)">{{b.name}}<small>{{b.built?'已建好':'选位置'}}</small></button></div>
      <nav v-if="state.lift" class="ride" aria-label="乘六站电梯"><button v-for="(action,i) in (['ride-home','ride-water','ride-crystal','ride-hall','ride-garden','ride-reservoir'] as const)" :key="action" type="button" :disabled="traveling" @click="$emit('ride',action)">{{i+1}} 层</button><button v-if="state.ventilationLift" type="button" :disabled="traveling" @click="$emit('ride','ride-ventilation')">7 层</button><button v-if="state.ruinsLift" type="button" :disabled="traveling" @click="$emit('ride','ride-ruins')">8 层</button><button v-if="state.finaleLift" type="button" :disabled="traveling" @click="$emit('ride','ride-finale')">9 层</button></nav>
    </details>
    <p class="exit-hint">随时收起、自由扩建 · Esc 退出 · 水不会因离开而减少</p>
    </div>
    <button v-if="!state.busy" type="button" class="primary" data-primary-action :disabled="traveling||!!state.placing&&!state.valid" @click="$emit('primary')">{{state.label}}<span aria-hidden="true">→</span></button>
    <div v-else class="working" role="status"><span />伙伴正在动手…<button type="button" @click="$emit('stop')">停下来</button></div>
  </section>
</template>
<style scoped>
.reservoir-panel{position:absolute;z-index:5;left:16px;top:16px;width:320px;max-width:calc(100% - 80px);max-height:calc(100% - 94px);overflow:hidden;display:flex;flex-direction:column;padding:16px;border:1px solid #adc0bf;border-radius:16px;background:#f2f7f7f7;color:#3b5357;box-shadow:0 5px 18px #14242826}.panel-content{min-height:0;overflow-y:auto;overscroll-behavior:contain;padding-right:3px}header,.chapter-line,.primary,.working{flex-shrink:0}header{display:flex;align-items:center;justify-content:space-between;font-size:12px;letter-spacing:1px;color:#789093}header button{width:36px;height:36px;margin:-9px -7px -6px 0;background:transparent;color:#6b8287;border-radius:8px}.chapter-line{height:3px;margin:9px 0 14px;background:#dce7e7;border-radius:3px;overflow:hidden}.chapter-line span{display:block;height:100%;background:#77a4a5;transition:width .25s}.heading{display:flex;align-items:center;justify-content:space-between;gap:8px}h2{font-size:20px;margin:0}.heading small{font-size:11px;white-space:nowrap;color:#81989b}.illustration{height:94px;margin:10px 0 6px;display:flex;justify-content:center}.illustration img{height:100%;width:100%;object-fit:contain}.speech{display:flex;gap:11px;align-items:flex-end;margin:12px 0}.speech>img{width:49px;height:60px;object-fit:contain;object-position:bottom;flex:none}.speech b{font-size:12px;color:#65848a}.speech p{font-size:14px;line-height:1.75;margin:4px 0 0}.water{display:flex;align-items:center;gap:7px;border-block:1px solid #dce6e6;padding:10px 0;font-size:12px;color:#819396}.water i{height:12px;flex:1;background:#dce7e8;border-radius:3px;border:1px solid #c8d8da}.water i.full{background:#8fbcc4;border-color:#77a6af}.water b{font-size:13px;color:#516e74}.route-state{font-size:12px;line-height:1.7;color:#617e83}.route-state span{color:#82989a;font-size:11px}.hint{font-size:12px;line-height:1.65;color:#788d91;margin:10px 0}.primary{display:flex;justify-content:space-between;align-items:center;gap:8px;width:100%;min-height:48px;margin-top:12px;padding:12px 14px;border-radius:10px;background:#4d7985;color:#f6feff;font-size:14px;font-weight:600}.primary:hover{background:#3b6471}.primary:disabled{background:#dbe6e8;color:#88999d;cursor:default}.working{display:flex;align-items:center;gap:8px;margin-top:12px;font-size:13px;color:#6b898f}.working>span{width:7px;height:7px;border-radius:50%;background:#82acb2}.working button{margin-left:auto;min-height:42px;padding:9px 12px;background:#dfe9eb;color:#59757d;border-radius:8px}details{font-size:12px;color:#6d8890;margin-top:10px}summary{padding:10px 0;min-height:40px;cursor:pointer}.choices{display:grid;gap:5px}.choices button{display:flex;justify-content:space-between;align-items:center;min-height:44px;padding:10px;background:#e3ecee;color:#526f77;border-radius:8px;font-size:12px}.choices small{font-size:10px;color:#84999d}.choices button[aria-pressed=true]{background:#d4e2e6}.ride{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-top:12px;font-size:11px}.ride button{min-height:40px;background:#dfe9ed;color:#57767e;border-radius:7px}.exit-hint{font-size:10px;color:#93a5a8;margin:12px 0 0}.route-choices{display:flex;gap:6px;margin:10px 0}.route-choices button{flex:1;min-height:42px;border-radius:8px;background:#e5edef;color:#647f85;font-size:12px}.route-choices button[aria-pressed=true]{background:#d0e1e4;color:#3f6e78}
@media(max-height:650px){.illustration{display:none}.reservoir-panel{padding:12px;max-height:calc(100% - 76px)}.speech{margin:8px 0}.speech p{font-size:13px;line-height:1.6}.speech>img{height:42px;width:39px}.exit-hint{display:none}.chapter-line{margin:7px 0 9px}}
@media(max-width:720px){.reservoir-panel{top:auto;bottom:66px;left:12px;width:calc(100% - 24px);max-width:none;max-height:48%;padding:12px}.illustration{display:none}.heading h2{font-size:18px}.speech{margin:9px 0}.speech>img{height:46px;width:39px}.speech p{font-size:13px;line-height:1.6}.water{padding:6px 0}.primary{margin-top:9px}.exit-hint{display:none}.chapter-line{margin-bottom:9px}}
@media(prefers-reduced-motion:reduce){.chapter-line span{transition:none}}
</style>
