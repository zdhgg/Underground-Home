<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import GuidePanel from './GuidePanel.vue'
import DepthNavigation from './DepthNavigation.vue'
import { HOME_WISH_LIMIT, type HomeWish, type HomeWishId } from '../app/homeWishes'
import type { DepthView } from '../render/camera'
import atuPortraitUrl from '../assets/art/characters/atu-portrait-v1.png'

const props = defineProps<{
  open: boolean
  /** 没有别的面板抢注意力时才显示主线；否则只剩楼层导航。 */
  guideVisible: boolean
  /** 左侧已有章节/建筑面板：小本子停到旁边，不压住它。 */
  docked?: boolean
  /** 窄屏章节面板在底部；楼层换成从上方展开，避免压住面板。 */
  dockTop?: boolean
  layerLabel?: string
  title: string
  done: number
  total: number
  finished: boolean
  primaryLabel: string
  primaryDisabled?: boolean
  /** 可选的家园活动；最多显示两条，没有时整个栏目不出现。 */
  wishes?: HomeWish[]
  view: DepthView
  crystalAvailable?: boolean
  hallAvailable?: boolean
  gardenAvailable?: boolean
  finaleAvailable?: boolean
  ruinsAvailable?: boolean
  ventilationAvailable?: boolean
  reservoirAvailable?: boolean
}>()
const emit = defineEmits<{
  open: []; close: []; primary: []; wish: [id: HomeWishId]
  home: []; water: []; crystal: []; hall: []; garden: []; reservoir: []; finale: []; ruins: []; ventilation: []; overview: []; locked: [reason: string]
}>()
const tab = ref<HTMLButtonElement | null>(null)
const closeButton = ref<HTMLButtonElement | null>(null)
const portraitFailed = ref(false)
/** 心愿是次要导航：最多两条，与主线同屏时也不能把面板重新撑成大任务清单。 */
const wishes = computed(() => (props.wishes ?? []).slice(0, HOME_WISH_LIMIT))

async function closeNotebook(): Promise<void> {
  emit('close')
  await nextTick()
  tab.value?.focus({ preventScroll: true })
}
async function openNotebook(): Promise<void> {
  emit('open')
  await nextTick()
  closeButton.value?.focus({ preventScroll: true })
}
</script>

<template>
  <aside class="notebook" :class="{ 'is-open': props.open, 'is-docked': props.docked, 'is-floors-only': props.open && !props.guideVisible, 'dock-top': props.dockTop }" aria-label="阿土的探索小本子">
    <button v-show="!props.open" ref="tab" class="notebook-tab" type="button" aria-expanded="false" aria-controls="explorer-notebook" @click="openNotebook">
      <span class="notebook-face" aria-hidden="true">
        <img v-if="!portraitFailed" :src="atuPortraitUrl" alt="" @error="portraitFailed = true" />
        <span v-else>🐹</span>
      </span>
      <span>探索小本子</span>
      <span class="tab-arrow" aria-hidden="true">▸</span>
    </button>
    <section v-show="props.open" id="explorer-notebook" class="notebook-sheet" @keydown.esc.stop="closeNotebook">
      <header class="notebook-head">
        <span class="notebook-face" aria-hidden="true">
          <img v-if="!portraitFailed" :src="atuPortraitUrl" alt="" @error="portraitFailed = true" />
          <span v-else>🐹</span>
        </span>
        <div class="notebook-title">
          <strong>阿土的探索小本子</strong>
          <small>{{ props.guideVisible ? '先看看现在要做什么' : '先做完眼前这件事，楼层随时能换' }}</small>
        </div>
        <button ref="closeButton" class="notebook-close" type="button" aria-label="收起探索小本子" @click="closeNotebook">
          <span aria-hidden="true">‹</span>
        </button>
      </header>
      <div class="notebook-body">
        <section v-if="props.open && props.guideVisible" class="notebook-mission" aria-labelledby="explorer-mission-heading">
          <h2 id="explorer-mission-heading">⭐ 现在要做什么？</h2>
          <GuidePanel embedded :layer-label="layerLabel" :title="title" :done="done" :total="total" :finished="finished">
            <template #quick-action>
              <button class="notebook-primary" data-primary-action type="button" :disabled="primaryDisabled" @click="$emit('primary')">{{ primaryLabel }}</button>
            </template>
            <slot />
          </GuidePanel>
        </section>
        <p v-else-if="props.open" class="notebook-quiet">现在先专心做眼前这件事，做完再回来看。</p>
        <section v-if="props.open && props.guideVisible && wishes.length" class="notebook-wishes" aria-labelledby="explorer-wishes-heading">
          <h2 id="explorer-wishes-heading">🏠 我的家园心愿</h2>
          <ul class="wish-list">
            <li v-for="wish in wishes" :key="wish.id" class="wish-item">
              <div class="wish-text">
                <strong><span aria-hidden="true">{{ wish.emoji }}</span> {{ wish.title }}</strong>
                <p>{{ wish.detail }}</p>
                <p v-if="wish.note" class="wish-note">{{ wish.note }}</p>
              </div>
              <button class="wish-action" type="button" @click="$emit('wish', wish.id)">{{ wish.actionLabel }}</button>
            </li>
          </ul>
        </section>
        <section class="notebook-floors" aria-labelledby="explorer-floors-heading">
          <h2 id="explorer-floors-heading">🗺️ 去哪里？</h2>
          <DepthNavigation :view="view" :crystal-available="crystalAvailable" :hall-available="hallAvailable" :garden-available="gardenAvailable" :reservoir-available="reservoirAvailable" :ventilation-available="ventilationAvailable" :ruins-available="ruinsAvailable" :finale-available="finaleAvailable" @home="$emit('home')" @water="$emit('water')" @crystal="$emit('crystal')" @hall="$emit('hall')" @garden="$emit('garden')" @reservoir="$emit('reservoir')" @ventilation="$emit('ventilation')" @ruins="$emit('ruins')" @finale="$emit('finale')" @overview="$emit('overview')" @locked="$emit('locked', $event)" />
        </section>
      </div>
    </section>
  </aside>
</template>

<style scoped>
.notebook { position: absolute; z-index: 3; top: 8px; bottom: 8px; left: 8px; width: 272px; max-width: calc(100% - 16px); display: flex; flex-direction: column; overflow: hidden; pointer-events: none; }
.notebook-tab, .notebook-sheet { pointer-events: auto; }
.notebook.is-docked { z-index: 4; }
/* 章节/建筑面板在左上角时，小本子退到它旁边或底部，不压住主要操作。 */
.notebook.is-docked:not(.is-open) { top: auto; bottom: 8px; left: 8px; }
.notebook.is-docked.is-open { left: 344px; }
.notebook-face { width: 26px; height: 28px; flex: none; display: grid; place-items: center; font-size: 18px; }
.notebook-face img { width: 100%; height: 100%; object-fit: contain; }
.notebook-tab { display: inline-flex; align-items: center; gap: 7px; align-self: flex-start; min-height: 44px; padding: 7px 12px 7px 8px; border-radius: 12px; background: #fffdf7f5; color: #315b46; font-size: 13px; font-weight: 700; box-shadow: 0 3px 12px #142c2421; border: 1px solid #e4ead9; }
.notebook-tab:hover { background: #fffef9; box-shadow: 0 4px 14px #142c242e; }
.tab-arrow { color: #6e8b78; }
.notebook-sheet { display: flex; flex-direction: column; min-height: 0; max-height: 100%; border-radius: 16px; background: #fffdf7fc; border: 1px solid #e6ecda; box-shadow: 0 5px 20px #142c2424; color: #334b42; overflow: hidden; }
.notebook-head { display: flex; align-items: center; gap: 8px; padding: 10px 8px 10px 12px; border-bottom: 1px solid #e8eedd; background: #f6f9ef; flex: none; }
.notebook-title { min-width: 0; flex: 1; line-height: 1.25; }
.notebook-title strong { display: block; font-size: 14px; color: #2f5a45; overflow-wrap: anywhere; }
.notebook-title small { display: block; margin-top: 2px; color: #7b8d7f; font-size: 11px; }
.notebook-close { width: 44px; height: 44px; flex: none; margin: -6px -4px -6px 0; border-radius: 10px; background: transparent; color: #4c6b59; font-size: 24px; line-height: 1; }
.notebook-close:hover { background: #e7efe2; }
.notebook-close span { display: block; transform: translateY(-2px); }
.notebook-body { min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 12px; display: grid; gap: 12px; align-content: start; }
.notebook-mission, .notebook-wishes, .notebook-floors { display: grid; gap: 8px; }
.notebook-mission, .notebook-wishes { padding-bottom: 12px; border-bottom: 1px dashed #dbe5d3; }
.notebook-body h2 { margin: 0; font-size: 12px; font-weight: 700; color: #6d8474; letter-spacing: .3px; }
.notebook-wishes { gap: 6px; }
.wish-list { display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; }
.wish-item { display: grid; gap: 5px; padding: 7px 8px 8px; border-radius: 9px; background: #f3f7ee; }
.wish-text strong { display: block; color: #436454; font-size: 13px; line-height: 1.35; }
.wish-text p { margin: 2px 0 0; color: #75877b; font-size: 11.5px; line-height: 1.45; }
.wish-text .wish-note { color: #9a6734; }
.wish-action { justify-self: start; min-height: 38px; padding: 7px 12px; border-radius: 8px; background: #e4eee2; color: #3f6653; font-size: 12.5px; font-weight: 600; }
.wish-action:hover { background: #d8e6d8; }
.notebook-primary { min-height: 46px; width: 100%; padding: 10px 12px; border-radius: 10px; background: #3c8063; color: #fff; font-size: 14px; font-weight: 700; }
.notebook-primary:hover { background: #326f55; }
.notebook-primary:disabled { opacity: .55; cursor: default; }
.notebook-quiet { margin: 0; padding: 10px 12px; border-radius: 10px; background: #f2f6ec; color: #637a6b; font-size: 12px; line-height: 1.6; }
@media (max-width: 720px) {
  .notebook { top: 8px; left: 8px; width: min(280px, calc(100% - 16px)); }
  /* 楼上/施工面板占着左上角时，楼层从底部展开；章节面板占底部时，从上方展开。 */
  .notebook.is-docked.is-open { top: auto; bottom: 60px; left: 8px; height: auto; max-height: 34%; }
  .notebook.is-docked.is-open.dock-top { top: 8px; bottom: auto; max-height: calc(52% - 74px); }
  .notebook-tab { padding-right: 10px; }
  .notebook-sheet { max-height: 66%; }
  .notebook-body { padding: 10px; gap: 10px; }
}
@media (prefers-reduced-motion: reduce) {
  .notebook-tab, .notebook-close, .notebook-primary { transition: none; }
}
</style>
