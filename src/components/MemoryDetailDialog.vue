<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import type { MemoryEntry } from '../core/world'

const props = defineProps<{ entry: MemoryEntry }>()
const emit = defineEmits<{ close: []; all: [] }>()
const closeButton = ref<HTMLButtonElement | null>(null)
const previousFocus = typeof document !== 'undefined' ? document.activeElement as HTMLElement | null : null

function onKey(event: KeyboardEvent): void { if (event.key === 'Escape') { event.preventDefault(); emit('close') } }
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
  <div class="memory-detail-backdrop" @click.self="emit('close')" @pointerdown.stop @wheel.stop>
    <section class="memory-detail-dialog" data-attention-panel="memory-detail" role="dialog" aria-modal="true" aria-labelledby="memory-detail-title" @keydown="keepFocus">
      <header>
        <div class="detail-heading"><span class="detail-mark" aria-hidden="true">✦</span><div><small>记忆角</small><h2 id="memory-detail-title">{{ props.entry.title }}</h2></div></div>
        <button ref="closeButton" class="close" type="button" aria-label="关闭这段记忆" @click="emit('close')">×</button>
      </header>
      <div class="detail-body">
        <img v-if="props.entry.photoDataUrl" :src="props.entry.photoDataUrl" alt="这段记忆的照片" />
        <audio v-if="props.entry.voiceDataUrl" :src="props.entry.voiceDataUrl" controls preload="metadata" />
        <p v-if="props.entry.body" class="detail-text">{{ props.entry.body }}</p>
        <p class="detail-date">{{ new Date(props.entry.createdAt).toLocaleDateString('zh-CN') }} · 这段生活已经放进家里</p>
      </div>
      <footer>
        <button type="button" class="secondary" @click="emit('all')">打开完整记忆匣</button>
        <button type="button" class="primary" data-primary-action @click="emit('close')">收好这段记忆</button>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.memory-detail-backdrop{position:fixed;z-index:115;inset:0;display:grid;place-items:center;padding:16px;background:#102d2b9c}.memory-detail-dialog{width:min(500px,100%);max-height:calc(100dvh - 32px);display:flex;flex-direction:column;overflow:hidden;border-radius:22px;background:#f8fbf7;color:#304e41;box-shadow:0 16px 60px #11291f40}.memory-detail-dialog header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:20px 24px 16px;border-bottom:1px solid #dfe8df}.detail-heading{display:flex;align-items:center;gap:12px}.detail-heading small{display:block;color:#78917e;font-size:12px}.detail-heading h2{margin:4px 0 0;font-size:22px}.detail-mark{display:grid;place-items:center;width:52px;height:52px;border-radius:16px;background:#e3f0df;color:#43805b;font-size:30px}.close{flex:none;width:44px;height:44px;font-size:28px;color:#4e6e5b;background:#e7eee7;border-radius:12px}.detail-body{overflow-y:auto;padding:20px 24px}.detail-body img{display:block;width:100%;max-height:280px;object-fit:cover;border-radius:14px}.detail-body audio{width:100%;margin-top:4px}.detail-text{margin:16px 0 0;font-size:16px;line-height:1.8;color:#496455;white-space:pre-wrap}.detail-date{margin:18px 0 0;color:#829287;font-size:12px}footer{display:flex;gap:8px;border-top:1px solid #dfe8df;padding:12px 24px 18px}.secondary,.primary{min-height:48px;padding:10px 14px;border-radius:10px;font-size:14px}.secondary{color:#3b6a4e;background:#e0eddd}.primary{flex:1;color:#fff;background:#3c7b5b;font-weight:600}.primary:hover{background:#306749}@media(max-width:480px){.memory-detail-backdrop{padding:10px}.memory-detail-dialog header{padding:14px 16px}.detail-body{padding:16px}.detail-heading h2{font-size:19px}footer{padding:10px 16px 14px}}
</style>
