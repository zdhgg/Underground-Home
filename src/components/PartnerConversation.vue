<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { PartnerConversation } from '../core/partnerInteractions'
import type { PartnerId } from '../core/partners'
import atuUrl from '../assets/art/characters/atu-portrait-v1.png'
import adengUrl from '../assets/art/characters/adeng-idle-v1.png'
import xiaomanUrl from '../assets/art/characters/xiaoman-idle-v1.png'
import xiaoquanUrl from '../assets/art/characters/xiaoquan-idle-v1.png'

defineProps<{ conversation: PartnerConversation; busy: boolean }>()
defineEmits<{ close: []; action: [] }>()
const images: Record<PartnerId, string> = { atu: atuUrl, adeng: adengUrl, xiaoman: xiaomanUrl, xiaoquan: xiaoquanUrl }
const closeButton = ref<HTMLButtonElement | null>(null)
const imageFailed = ref(false)
onMounted(() => closeButton.value?.focus({ preventScroll: true }))
</script>

<template>
  <section class="conversation" role="region" :aria-label="`和${conversation.name}聊聊`" @keydown.esc.stop="$emit('close')">
    <header>
      <span class="portrait" aria-hidden="true">
        <img v-if="!imageFailed" :src="images[conversation.partnerId]" alt="" @error="imageFailed = true" />
        <span v-else>{{ conversation.name }}</span>
      </span>
      <div class="identity"><strong>{{ conversation.name }}</strong><small>{{ conversation.species }} · {{ conversation.verb }}</small></div>
      <button ref="closeButton" class="close" type="button" aria-label="结束对话" @click="$emit('close')">×</button>
    </header>
    <div class="speech" aria-live="polite">
      <p v-for="line in conversation.lines" :key="line">{{ line }}</p>
    </div>
    <div v-if="conversation.upgrade" class="upgrade" :data-state="conversation.upgrade.state">
      <div class="upgrade-heading">
        <strong>{{ conversation.upgrade.icon }} {{ conversation.upgrade.name }}</strong>
        <span>{{ conversation.upgrade.state === 'equipped' ? `✓ ${conversation.upgrade.equippedLabel}` : conversation.upgrade.state === 'ready' ? '可以改进啦' : '还没准备好' }}</span>
      </div>
      <p>{{ conversation.upgrade.effect }}</p>
      <small>{{ conversation.upgrade.state === 'locked' ? conversation.upgrade.lockedHint : conversation.upgrade.boundary }}</small>
    </div>
    <button v-if="conversation.action" class="primary" type="button" :disabled="busy" @click="$emit('action')">{{ conversation.action.label }}</button>
    <small class="invitation">点右上角 ×，继续自由探索</small>
  </section>
</template>

<style scoped>
.conversation { position: absolute; z-index: 3; top: 12px; left: 12px; width: min(340px, calc(100% - 96px)); max-height: calc(100% - 24px); overflow-y: auto; padding: 14px; border-radius: 16px; color: #365447; background: #fffdf7fa; box-shadow: 0 6px 20px #213d3026; }
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
@media (max-width: 720px) { .conversation { width: min(300px, calc(100% - 80px)); padding: 12px; } .speech p { font-size: 16px; } }
</style>
