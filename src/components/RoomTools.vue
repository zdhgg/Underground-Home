<script setup lang="ts">
import type { RoomUI } from '../app/roomEditor'
import type { RoomKind } from '../core/world'
import { ROOM_MAX_WIDTH } from '../core/rooms'
defineProps<{ state: RoomUI }>()
defineEmits<{ close: []; kind: [kind: RoomKind]; resize: [delta: number]; save: []; remove: []; select: [id: number]; create: [] }>()
const kinds: { kind: RoomKind; name: string; icon: string }[] = [
  { kind: 'home', name: '住处', icon: '⌂' }, { kind: 'lounge', name: '客厅', icon: '☕' },
]
</script>

<template>
  <section class="room-tools" data-attention-panel="room" role="region" aria-label="房间规划">
    <header><div><strong>{{ state.construction ? '阿土的施工蓝图' : state.completed ? '房间已建成' : '先选功能，再建房' }}</strong><small>{{ state.construction ? '点土施工 → 确认建成' : state.completed ? '设施在后侧 · 前侧可通行' : '选功能 → 放蓝图 → 挖掘 → 建成' }}</small></div><button type="button" class="close" aria-label="结束房间规划" @click="$emit('close')">×</button></header>
    <div v-if="!state.construction && !state.completed" class="kinds" role="group" aria-label="房间用途">
      <button v-for="item in kinds" :key="item.kind" type="button" :disabled="state.selectedId !== null" :aria-pressed="state.kind === item.kind" @click="$emit('kind', item.kind)"><span aria-hidden="true">{{ item.icon }}</span>{{ item.name }}</button>
    </div>
    <div v-if="!state.construction && !state.completed" class="width-control"><span>宽度 <strong>{{ state.width }}</strong> 格</span><div><button type="button" aria-label="房间窄一格" :disabled="state.width <= state.minWidth" @click="$emit('resize', -1)">−</button><button type="button" aria-label="房间宽一格" :disabled="state.width >= ROOM_MAX_WIDTH" @click="$emit('resize', 1)">＋</button></div></div>
    <p v-if="!state.construction && !state.completed" class="garden-hint">种植区现在在第二层：关掉面板，点左下角的「🌱 种植槽」。</p>
    <p class="instruction" :class="{ invalid: state.placed && !state.valid && !state.completed && !state.construction }" role="status">{{ state.message }}</p>
    <p class="detail">{{ state.detail }}</p>
    <button v-if="!state.completed" class="primary" data-primary-action type="button" :disabled="!state.valid || !state.dirty" @click="$emit('save')">{{ state.busy ? '阿土正在施工…' : state.action }}</button>
    <button v-else class="primary" data-primary-action type="button" :disabled="state.width >= ROOM_MAX_WIDTH" @click="$emit('resize', 1)">{{ state.width >= ROOM_MAX_WIDTH ? '已达本层最大宽度' : '扩建房间，增加容量' }}</button>
    <div v-if="state.construction" class="secondary"><button type="button" :disabled="state.busy" @click="$emit('resize', 0)">调整蓝图</button><button type="button" :disabled="state.busy" @click="$emit('remove')">取消施工蓝图</button></div>
    <button v-if="state.selectedId" class="finish" type="button" :disabled="state.busy" @click="$emit('create')">规划另一个房间</button>
    <div v-if="state.items.length" class="saved"><span>房间与施工蓝图</span><div><button v-for="room in state.items" :key="room.id" type="button" :disabled="state.busy" :aria-pressed="state.selectedId === room.id" @click="$emit('select', room.id)">{{ room.name }} · {{ room.width }}格</button></div></div>
    <button type="button" class="finish" @click="$emit('close')">{{ state.construction ? '收起面板，继续探索' : state.dirty ? '取消预览，继续探索' : '继续探索' }}</button>
  </section>
</template>

<style scoped>
.room-tools { position: absolute; z-index: 4; top: 12px; left: 12px; width: 300px; max-height: calc(100% - 24px); overflow-y: auto; padding: 16px; border-radius: 16px; background: #fffdf7fa; color: #365447; box-shadow: 0 6px 20px #213d3026; }
header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
header div { display: grid; gap: 4px; } header strong { font-size: 18px; } header small, .quiet { color: #77877d; font-size: 11px; }
button { min-height: 44px; border-radius: 9px; color: #476759; background: #edf2e9; font-size: 13px; }
button:hover { background: #dfeadd; } button:disabled { opacity: .5; cursor: default; }
.close { width: 44px; flex: none; background: transparent; font-size: 27px; }
.kinds { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; margin: 16px 0 12px; }
.garden-hint { margin: 0 0 8px; padding: 8px 10px; border-radius: 8px; background: #e7f0e4; color: #4c6b57; font-size: 11px; line-height: 1.55; }
.kinds button { display: grid; justify-items: center; gap: 2px; padding: 7px 4px; } .kinds span { font-size: 18px; }
button[aria-pressed="true"] { box-shadow: inset 0 0 0 2px #4b886c; background: #e0eddf; color: #315b46; font-weight: 700; }
.width-control { display: flex; justify-content: space-between; align-items: center; font-size: 13px; }
.width-control div { display: flex; gap: 6px; }.width-control button { width: 44px; font-size: 20px; }.width-control strong { padding: 0 4px; }
.instruction { margin: 14px 0 5px; line-height: 1.6; font-size: 14px; min-height: 44px; }.instruction.invalid { color: #9b653c; }
.detail { margin: 0 0 14px; color: #748478; font-size: 12px; line-height: 1.6; }
.primary { width: 100%; background: #3c8063; color: white; font-weight: 700; }.primary:hover { background: #326f55; }
.secondary { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 8px; }.quiet { display: block; margin-top: 7px; }
.saved { border-top: 1px solid #dfe7dc; padding-top: 12px; margin-top: 14px; }.saved > span { font-size: 11px; color: #78887b; }.saved > div { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 7px; max-height: 96px; overflow-y: auto; }.saved button { padding: 6px 10px; font-size: 12px; }
.finish { width: 100%; margin-top: 12px; background: transparent; color: #61796b; }
@media (max-width: 1000px) { .room-tools { width: 254px; padding: 12px; }.kinds { margin-top: 10px; }.instruction { margin-top: 10px; min-height: 0; }.detail { margin-bottom: 10px; } }
</style>
