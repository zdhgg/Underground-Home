<script setup lang="ts">
import { ref } from 'vue'
import atuPortraitUrl from '../assets/art/characters/atu-portrait-v1.png'

defineProps<{ title: string; done: number; total: number; finished: boolean }>()
const expanded = ref(false)
const portraitFailed = ref(false)
const toggle = ref<HTMLButtonElement | null>(null)

function collapse(): void {
  expanded.value = false
  toggle.value?.focus({ preventScroll: true })
}
</script>

<template>
  <section class="guide" data-attention-panel="guide" aria-label="阿土的建议" @keydown.esc.stop="collapse">
    <div class="summary">
      <span class="portrait" aria-hidden="true">
        <img v-if="!portraitFailed" :src="atuPortraitUrl" alt="" @error="portraitFailed = true" />
        <span v-else>阿土</span>
      </span>
      <div class="goal" aria-live="polite">
        <small>{{ finished ? '阿土说：家越来越大啦' : '阿土的建议' }} <span>{{ done }}/{{ total }}</span></small>
        <strong>{{ title }}</strong>
      </div>
    </div>
    <div class="quick-action"><slot name="quick-action" /></div>
    <button ref="toggle" class="help" type="button" :aria-expanded="expanded" aria-controls="guide-details" @click="expanded = !expanded">{{ expanded ? '收起帮助' : '需要帮忙？' }}</button>
    <div v-if="expanded" id="guide-details" class="details"><slot /></div>
  </section>
</template>

<style scoped>
.guide { position: absolute; z-index: 3; top: 12px; left: 12px; width: 288px; max-width: calc(100% - 84px); max-height: calc(100% - 88px); overflow-y: auto; padding: 12px; border-radius: 14px; background: #f9fcf9f5; color: #334b42; box-shadow: 0 3px 12px #142c2420; }
.summary { display: flex; align-items: center; gap: 10px; }
.portrait { width: 40px; height: 44px; flex: none; display: grid; place-items: center; font-size: 12px; }
.portrait img { width: 100%; height: 100%; object-fit: contain; }
.goal { min-width: 0; flex: 1; }
.goal small { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 3px; color: #62756b; font-size: 12px; }
.goal small span { font-variant-numeric: tabular-nums; color: #3d7258; }
.goal strong { display: block; font-size: 15px; line-height: 1.45; overflow-wrap: anywhere; }
.details { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; padding-top: 12px; border-top: 1px solid #dce5de; }
.quick-action { display: flex; flex-direction: column; margin-top: 8px; }
.quick-action:empty { display: none; }
.help { display: block; margin: 6px auto -4px; min-height: 44px; padding: 8px 14px; background: transparent; color: #61776b; font-size: 13px; }
.help:hover { color: #315e46; text-decoration: underline; }
@media (max-width: 720px) { .guide { top: 8px; left: 8px; width: 264px; padding: 10px; max-height: calc(100% - 80px); }.goal strong { font-size: 14px; } }
</style>
