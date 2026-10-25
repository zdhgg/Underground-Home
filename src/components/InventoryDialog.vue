<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { BagItem } from '../core/bag'
import { ITEM_ART, ITEM_EMOJI } from '../app/itemArt'

const props = defineProps<{ items: BagItem[]; initialItem?: string; collectionAvailable: boolean }>()
const emit = defineEmits<{ close: []; collection: []; find: [id: string] }>()
const selectedId = ref(props.initialItem ?? 'stone')
const selected = computed(() => props.items.find(i => i.id === selectedId.value) ?? props.items[0])
const foundCount = computed(() => props.items.filter(i => i.kind === 'relic' && i.count > 0).length)
const closeButton = ref<HTMLButtonElement | null>(null)
const previousFocus = typeof document !== 'undefined' ? document.activeElement as HTMLElement | null : null

watch(() => props.initialItem, id => { if (id) selectedId.value = id })
function onKey(event: KeyboardEvent): void {
  if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); emit('close') }
}
function keepFocus(event: KeyboardEvent): void {
  if (event.key !== 'Tab') return
  const dialog = event.currentTarget as HTMLElement
  const buttons = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
  const first = buttons[0], last = buttons.at(-1)
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
}
onMounted(async () => { window.addEventListener('keydown', onKey, true); await nextTick(); closeButton.value?.focus() })
onBeforeUnmount(() => { window.removeEventListener('keydown', onKey, true); void nextTick(() => previousFocus?.focus()) })
</script>

<template>
  <div class="bag-backdrop" @click.self="emit('close')" @pointerdown.stop @wheel.stop>
    <section class="bag-dialog" role="dialog" aria-modal="true" aria-labelledby="bag-title" aria-describedby="bag-intro" @keydown="keepFocus">
      <header><div class="title"><img :src="ITEM_ART.bag" alt="" /><div><h2 id="bag-title">我的物品栏</h2><p id="bag-intro">挖到的宝贝，都在这里。</p></div></div><button ref="closeButton" class="close" type="button" aria-label="关闭物品栏" @click="emit('close')">×</button></header>
      <div class="bag-body">
        <h3>建造材料</h3>
        <div class="material-grid">
          <button v-for="item in items.filter(i => i.kind === 'material')" :key="item.id" type="button" class="item-card" :aria-pressed="selectedId === item.id" :aria-label="`${item.name}，${item.count}个`" @click="selectedId = item.id">
            <img :src="ITEM_ART[item.id]" alt="" /><span>{{ item.name }}</span><b>× {{ item.count }}</b>
          </button>
        </div>
        <div class="section-title"><h3>找到的宝贝</h3><span>{{ foundCount }} / {{ items.filter(i => i.kind === 'relic').length }}</span></div>
        <div class="relic-grid">
          <button v-for="item in items.filter(i => i.kind === 'relic')" :key="item.id" type="button" class="item-card relic" :class="{ missing: !item.count }" :aria-pressed="selectedId === item.id" :aria-label="item.count ? `${item.name}，已收藏` : '还没找到的旧物'" @click="selectedId = item.id">
            <img v-if="ITEM_ART[item.id]" :src="ITEM_ART[item.id]" alt="" /><span v-else class="item-emoji" aria-hidden="true">{{ ITEM_EMOJI[item.id] ?? '📦' }}</span><span>{{ item.count ? item.name : '还没找到' }}</span><small>{{ item.origin === 'finale' ? item.count ? '暖光已记下' : '去地心暖光看看' : item.origin === 'ruins' ? item.count ? '故事已记下' : '去旧地脉找找' : item.origin === 'ventilation' ? item.count ? '发现已记下' : '去听风工区找找' : item.origin === 'reservoir' ? item.count ? '发现已记下' : '去蓄水回廊找找' : item.origin === 'garden' ? item.count ? '发现已记下' : '去菌光洞找找' : item.origin === 'hall' ? item.count ? '发现已记下' : '去大厅层找找' : item.origin === 'crystal' ? item.count ? '发现已记下' : '去晶簇洞找找' : item.count ? collectionAvailable ? '已放上收藏架' : '已经收好啦' : '去泥土里找找' }}</small>
          </button>
        </div>
        <div v-if="selected" class="item-detail" aria-live="polite">
          <strong>{{ selected.kind === 'relic' && !selected.count ? '泥土里的小秘密' : selected.name }}</strong>
          <p>{{ selected.description }}</p>
          <button v-if="selected.origin === 'crystal' || selected.origin === 'hall' || selected.origin === 'garden' || selected.origin === 'reservoir' || selected.origin === 'ventilation' || selected.origin === 'ruins' || selected.origin === 'finale'" class="action" type="button" @click="emit('find', selected.id)">看看发现的地方</button>
          <button v-else-if="selected.kind === 'relic' && !selected.count" class="action" type="button" @click="emit('find', selected.id)">找找这件旧物</button>
          <button v-else-if="selected.kind === 'relic' && collectionAvailable" class="action" type="button" @click="emit('collection')">看看家里的收藏架</button>
          <small v-else>{{ selected.kind === 'material' ? '材料自动入包，建造时自动使用。' : '点亮家园后，收藏架就能展示它啦。' }}</small>
        </div>
      </div>
      <footer><button type="button" class="done" @click="emit('close')">收好背包，继续玩</button></footer>
    </section>
  </div>
</template>

<style scoped>
.bag-backdrop { position: fixed; z-index: 100; inset: 0; display: grid; place-items: center; padding: 16px; background: #102d2b9c; }
.bag-dialog { width: min(600px, 100%); max-height: calc(100dvh - 32px); display: flex; flex-direction: column; overflow: hidden; border-radius: 22px; background: #f6faf6; color: #304e41; box-shadow: 0 16px 60px #11291f40; }
header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 20px 24px 16px; border-bottom: 1px solid #dfe8df; }
.title { display: flex; align-items: center; gap: 12px; }.title img { width: 52px; height: 52px; object-fit: contain; }.title h2 { margin: 0; font-size: 22px; }.title p { margin: 5px 0 0; font-size: 13px; color: #708276; }
button { cursor: pointer; font-family: inherit; }button:focus-visible { outline: 3px solid #548c70; outline-offset: 3px; }
.close { flex: none; width: 44px; height: 44px; font-size: 28px; color: #4e6e5b; background: #e7eee7; border-radius: 12px; }
.bag-body { overflow-y: auto; overscroll-behavior: contain; padding: 18px 24px; }h3 { margin: 0 0 10px; font-size: 14px; }.material-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.item-card { position: relative; min-height: 100px; padding: 12px; border: 2px solid transparent; border-radius: 14px; background: #eaf0e8; color: #3f5b49; display: grid; justify-items: center; align-content: center; gap: 6px; font-size: 15px; }.material-grid .item-card { grid-template-columns: 60px 1fr; text-align: left; justify-items: start; column-gap: 12px; }.material-grid img { grid-row: span 2; }.item-card img { width: 60px; height: 60px; object-fit: contain; }.item-card b { font-size: 20px; font-variant-numeric: tabular-nums; }.item-card small { color: #738273; font-size: 11px; }.item-card:hover { background: #e1ebdf; }.item-card[aria-pressed="true"] { border-color: #4b8665; background: #e3efdf; }
.section-title { display: flex; align-items: center; justify-content: space-between; margin: 22px 0 10px; }.section-title h3 { margin: 0; }.section-title span { color: #718472; font-size: 13px; }.relic-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }.relic img { width: 68px; height: 68px; }.missing img { filter: grayscale(1); opacity: .3; }
.item-emoji { display: grid; place-items: center; width: 68px; height: 68px; font-size: 42px; line-height: 1; }.missing .item-emoji { filter: grayscale(1); opacity: .3; }
.item-detail { margin-top: 16px; padding: 16px; border-radius: 12px; background: #edf2eb; font-size: 14px; }.item-detail strong { font-size: 15px; }.item-detail p { margin: 7px 0 10px; line-height: 1.7; }.item-detail small { color: #758273; font-size: 12px; }.action { min-height: 44px; padding: 8px 14px; border-radius: 9px; color: #3b6a4e; background: #dbe8d6; font-size: 14px; }
footer { border-top: 1px solid #dfe8df; padding: 12px 24px 18px; }.done { width: 100%; min-height: 48px; border-radius: 11px; color: white; background: #3c7b5b; font-size: 16px; font-weight: 600; }.done:hover { background: #306749; }
@media(max-width: 480px) { .bag-backdrop { padding: 10px; }.bag-dialog { max-height: calc(100dvh - 20px); }header { padding: 14px 16px; }.title img { width: 42px; height: 42px; }.title h2 { font-size: 20px; }.bag-body { padding: 14px 16px; }.material-grid { gap: 8px; }.material-grid .item-card { grid-template-columns: 40px 1fr; padding: 10px; column-gap: 6px; }.material-grid img { width: 40px; height: 44px; }.item-card { font-size: 13px; }.item-card b { font-size: 18px; }.relic-grid { gap: 6px; }.relic { padding: 10px 4px; }.relic img { width: 52px; height: 52px; }.relic small { font-size: 10px; }footer { padding: 10px 16px 14px; } }
</style>
