<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { nestPlacement } from '../render/conversationAnchor'
import type { NestMark, NestWelcome } from '../app/session'
import atu from '../assets/art/characters/atu-portrait-v1.png'
import adeng from '../assets/art/characters/adeng-idle-v1.png'

const props = defineProps<{ state: NestWelcome }>()
defineEmits<{ close: []; confirm: [mark: NestMark]; improve: []; install: [] }>()
const selected = ref<NestMark>(props.state.mark ?? 'star')
const choices: { id: NestMark; label: string; icon: string }[] = [
  { id: 'star', label: '星星', icon: '★' }, { id: 'leaf', label: '叶子', icon: '🍃' }, { id: 'drop', label: '水滴', icon: '💧' },
]
const panel = ref<HTMLElement | null>(null)
const size = ref({ width: props.state.anchor.width < 500 ? 220 : 300, height: 270 })
let observer: ResizeObserver | undefined
onMounted(async () => {
  await nextTick()
  const measure = () => { if (panel.value) size.value = { width: panel.value.offsetWidth, height: panel.value.offsetHeight } }
  measure(); observer = new ResizeObserver(measure); if (panel.value) observer.observe(panel.value)
})
onBeforeUnmount(() => observer?.disconnect())
const placement = computed(() => nestPlacement(props.state.anchor, size.value))
const style = computed(() => ({ left: `${placement.value.left}px`, top: `${placement.value.top}px` }))
</script>

<template>
  <section ref="panel" class="nest-welcome" :data-attention-panel="state.lamp ? 'nest-warm-lamp' : 'nest-welcome'" :style="style" role="region" :aria-label="state.lamp ? '小窝暖光灯改善' : '小窝建好啦'" @keydown.esc.stop="$emit('close')">
    <header><img :src="state.lamp ? adeng : atu" alt="" /><strong>{{ state.lamp ? '阿灯 · 小窝暖光灯' : '阿土 · 新小窝' }}</strong><button class="close" type="button" aria-label="关闭小窝详情" @click="$emit('close')">×</button></header>
    <template v-if="state.lamp">
      <p v-if="state.lamp.installed">暖光灯已经装好啦。<small class="lamp-result">第三层工坊做的部件，让老家更暖啦！</small></p>
      <template v-else>
        <p>把第三层工坊做的部件带回家，给喜欢的小窝留一束暖光。</p>
        <div class="lamp-preview" aria-label="安装预览：铜色壁灯架、乳白灯罩、暖黄灯芯"><svg width="32" height="43" viewBox="-12 -5 28 30" aria-hidden="true"><path d="M-6 1v13M-4 4Q6 2 4 9" fill="none" stroke="#ad7b4e" stroke-width="3" stroke-linecap="round"/><rect x="-3" y="7" width="9" height="10" rx="4" fill="#fff3d8" stroke="#d8c6a4"/><ellipse cx="1.5" cy="12" rx="2" ry="3" fill="#ffd16e"/></svg><span>需要1个工坊部件<br /><small>装好才用掉 · 随时可以停下来</small></span></div>
        <p v-if="state.lamp.problem" class="problem" role="status">{{ state.lamp.problem }}</p>
        <button class="primary" data-primary-action type="button" :disabled="!!state.lamp.problem" @click="$emit('install')">请阿灯装灯</button>
      </template>
      <button class="later" type="button" @click="$emit('close')">{{ state.lamp.installed ? '回去看看' : '先不装' }}</button>
    </template>
    <template v-else>
    <p>{{ state.speech }}</p>
    <div class="choices" aria-label="选择小窝标记">
      <button v-for="choice in choices" :key="choice.id" type="button" :aria-pressed="selected === choice.id" @click="selected = choice.id"><span aria-hidden="true">{{ choice.icon }}</span>{{ choice.label }}</button>
    </div>
    <button class="primary" data-primary-action type="button" @click="$emit('confirm', selected)">把标记挂上去</button>
    <button v-if="state.lampAvailable" class="later" type="button" @click="$emit('improve')">{{ state.lampInstalled ? '暖光灯已经装好啦。' : '给小窝添盏灯' }}</button>
    <button class="later" type="button" @click="$emit('close')">先去探索</button>
    </template>
  </section>
</template>

<style scoped>
.nest-welcome { position:absolute; z-index:5; box-sizing:border-box; width:min(300px, calc(100% - 24px)); max-height:calc(100% - 24px); overflow:auto; padding:12px; border:1px solid #b6cdbd; border-radius:16px; color:#365447; background:#f9fcf9; box-shadow:0 6px 20px #213d3033; }
header { display:flex; align-items:center; gap:9px; } header img { width:42px; height:42px; object-fit:contain; border-radius:50%; background:#e4eee5; } header strong { flex:1; } .close { width:44px; height:44px; background:transparent; color:#61756b; font-size:26px; }
p { margin:8px 0 10px; line-height:1.5; font-size:15px; }.choices { display:flex; gap:6px; margin-bottom:10px; }.choices button { flex:1; min-height:44px; border:2px solid transparent; border-radius:9px; background:#eaf1e9; color:#436353; }.choices button[aria-pressed="true"] { border-color:#458b69; background:#d9eddd; }.choices span { margin-right:4px; }
.primary { width:100%; min-height:44px; border-radius:10px; background:#3c8063; color:white; font-weight:700; }.later { width:100%; min-height:40px; background:transparent; color:#61796b; }
.primary:disabled { opacity:.5; cursor:default; }.lamp-preview { display:flex; align-items:center; gap:12px; margin:10px 0; padding:8px; border-radius:10px; background:#f6eedc; font-size:13px; }.lamp-preview small { color:#748478; }.problem { color:#8e613d; font-size:13px; }
.lamp-result { display:block; margin-top:6px; font-size:12px; color:#748478; }
@media (max-width: 500px) { .nest-welcome { width:min(220px, calc(100% - 24px)); padding:9px; } header img { width:36px; height:36px; } p { font-size:14px; line-height:1.4; margin:5px 0 8px; } .choices { gap:3px; margin-bottom:7px; } .choices button { padding:3px 1px; font-size:12px; } .choices span { margin-right:1px; } .later { min-height:36px; } }
</style>
