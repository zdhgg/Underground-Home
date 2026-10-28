<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { nestPlacement } from '../render/conversationAnchor'
import type { NestMark, NestWelcome } from '../app/session'
import atu from '../assets/art/characters/atu-portrait-v1.png'

const props = defineProps<{ state: NestWelcome }>()
defineEmits<{ close: []; confirm: [mark: NestMark] }>()
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
  <section ref="panel" class="nest-welcome" data-attention-panel="nest-welcome" :style="style" role="region" aria-label="小窝建好啦" @keydown.esc.stop="$emit('close')">
    <header><img :src="atu" alt="" /><strong>阿土 · 新小窝</strong><button class="close" type="button" aria-label="先不选标记" @click="$emit('close')">×</button></header>
    <p>{{ state.speech }}</p>
    <div class="choices" aria-label="选择小窝标记">
      <button v-for="choice in choices" :key="choice.id" type="button" :aria-pressed="selected === choice.id" @click="selected = choice.id"><span aria-hidden="true">{{ choice.icon }}</span>{{ choice.label }}</button>
    </div>
    <button class="primary" data-primary-action type="button" @click="$emit('confirm', selected)">把标记挂上去</button>
    <button class="later" type="button" @click="$emit('close')">先去探索</button>
  </section>
</template>

<style scoped>
.nest-welcome { position:absolute; z-index:5; box-sizing:border-box; width:min(300px, calc(100% - 24px)); max-height:calc(100% - 24px); overflow:auto; padding:12px; border:1px solid #b6cdbd; border-radius:16px; color:#365447; background:#f9fcf9; box-shadow:0 6px 20px #213d3033; }
header { display:flex; align-items:center; gap:9px; } header img { width:42px; height:42px; object-fit:contain; border-radius:50%; background:#e4eee5; } header strong { flex:1; } .close { width:44px; height:44px; background:transparent; color:#61756b; font-size:26px; }
p { margin:8px 0 10px; line-height:1.5; font-size:15px; }.choices { display:flex; gap:6px; margin-bottom:10px; }.choices button { flex:1; min-height:44px; border:2px solid transparent; border-radius:9px; background:#eaf1e9; color:#436353; }.choices button[aria-pressed="true"] { border-color:#458b69; background:#d9eddd; }.choices span { margin-right:4px; }
.primary { width:100%; min-height:44px; border-radius:10px; background:#3c8063; color:white; font-weight:700; }.later { width:100%; min-height:40px; background:transparent; color:#61796b; }
@media (max-width: 500px) { .nest-welcome { width:min(220px, calc(100% - 24px)); padding:9px; } header img { width:36px; height:36px; } p { font-size:14px; line-height:1.4; margin:5px 0 8px; } .choices { gap:3px; margin-bottom:7px; } .choices button { padding:3px 1px; font-size:12px; } .choices span { margin-right:1px; } .later { min-height:36px; } }
</style>
