<script setup lang="ts">
import type { SiteUI } from '../app/siteEditor'
import type { SiteKind } from '../core/world'
import FacilityPreview from './FacilityPreview.vue'
import shellUrl from '../assets/art/rooms/nest-shell-v1.png'
import bunksUrl from '../assets/art/rooms/nest-bunks-v1.png'
defineProps<{ state: SiteUI }>()
defineEmits<{ close: []; browse: []; select: [id: string]; kind: [kind: SiteKind]; build: []; stop: []; dig: [] }>()
const labels: Partial<Record<SiteKind, string>> = { garden: '🌱 小菜园', lounge: '☕ 休息角' }
</script>

<template>
  <section v-if="state.working" class="site-tools construction-strip" data-attention-panel="construction" aria-label="洞室施工" role="status">
    <div><small>正在修建{{ state.name }}</small><strong>阿土正在布置房间…</strong></div>
    <button type="button" @click="$emit('stop')">停下来</button>
    <button class="close" type="button" aria-label="收起施工状态" @click="$emit('close')">×</button>
  </section>
  <section v-else class="site-tools" data-attention-panel="site" aria-label="洞室建造" @keydown.esc.stop="$emit('close')">
    <header><div><small>一起把家建起来</small><strong>{{ state.name }}</strong></div><button class="close" type="button" aria-label="收起建造面板" @click="$emit('close')">×</button></header>
    <div v-if="state.selected" class="room-picture" :class="state.kind" aria-hidden="true">
      <div v-if="state.kind === 'home'" class="nest-illustration">
        <img class="nest-shell" :src="shellUrl" alt="" :draggable="false" />
        <img class="nest-beds" :src="bunksUrl" alt="" :draggable="false" />
      </div>
      <FacilityPreview v-else :kind="state.kind" />
    </div>
    <div v-if="state.choices.length > 1 && !state.built" class="choices" role="group" aria-label="这间洞室用来做什么">
      <button v-for="kind in state.choices" :key="kind" type="button" :disabled="state.working" :aria-pressed="state.kind === kind" @click="$emit('kind', kind)">{{ labels[kind] }}</button>
    </div>
    <p v-if="!state.built" class="message" role="status">{{ state.message }}</p>
    <div v-if="state.selected && !state.built" class="cost"><span>用到的材料</span><strong>{{ state.cost }}</strong></div>
    <button v-if="state.working" type="button" class="primary stop" @click="$emit('stop')">阿土正在施工 · 停下来</button>
    <button v-else-if="state.selected && !state.built" type="button" class="primary" data-primary-action :disabled="!state.canBuild" @click="$emit('build')">🔨 开工！</button>
    <p v-else-if="state.built" class="built">✓ 已经建好啦</p>
    <button v-if="!state.working && state.message.startsWith('还需要')" class="find-materials" type="button" @click="$emit('dig')">⛏ 去挖土找材料</button>
    <button v-if="state.selected" type="button" class="back" @click="$emit('browse')">‹ 返回洞室列表</button>
    <button v-if="state.built" type="button" class="primary" data-primary-action @click="$emit('close')">看看新房间</button>
    <nav v-if="!state.selected" aria-label="选择洞室">
      <button v-for="site in state.sites" :key="site.id" type="button" :disabled="state.working" :aria-pressed="site.id === state.selected" @click="$emit('select', site.id)"><span>{{ site.icon }} {{ site.name }}</span><small>{{ site.built ? '✓' : site.layer === 'home' ? '1层' : '2层' }}</small></button>
    </nav>
  </section>
</template>

<style scoped>
.room-picture.kitchen, .room-picture.dining, .room-picture.garden, .room-picture.lounge { display: block; height: auto; background: transparent; border: 0; border-radius: 0; }
.site-tools { position: absolute; z-index: 4; left: 12px; top: 12px; width: 266px; max-width: calc(100% - 88px); max-height: calc(100% - 96px); overflow-y: auto; padding: 16px; border-radius: 16px; background: #f7faf7fa; color: #365447; box-shadow: 0 4px 16px #142c2424; }
.back { display: block; width: 100%; margin-top: 12px; background: transparent; color: #61796b; }
.construction-strip { top: auto; bottom: 86px; width: auto; display: flex; align-items: center; gap: 12px; padding: 10px 14px; }
.construction-strip div { display: grid; gap: 4px; }.construction-strip small { color: #718278; }.construction-strip button { padding: 0 12px; }.construction-strip .close { padding: 0; }
header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
header div { display: grid; gap: 4px; } header small { color: #718278; font-size: 12px; } header strong { font-size: 21px; }
button { min-height: 44px; border-radius: 9px; color: #365b4b; background: #e9f0e9; font-size: 14px; }
button:hover { background: #dceadd; } button:focus-visible { outline: 3px solid #76ad91; outline-offset: 2px; } button:disabled { opacity: .5; cursor: default; }
.close { width: 44px; flex: none; font-size: 26px; background: transparent; }
.room-picture { position: relative; height: 108px; display: grid; place-items: center; margin-top: 16px; border-radius: 46px 46px 8px 8px; background: #2d4546; border: 6px solid #647771; border-bottom: 9px solid #a5ae93; overflow: hidden; }
.room-picture.home { display: flex; align-items: center; justify-content: center; height: 156px; background: transparent; border: 0; border-radius: 0; }
.nest-illustration { position: relative; width: 156px; height: 156px; flex: none; }
.nest-shell { display: block; width: 100%; height: 100%; }
.nest-beds { position: absolute; left: 8.333%; top: 25%; width: 83.333%; height: 51.25%; }
.message { min-height: 40px; margin: 14px 0; font-size: 14px; line-height: 1.6; }
.cost { display: grid; gap: 5px; margin-bottom: 12px; font-size: 13px; }.cost span { font-size: 12px; color: #718278; }.cost strong { font-weight: 600; }
.primary { width: 100%; background: #3c8063; color: white; font-size: 16px; font-weight: 700; }.primary:hover { background: #326f55; }.primary.stop { background: #e6ecdf; color: #526249; font-size: 14px; }
.choices { display: flex; gap: 8px; margin-top: 12px; }.choices button { flex: 1; }[aria-pressed="true"] { box-shadow: inset 0 0 0 2px #4b886c; background: #e0eddf; }
.built { color: #3c8063; font-weight: 700; font-size: 15px; }
.find-materials { width: 100%; margin-top: 8px; }
nav { display: grid; gap: 5px; border-top: 1px solid #dee7de; margin-top: 14px; padding-top: 12px; } nav button { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 7px 10px; text-align: left; } nav small { color: #6e8577; }
@media (max-height: 620px) { .site-tools { padding: 12px; width: 246px; }header strong { font-size: 18px; }.room-picture { height: 50px; margin-top: 8px; }.ceiling-lamp { top: 0; font-size: 16px; }.furniture { top: 7px; font-size: 23px; }.message { margin: 8px 0; min-height: 0; font-size: 13px; }.cost { display: flex; flex-wrap: wrap; gap: 4px 8px; margin-bottom: 8px; }nav { gap: 4px; margin-top: 10px; padding-top: 8px; } }
@media (max-height: 620px) { .room-picture.home, .nest-illustration { height: 104px; }.nest-illustration { width: 104px; } }
@media (max-height: 620px) { .room-picture.lounge { height: 104px; }.lounge-illustration { width: 173.333px; } }
@media (max-width: 720px) {
  .site-tools { top: auto; bottom: 80px; left: 12px; width: calc(100% - 24px); max-width: calc(100% - 24px); max-height: 48%; padding: 12px; }
  .room-picture, .room-picture.home, .room-picture.lounge, .room-picture.kitchen, .room-picture.dining, .room-picture.garden { display: none; }
  .message { min-height: 0; margin: 8px 0; }.cost { display: flex; gap: 8px; margin-bottom: 10px; }.back { margin-top: 4px; }
  .construction-strip { width: auto; max-height: none; gap: 8px; }.construction-strip strong { font-size: 13px; }
}
</style>
