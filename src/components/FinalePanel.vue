<script setup lang="ts">
import type { FinaleUI } from '../app/finaleChapter'
import type { FinaleFacilityKind,FinaleTheme } from '../core/world'
import type { DeepAction } from '../core/deep'
import heart from '../assets/art/finale/warm-heart-v1.png'
import table from '../assets/art/finale/table-v1.png'
import memory from '../assets/art/finale/memory-v1.png'
import atu from '../assets/art/characters/atu-portrait-v1.png'
import adeng from '../assets/art/characters/adeng-idle-v1.png'
import xiaoman from '../assets/art/characters/xiaoman-idle-v1.png'
import xiaoquan from '../assets/art/characters/xiaoquan-idle-v1.png'
import ayan from '../assets/art/deep/ayan-v1.png'
import amu from '../assets/art/deep/amu-v1.png'
import taitai from '../assets/art/garden/taitai-v2.png'
import tuantuan from '../assets/art/reservoir/tuantuan-v1.png'
import lingling from '../assets/art/ventilation/lingling-v1.png'
defineProps<{state:FinaleUI;traveling?:boolean}>()
defineEmits<{close:[];stop:[];primary:[];select:[kind:FinaleFacilityKind];theme:[theme:FinaleTheme];ride:[action:DeepAction];review:[]}>()
const portraits:Record<string,string>={阿土:atu,阿灯:adeng,小满:xiaoman,小泉:xiaoquan,阿岩:ayan,阿木:amu,苔苔:taitai,团团:tuantuan,铃铃:lingling}
</script>
<template>
 <section class="finale-panel" :data-attention-panel="state.busy?'finale-work':state.celebrating?'finale-celebration':state.warmthIntro?'finale-discovery':state.memoryIndex!==null?'finale-memory':'finale'" aria-label="地心暖光当前目标">
  <header><span>第 9 章 · 地心暖光 · 终章</span><button type="button" aria-label="收起地心暖光面板" @click="$emit('close')">✕</button></header>
  <div class="chapter-line"><span :style="{width:`${state.done/20*100}%`}" /></div>
  <div class="panel-content">
   <div class="heading"><h2>{{state.title}}</h2><small v-if="!state.celebrating">{{state.completed?'终章已完成':`${state.done} / 20`}}</small></div>
   <div v-if="!['beacon','bench'].includes(state.selected??state.placing??'')" class="illustration" aria-hidden="true"><img :src="state.memoryIndex!==null||state.selected==='memory'||state.placing==='memory'?memory:state.foundWarmth&&!state.warmthIntro?table:heart" alt="" /></div>
   <p v-if="state.memoryIndex!==null" class="memory-count">九层家园相册 · {{state.memoryIndex+1}} / 9 <span>{{state.replay?'重读':'回望'}}</span></p>
   <div class="speech"><img :src="portraits[state.speaker]??atu" alt="" /><div><b>{{state.speaker}}</b><p>{{state.speech}}</p></div></div>
   <div v-if="state.themeChoice&&!state.busy" class="edition-choices" aria-label="选择暖屋日布置"><button v-for="theme in (['lantern','garden'] as const)" :key="theme" type="button" :aria-pressed="state.themeChoice===theme" @click="$emit('theme',theme)">{{theme==='lantern'?'灯光暖屋':'菌叶花园'}}</button></div>
   <p v-if="state.entered&&state.memoryIndex===null&&!state.celebrating" class="preparations"><span :class="{ready:state.foodReady}">食物{{state.foodReady?'已到':'待准备'}}</span><span :class="{ready:state.waterReady}">清水{{state.waterReady?'已到':'待准备'}}</span><span :class="{ready:state.chimePlaced}">风铃{{state.chimePlaced?'已挂':'待准备'}}</span></p>
   <p v-if="state.busy&&state.guests" class="guest-count" role="status">到场伙伴 {{state.guests}} / 9</p>
   <p v-if="state.hint" class="hint" role="status">{{state.hint}}</p>
   <details v-if="state.entered&&!state.busy&&!state.celebrating&&state.memoryIndex===null" :key="`${state.selected}-${state.placing}`"><summary>自由布置、相册与电梯</summary>
    <div class="choices"><button v-for="b in state.buildings" :key="b.kind" type="button" :aria-pressed="state.selected===b.kind||state.placing===b.kind" @click="$emit('select',b.kind)">{{b.name}}<small>{{b.built?'已建好':'选位置'}}</small></button></div>
    <button v-if="state.completed" type="button" class="revisit" @click="$emit('review')">再看看九层全景</button>
    <nav v-if="state.lift" class="ride" aria-label="乘九站电梯"><button v-for="(action,i) in (['ride-home','ride-water','ride-crystal','ride-hall','ride-garden','ride-reservoir','ride-ventilation','ride-ruins','ride-finale'] as const)" :key="action" type="button" :disabled="traveling" @click="$emit('ride',action)">{{i+1}} 层</button></nav>
   </details>
   <p class="exit-hint">随时收起 · Esc 退出 · 终章之后仍可自由建设</p>
  </div>
  <button v-if="!state.busy" type="button" class="primary" data-primary-action :disabled="traveling||!!state.placing&&!state.valid" @click="$emit('primary')">{{state.label}}<span aria-hidden="true">→</span></button>
  <div v-else class="working" role="status"><span />{{state.guests?'大家正在赴席…':'伙伴正在动手…'}}<button type="button" @click="$emit('stop')">停下来</button></div>
 </section>
</template>
<style scoped>
.finale-panel{position:absolute;z-index:5;left:16px;top:16px;width:320px;max-width:calc(100% - 80px);max-height:calc(100% - 94px);overflow:hidden;display:flex;flex-direction:column;padding:16px;border:1px solid #c4b69a;border-radius:16px;background:#faf5eaf7;color:#574d3d;box-shadow:0 5px 18px #241c1426}.panel-content{min-height:0;overflow-y:auto;overscroll-behavior:contain;padding-right:3px}header,.chapter-line,.primary,.working{flex-shrink:0}header{display:flex;align-items:center;justify-content:space-between;font-size:12px;letter-spacing:1px;color:#96856a}header button{width:36px;height:36px;margin:-9px -7px -6px 0;background:transparent;color:#8a785e;border-radius:8px}.chapter-line{height:3px;margin:9px 0 14px;background:#e9dfce;border-radius:3px;overflow:hidden}.chapter-line span{display:block;height:100%;background:#b59866;transition:width .25s}.heading{display:flex;align-items:center;justify-content:space-between;gap:8px}h2{font-size:20px;margin:0}.heading small{font-size:11px;white-space:nowrap;color:#99886d}.illustration{height:90px;margin:10px 0 6px;display:flex;justify-content:center}.illustration img{height:100%;width:100%;object-fit:contain}.speech{display:flex;gap:11px;align-items:flex-end;margin:12px 0}.speech>img{width:49px;height:60px;object-fit:contain;object-position:bottom;flex:none}.speech b{font-size:12px;color:#917348}.speech p{font-size:14px;line-height:1.75;margin:4px 0 0}.hint{font-size:12px;line-height:1.65;color:#897b65;margin:10px 0}.primary{display:flex;justify-content:space-between;align-items:center;gap:8px;width:100%;min-height:48px;margin-top:12px;padding:12px 14px;border-radius:10px;background:#8c714d;color:#fffaf0;font-size:14px;font-weight:600}.primary:hover{background:#775f40}.primary:disabled{background:#e9e0d2;color:#a39581;cursor:default}.working{display:flex;align-items:center;gap:8px;margin-top:12px;font-size:13px;color:#947c59}.working>span{width:7px;height:7px;border-radius:50%;background:#b9a071}.working button{margin-left:auto;min-height:42px;padding:9px 12px;background:#eee4d4;color:#7a674a;border-radius:8px}details{font-size:12px;color:#907c5f;margin-top:10px}summary{padding:10px 0;min-height:40px;cursor:pointer}.choices,.stories{display:grid;gap:5px;margin-top:8px}.choices button,.stories button{display:flex;justify-content:space-between;align-items:center;min-height:44px;padding:10px;background:#eee5d7;color:#7b674b;border-radius:8px;font-size:12px}.choices small,.stories small{font-size:10px;color:#9d8e77}.choices button[aria-pressed=true],.stories button[aria-pressed=true]{background:#e2d3b9}.ride{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-top:12px;font-size:11px}.ride button{min-height:40px;background:#eee4d4;color:#806d51;border-radius:7px}.exit-hint{font-size:10px;color:#a69680;margin:12px 0 0}.edition-choices{display:flex;gap:6px;margin:10px 0}.edition-choices button{flex:1;min-height:42px;border-radius:8px;background:#ede3d4;color:#8b7859;font-size:12px}.edition-choices button[aria-pressed=true]{background:#ddcba8;color:#755a32}
@media(max-height:650px){.illustration{display:none}.finale-panel{padding:12px;max-height:calc(100% - 76px)}.speech{margin:8px 0}.speech p{font-size:13px;line-height:1.6}.speech>img{height:42px;width:39px}.exit-hint{display:none}.chapter-line{margin:7px 0 9px}}
@media(max-width:720px){.finale-panel{top:auto;bottom:66px;left:12px;width:calc(100% - 24px);max-width:none;max-height:48%;padding:12px}.illustration{display:none}.heading h2{font-size:18px}.speech{margin:9px 0}.speech>img{height:46px;width:39px}.speech p{font-size:13px;line-height:1.6}.primary{margin-top:9px}.exit-hint{display:none}.chapter-line{margin-bottom:9px}}
@media(prefers-reduced-motion:reduce){.chapter-line span{transition:none}}
.preparations{display:flex;flex-wrap:wrap;gap:10px;font-size:11px;color:#a19278;border-block:1px solid #e9dfcf;padding:10px 0}.preparations .ready{color:#7d805b}.memory-count{font-size:11px;color:#a0875c;display:flex;justify-content:space-between;margin:8px 0}.guest-count{font-size:12px;color:#8e7048}.revisit{min-height:42px;background:transparent;color:#96784b;text-align:left;font-size:12px}.ride{grid-template-columns:repeat(3,1fr)}
</style>
