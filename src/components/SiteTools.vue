<script setup lang="ts">
import type { SiteUI } from '../app/siteEditor'
import type { RoomKind } from '../core/world'
import shellUrl from '../assets/art/rooms/nest-shell-v1.png'
import bunksUrl from '../assets/art/rooms/nest-bunks-v1.png'
import loungeShellUrl from '../assets/art/rooms/lounge-shell-v1.png'
import loungeFurnitureUrl from '../assets/art/rooms/lounge-furniture-v1.png'
defineProps<{ state: SiteUI }>()
defineEmits<{ close: []; select: [id: string]; kind: [kind: RoomKind]; build: []; stop: []; dig: [] }>()
const labels: Partial<Record<RoomKind, string>> = { garden: '🌱 小菜园', lounge: '☕ 休息角' }
</script>

<template>
  <section class="site-tools" aria-label="洞室建造">
    <header><div><small>一起把家建起来</small><strong>{{ state.name }}</strong></div><button class="close" type="button" aria-label="收起建造面板" @click="$emit('close')">×</button></header>
    <div v-if="state.selected" class="room-picture" :class="state.kind" aria-hidden="true">
      <div v-if="state.kind === 'home'" class="nest-illustration">
        <img class="nest-shell" :src="shellUrl" alt="" :draggable="false" />
        <img class="nest-beds" :src="bunksUrl" alt="" :draggable="false" />
      </div>
      <div v-else-if="state.kind === 'lounge'" class="lounge-illustration">
        <img class="lounge-shell" :src="loungeShellUrl" alt="" :draggable="false" />
        <img class="lounge-furniture" :src="loungeFurnitureUrl" alt="" :draggable="false" />
      </div>
      <template v-else><span class="ceiling-lamp">✦</span><span class="furniture">🌱 🥕 🌱</span><span class="walkway" /></template>
    </div>
    <div v-if="state.choices.length > 1 && !state.built" class="choices" role="group" aria-label="这间洞室用来做什么">
      <button v-for="kind in state.choices" :key="kind" type="button" :disabled="state.working" :aria-pressed="state.kind === kind" @click="$emit('kind', kind)">{{ labels[kind] }}</button>
    </div>
    <p v-if="!state.built" class="message" role="status">{{ state.message }}</p>
    <div v-if="state.selected && !state.built" class="cost"><span>用到的材料</span><strong>{{ state.cost }}</strong></div>
    <button v-if="state.working" type="button" class="primary stop" @click="$emit('stop')">阿土正在施工 · 停下来</button>
    <button v-else-if="state.selected && !state.built" type="button" class="primary" :disabled="!state.canBuild" @click="$emit('build')">🔨 开工！</button>
    <p v-else-if="state.built" class="built">✓ 已经建好啦</p>
    <button v-if="!state.working && state.message.startsWith('还需要')" class="find-materials" type="button" @click="$emit('dig')">⛏ 去挖土找材料</button>
    <nav aria-label="看看其他洞室">
      <button v-for="site in state.sites" :key="site.id" type="button" :disabled="state.working" :aria-pressed="site.id === state.selected" @click="$emit('select', site.id)"><span>{{ site.icon }} {{ site.name }}</span><small>{{ site.built ? '✓' : site.layer === 'home' ? '1层' : '2层' }}</small></button>
    </nav>
  </section>
</template>

<style scoped>
.site-tools { position: absolute; z-index: 4; left: 12px; top: 12px; width: 266px; max-width: calc(100% - 88px); max-height: calc(100% - 96px); overflow-y: auto; padding: 16px; border-radius: 16px; background: #f7faf7fa; color: #365447; box-shadow: 0 4px 16px #142c2424; }
header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
header div { display: grid; gap: 4px; } header small { color: #718278; font-size: 12px; } header strong { font-size: 21px; }
button { min-height: 44px; border-radius: 9px; color: #365b4b; background: #e9f0e9; font-size: 14px; }
button:hover { background: #dceadd; } button:focus-visible { outline: 3px solid #76ad91; outline-offset: 2px; } button:disabled { opacity: .5; cursor: default; }
.close { width: 44px; flex: none; font-size: 26px; background: transparent; }
.room-picture { position: relative; height: 108px; display: grid; place-items: center; margin-top: 16px; border-radius: 46px 46px 8px 8px; background: #2d4546; border: 6px solid #647771; border-bottom: 9px solid #a5ae93; overflow: hidden; }
.room-picture.garden { background: #375654; }.ceiling-lamp { position: absolute; top: 7px; color: #ffdf9e; font-size: 22px; }.furniture { position: relative; top: 12px; font-size: 29px; letter-spacing: 5px; }.walkway { position: absolute; bottom: 0; height: 7px; width: 100%; background: #899b87; }
.room-picture.home { display: flex; align-items: center; justify-content: center; height: 156px; background: transparent; border: 0; border-radius: 0; }
.nest-illustration { position: relative; width: 156px; height: 156px; flex: none; }
.nest-shell { display: block; width: 100%; height: 100%; }
.nest-beds { position: absolute; left: 8.333%; top: 25%; width: 83.333%; height: 51.25%; }
.room-picture.lounge { display: flex; align-items: center; justify-content: center; height: 140px; border: 0; border-radius: 0; background: transparent; }
.lounge-illustration { position: relative; width: 100%; aspect-ratio: 5 / 3; max-width: 230px; flex: none; }
.lounge-shell { display: block; width: 100%; height: 100%; }
.lounge-furniture { position: absolute; left: 12%; bottom: 18%; width: 76%; height: 42.222%; }
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
</style>
