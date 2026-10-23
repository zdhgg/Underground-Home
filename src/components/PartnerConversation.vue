<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { conversationPlacement, type ConversationAnchor } from '../render/conversationAnchor'
import type { PartnerConversation } from '../core/partnerInteractions'
import type { PartnerId } from '../core/partners'
import atuUrl from '../assets/art/characters/atu-portrait-v1.png'
import adengUrl from '../assets/art/characters/adeng-idle-v1.png'
import xiaomanUrl from '../assets/art/characters/xiaoman-idle-v1.png'
import xiaoquanUrl from '../assets/art/characters/xiaoquan-idle-v1.png'

const props = defineProps<{ conversation: PartnerConversation; busy: boolean; anchor: ConversationAnchor | null }>()
defineEmits<{ close: []; action: [] }>()
const images: Record<PartnerId, string> = { atu: atuUrl, adeng: adengUrl, xiaoman: xiaomanUrl, xiaoquan: xiaoquanUrl }
const closeButton = ref<HTMLButtonElement | null>(null)
const imageFailed = ref(false)
const panel = ref<HTMLElement | null>(null)
const size = ref({ width: 320, height: 250 })
const lineIndex = ref(0)
const lastLine = computed(() => lineIndex.value >= props.conversation.lines.length - 1)
const placement = computed(() => props.anchor ? conversationPlacement(props.anchor, size.value) : null)
const style = computed(() => placement.value ? {
  left: `${placement.value.left}px`, top: `${placement.value.top}px`,
  '--tail-x': `${placement.value.tail}px`,
} : {})
let observer: ResizeObserver | undefined
const previousFocus = typeof document !== 'undefined' ? document.activeElement as HTMLElement | null : null
watch(() => props.conversation.lines.join('\n'), () => { lineIndex.value = 0 })
onMounted(async () => {
  await nextTick()
  const measure = () => { if (panel.value) size.value = { width: panel.value.offsetWidth, height: panel.value.offsetHeight } }
  measure()
  observer = new ResizeObserver(measure)
  if (panel.value) observer.observe(panel.value)
  closeButton.value?.focus({ preventScroll: true })
})
onBeforeUnmount(() => { observer?.disconnect(); if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true }) })
</script>

<template>
  <svg v-if="anchor && placement" class="conversation-link" aria-hidden="true">
    <line :x1="placement.left + placement.tail" :y1="placement.below ? placement.top : placement.top + size.height" :x2="anchor.x" :y2="anchor.y" />
    <circle :cx="anchor.x" :cy="anchor.y" r="3" />
  </svg>
  <section ref="panel" class="conversation" data-attention-panel="conversation" :class="{ below: placement?.below }" :style="style" role="region" :aria-label="`和${conversation.name}聊聊`" @keydown.esc.stop="$emit('close')">
    <header>
      <span class="portrait" aria-hidden="true">
        <img v-if="!imageFailed" :src="images[conversation.partnerId]" alt="" @error="imageFailed = true" />
        <span v-else>{{ conversation.name }}</span>
      </span>
      <div class="identity"><strong>{{ conversation.name }}</strong><small>{{ conversation.species }} · {{ conversation.verb }}</small></div>
      <button ref="closeButton" class="close" type="button" aria-label="结束对话" @click="$emit('close')">×</button>
    </header>
    <div class="speech" aria-live="polite">
      <p>{{ conversation.lines[lineIndex] }}</p>
    </div>
    <div v-if="lastLine && conversation.upgrade" class="upgrade" :data-state="conversation.upgrade.state">
      <div class="upgrade-heading">
        <strong>{{ conversation.upgrade.icon }} {{ conversation.upgrade.name }}</strong>
        <span>{{ conversation.upgrade.state === 'equipped' ? `✓ ${conversation.upgrade.equippedLabel}` : conversation.upgrade.state === 'ready' ? '可以改进啦' : '还没准备好' }}</span>
      </div>
      <p>{{ conversation.upgrade.effect }}</p>
      <small>{{ conversation.upgrade.state === 'locked' ? conversation.upgrade.lockedHint : conversation.upgrade.boundary }}</small>
    </div>
    <button v-if="!lastLine" class="primary" data-primary-action type="button" @click="lineIndex++">继续听{{ conversation.name }}说</button>
    <button v-else-if="conversation.action" class="primary" data-primary-action type="button" :disabled="busy" @click="$emit('action')">{{ conversation.action.label }}</button>
    <button v-else class="primary" data-primary-action type="button" @click="$emit('close')">知道啦</button>
    <button class="later" type="button" @click="$emit('close')">等会儿，先去探索</button>
  </section>
</template>

<style scoped>
.conversation { position: absolute; z-index: 5; top: 12px; left: 12px; width: min(320px, calc(100% - 24px)); box-sizing: border-box; max-height: calc(100% - 24px); overflow-y: auto; padding: 14px; border: 1px solid #b6cdbd; border-radius: 16px; color: #365447; background: #f9fcf9; box-shadow: 0 6px 20px #213d3033; }
.conversation-link { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 4; overflow: hidden; }
.conversation-link line { stroke: #b6cdbd; stroke-width: 2; }.conversation-link circle { fill: #b6cdbd; }
.conversation::after { content: ''; display: block; position: absolute; width: 14px; height: 3px; bottom: 3px; left: calc(var(--tail-x, 50%) - 7px); border-radius: 2px; background: #69977d; }
.conversation.below::after { top: 3px; bottom: auto; }
.later { width: 100%; min-height: 44px; margin-top: 4px; background: transparent; color: #61796b; font-size: 13px; }
header { display: flex; align-items: center; gap: 10px; }
.portrait { display: grid; place-items: center; width: 48px; height: 48px; flex: none; overflow: hidden; border-radius: 50%; background: #e4eee5; font-size: 12px; }
.portrait img { width: 100%; height: 100%; object-fit: contain; }
.identity { display: flex; flex-direction: column; gap: 3px; flex: 1; }
.identity strong { font-size: 18px; }
.identity small { font-size: 12px; color: #78887e; }
.close { display: grid; place-items: center; flex: none; width: 44px; height: 44px; padding: 0; border-radius: 10px; background: transparent; color: #61756b; font-size: 28px; }
.close:hover { background: #edf2e9; }
.speech { margin: 16px 0; }
.speech p { margin: 0; font-size: 17px; line-height: 1.65; }
.upgrade { padding: 12px; margin: 0 0 12px; border-radius: 10px; background: #eef2e9; }
.upgrade-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.upgrade-heading strong { font-size: 15px; }
.upgrade-heading span { font-size: 11px; white-space: nowrap; color: #667b6b; }
.upgrade p { margin: 8px 0 4px; font-size: 14px; }
.upgrade small { color: #77877d; font-size: 12px; }
.upgrade[data-state="equipped"] { background: #e2f0df; }
.primary { min-height: 44px; width: 100%; padding: 11px 14px; border-radius: 10px; background: #3c8063; color: white; font-size: 15px; font-weight: 700; }
.primary:hover { background: #326f55; }
.primary:active { background: #2c644d; }
.primary:disabled { opacity: .55; cursor: wait; }
.invitation { display: block; margin-top: 10px; color: #7a897f; font-size: 11px; }
@media (max-width: 720px) { .conversation { padding: 12px; } .speech p { font-size: 16px; } }
</style>
