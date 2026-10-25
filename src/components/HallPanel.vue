<script setup lang="ts">
import type { HallUI } from '../app/hallChapter'
import type { HallFacilityKind } from '../core/world'
import shell from '../assets/art/hall/shell-v1.png'
import table from '../assets/art/hall/table-v2.png'
import memory from '../assets/art/hall/memory-v1.png'
import atu from '../assets/art/characters/atu-portrait-v1.png'
import ayan from '../assets/art/deep/ayan-v1.png'
import amu from '../assets/art/deep/amu-v1.png'
import adeng from '../assets/art/characters/adeng-idle-v1.png'
import type { DeepAction } from '../core/deep'
defineProps<{ state: HallUI; traveling?: boolean }>()
defineEmits<{ close: []; stop: []; primary: []; select: [kind: HallFacilityKind]; page: [delta: number]; ride: [action: DeepAction] }>()
const portraits: Record<string, string> = { 阿土: atu, 阿岩: ayan, 阿木: amu, 阿灯: adeng }
</script>
<template>
  <section class="hall-panel" :data-attention-panel="state.busy ? 'hall-construction' : state.celebrating ? 'hall-celebration' : 'hall'" aria-label="暖光大厅当前目标">
    <header><span>第 4 章 · 暖光大厅</span><button type="button" aria-label="收起暖光大厅面板" @click="$emit('close')">✕</button></header>
    <div class="chapter-line"><span :style="{ width: `${state.done / 11 * 100}%` }" /></div>
    <div class="heading"><h2>{{ state.title }}</h2><small>{{ state.completed ? '暖屋啦' : `${state.done} / 11` }}</small></div>
    <div class="illustration" aria-hidden="true"><img :src="state.selected === 'memory' || state.placing === 'memory' ? memory : state.celebrating || state.done >= 7 ? table : shell" alt="" /></div>
    <div class="speech"><img :src="portraits[state.speaker] ?? atu" alt="" /><div><b>{{ state.speaker }}</b><p>{{ state.speech }}</p></div></div>
    <article v-if="state.selected === 'memory' && state.album[state.page] && !state.busy" class="album" aria-label="家园相册">
      <small>我们的家园 · {{ state.page + 1 }} / {{ state.album.length }}</small><h3>{{ state.album[state.page].title }}</h3><p>{{ state.album[state.page].detail }}</p>
      <nav aria-label="翻看家园相册"><button type="button" :disabled="state.page === 0" @click="$emit('page', -1)">← 上一页</button><button type="button" :disabled="state.page >= state.album.length - 1" @click="$emit('page', 1)">下一页 →</button><button v-if="state.reservoirLift" type="button" :disabled="traveling" @click="$emit('ride','ride-reservoir')">6 层</button></nav>
    </article>
    <div v-if="state.entered" class="materials"><span>床位 <b>{{ state.beds }}/6</b></span><span>食物 <b>{{ state.food }}</b></span><span>部件 <b>{{ state.parts }}</b></span><span>晶簇 <b>{{ state.crystals }}</b></span></div>
    <p v-if="state.hint" class="hint" role="status">{{ state.hint }}</p>
    <button v-if="!state.busy" type="button" class="primary" data-primary-action :disabled="traveling || !!state.placing && !state.valid" @click="$emit('primary')">{{ state.label }} <span aria-hidden="true">→</span></button>
    <div v-else class="working" role="status"><span />伙伴正在准备…<button type="button" @click="$emit('stop')">停下来</button></div>
    <details v-if="state.entered && !state.busy && !state.celebrating" :key="`${state.selected}-${state.placing}`"><summary>建设、相册与电梯</summary>
      <div class="choices"><button v-for="b in state.buildings" :key="b.kind" type="button" :aria-pressed="state.selected === b.kind || state.placing === b.kind" @click="$emit('select', b.kind)">{{ b.name }}<small>{{ b.built ? b.kind === 'memory' ? '翻看相册' : '已建好' : '选位置' }}</small></button></div>
      <nav v-if="state.lift" class="ride" aria-label="乘四层电梯"><span>乘电梯到</span><button v-for="(action, i) in (['ride-home', 'ride-water', 'ride-crystal', 'ride-hall'] as const)" :key="action" type="button" :disabled="traveling" @click="$emit('ride', action)">{{ i + 1 }} 层</button><button v-if="state.gardenLift" type="button" :disabled="traveling" @click="$emit('ride', 'ride-garden')">5 层</button><button v-if="state.reservoirLift" type="button" :disabled="traveling" @click="$emit('ride','ride-reservoir')">6 层</button><button v-if="state.ventilationLift" type="button" :disabled="traveling" @click="$emit('ride','ride-ventilation')">7 层</button><button v-if="state.ruinsLift" type="button" :disabled="traveling" @click="$emit('ride','ride-ruins')">8 层</button><button v-if="state.finaleLift" type="button" :disabled="traveling" @click="$emit('ride','ride-finale')">9 层</button></nav>
    </details>
    <p class="exit-hint">随时收起，自由建设 · Esc 退出 · 这是九层旅途的中途庆典</p>
  </section>
</template>
<style scoped>
.hall-panel{position:absolute;z-index:5;left:16px;top:16px;width:320px;max-width:calc(100% - 80px);max-height:calc(100% - 94px);overflow-y:auto;padding:16px;border:1px solid #c7b9a4;border-radius:16px;background:#fcf7eef7;color:#51483c;box-shadow:0 5px 18px #19130d29}header{display:flex;align-items:center;justify-content:space-between;font-size:12px;letter-spacing:1px;color:#8c7b64}header button{width:36px;height:36px;margin:-9px -7px -6px 0;background:transparent;color:#86745e;border-radius:8px}.chapter-line{height:3px;margin:9px 0 14px;background:#e6ddce;border-radius:3px;overflow:hidden}.chapter-line span{display:block;height:100%;background:#b69563;transition:width .3s}.heading{display:flex;align-items:center;justify-content:space-between;gap:8px}h2{font-size:20px;margin:0}.heading small{font-size:11px;white-space:nowrap;color:#96856f}.illustration{height:100px;margin:10px 0 6px;display:flex;justify-content:center}.illustration img{height:100%;width:100%;object-fit:contain}.speech{display:flex;gap:11px;align-items:flex-end;margin:12px 0}.speech>img{width:49px;height:60px;object-fit:contain;object-position:bottom;flex:none}.speech b{font-size:12px;color:#977649}.speech p{font-size:14px;line-height:1.75;margin:4px 0 0}.materials{display:flex;justify-content:space-between;gap:5px;border-block:1px solid #e7dfd1;padding:9px 0;font-size:11px;color:#938675}.materials b{font-size:14px;color:#725d40}.hint{font-size:12px;line-height:1.65;color:#8c7c66;margin:10px 0}.primary{display:flex;justify-content:space-between;align-items:center;gap:8px;width:100%;min-height:48px;margin-top:12px;padding:12px 14px;border-radius:10px;background:#8d6a3d;color:#fffaf0;font-size:14px;font-weight:600}.primary:hover{background:#785a34}.primary:disabled{background:#e6ded1;color:#9b907f;cursor:default}.working{display:flex;align-items:center;gap:8px;margin-top:12px;font-size:13px;color:#8d7656}.working>span{width:7px;height:7px;border-radius:50%;background:#b79b70}.working button{margin-left:auto;min-height:42px;padding:9px 12px;background:#eae0d0;color:#80694b;border-radius:8px}details{font-size:12px;color:#8b775c;margin-top:10px}summary{padding:10px 0;min-height:40px;cursor:pointer}.choices{display:grid;gap:5px}.choices button{display:flex;justify-content:space-between;align-items:center;min-height:44px;padding:10px;background:#efe7d9;color:#725e43;border-radius:8px;font-size:12px}.choices small{font-size:10px;color:#9b8b73}.choices button[aria-pressed=true]{background:#e6d7bf}.ride{flex-wrap:wrap;display:flex;align-items:center;gap:5px;margin-top:12px;font-size:11px}.ride button{min-height:40px;min-width:40px;background:#eee3d2;color:#776246;border-radius:7px}.exit-hint{font-size:10px;color:#a39683;margin:12px 0 0}.album{padding:12px;background:#f0e8d8;border-radius:10px;margin:12px 0}.album small{font-size:10px;color:#968266}.album h3{font-size:16px;margin:7px 0}.album p{font-size:13px;line-height:1.75;margin:0}.album nav{display:flex;justify-content:space-between;margin-top:8px}.album button{min-height:42px;padding:8px 4px;background:transparent;color:#8f714b;font-size:12px}.album button:disabled{opacity:.35}
@media(max-height:650px){.illustration{display:none}.hall-panel{padding:12px;max-height:calc(100% - 76px)}.speech{margin:8px 0}.speech p{font-size:13px;line-height:1.6}.speech>img{height:42px;width:39px}.exit-hint{display:none}.chapter-line{margin:7px 0 9px}}
@media(max-width:720px){.hall-panel{top:auto;bottom:66px;left:12px;width:calc(100% - 24px);max-width:none;max-height:48%;padding:12px}.illustration{display:none}.heading h2{font-size:18px}.speech{margin:9px 0}.speech>img{height:46px;width:39px}.speech p{font-size:13px;line-height:1.6}.materials{padding:6px 0}.primary{margin-top:9px}.exit-hint{display:none}.chapter-line{margin-bottom:9px}}
@media(prefers-reduced-motion:reduce){.chapter-line span{transition:none}}
</style>
