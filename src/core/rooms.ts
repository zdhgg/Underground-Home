import { BREAKTHROUGHS, HOME_FLOOR_Y, HOME_ROOM_TOP, LANDMARKS, TILE, type Cell, type Rect, type Room, type RoomKind, type SiteKind, type WorldState, type SleepPod, type Planter } from './world'
import { atuCanStand, atuRoute, initialAtuPosition, workersSafe } from './atu'

export const ROOM_MIN_WIDTH = 3
export const ROOM_MAX_WIDTH = 9
export const ROOM_KINDS: readonly RoomKind[] = ['home', 'garden', 'lounge']
export const ROOM_NAMES: Record<RoomKind, string> = { home: '住处', garden: '种植区', lounge: '客厅' }
/** 设施标牌：第二层的灶台／餐桌也沿用同一套房间外观。 */
export const SITE_NAMES: Record<SiteKind, string> = { ...ROOM_NAMES, kitchen: '灶台', dining: '餐桌' }
export const roomContains = (r: Rect, p: Cell): boolean => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h
const overlaps = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
const encloses = (outer: Rect, inner: Rect): boolean => inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h
export type RoomFailure = 'power' | 'bounds' | 'layer' | 'reserved' | 'soil' | 'support' | 'overlap' | 'facility' | 'access' | 'rock' | 'expansion' | 'layout'
export const ROOM_HINTS: Record<RoomFailure, string> = {
  power: '先点亮家园，再布置房间。', bounds: '换个位置，房间要留在地图里。', layer: '先在暖窝层布置房间。',
  reserved: '梯口和能源核心旁要留空。', soil: '这片还有土，先挖出至少两格高的空间。', support: '房间下面要有地面。',
  overlap: '这里已有房间，点它可以调整。', facility: '把小床完整圈进房间，或换个位置。', access: '先把这片空间挖通到大厅。',
  rock: '蓝图只能放在松软泥土或已挖空的地方。', expansion: '扩建要包住原房间，用途也保持原样。',
  layout: '原设施占住了功能区，换个位置或扩大蓝图吧。',
}

export function roomAt(w: WorldState, p: Cell): Room | null { return w.rooms.find(r => roomContains(r, p)) ?? null }
export function roomFromPoint(p: Cell, width: number, kind: RoomKind, id = 0, height = HOME_FLOOR_Y - HOME_ROOM_TOP): Room {
  return { id, kind, x: p.x - Math.floor(width / 2), y: HOME_FLOOR_Y - height, w: width, h: height }
}

/** 仅划已挖的洞室。设施是否能用继续由原设施规则决定；用途不限制混合布置。 */
export function checkRoom(w: WorldState, r: Room, ignoreId = r.id, planning = false): { ok: true } | { ok: false; reason: RoomFailure } {
  if (!w.progress.coreRepaired) return { ok: false, reason: 'power' }
  if (![r.x, r.y, r.w, r.h].every(Number.isInteger) || r.w < ROOM_MIN_WIDTH || r.w > ROOM_MAX_WIDTH || r.x < 1 || r.x + r.w > w.width - 1) return { ok: false, reason: 'bounds' }
  if (r.y < HOME_ROOM_TOP || r.y + r.h !== HOME_FLOOR_Y || (r.h !== 2 && r.h !== 3)) return { ok: false, reason: 'layer' }
  if (BREAKTHROUGHS.some(x => x >= r.x && x < r.x + r.w) || overlaps(r, { x: 19, y: 8, w: 5, h: 3 })) return { ok: false, reason: 'reserved' }
  if (r.replaces !== undefined) {
    const old = w.rooms.find(other => other.id === r.replaces && other.status !== 'blueprint')
    if (!old || old.kind !== r.kind || !encloses(r, old) || r.w <= old.w) return { ok: false, reason: 'expansion' }
  }
  if (w.rooms.some(other => other.id !== ignoreId && other.id !== r.replaces && other.replaces !== ignoreId && overlaps(r, other))) return { ok: false, reason: 'overlap' }
  for (let x = r.x; x < r.x + r.w; x++) {
    for (let y = r.y; y < r.y + r.h; y++) {
      const tile = w.tiles[y]?.[x]
      if (tile !== TILE.EMPTY && !(planning && tile === TILE.SOIL)) return { ok: false, reason: planning ? 'rock' : 'soil' }
    }
    if (w.tiles[HOME_FLOOR_Y]?.[x] === TILE.EMPTY) return { ok: false, reason: 'support' }
  }
  if (w.pods.some(p => { const rect = { ...p, w: 3, h: 2 }; return overlaps(r, rect) && !encloses(r, rect) })) return { ok: false, reason: 'facility' }
  if (planning) return { ok: true }
  // 区域只要求洞室的地面空间接到大厅，不给设施增加新的通行限制。
  let left = r.x, right = r.x + r.w - 1
  while (w.tiles[HOME_FLOOR_Y - 1]?.[left - 1] === TILE.EMPTY && w.tiles[HOME_FLOOR_Y - 2]?.[left - 1] === TILE.EMPTY) left--
  while (w.tiles[HOME_FLOOR_Y - 1]?.[right + 1] === TILE.EMPTY && w.tiles[HOME_FLOOR_Y - 2]?.[right + 1] === TILE.EMPTY) right++
  if (right < LANDMARKS.shelter.x || left >= LANDMARKS.shelter.x + LANDMARKS.shelter.w) return { ok: false, reason: 'access' }
  return { ok: true }
}

export const checkRoomPlan = (w: WorldState, r: Room, ignoreId = r.id) => checkRoom(w, r, ignoreId, true)
export interface RoomChange {
  before: Room | null; after: Room | null
  /** 扩建完成时，旧房间与蓝图一并替换；撤销只移除本次新增设施。 */
  alsoBefore?: Room; addedPods?: SleepPod[]; addedPlanters?: Planter[]
}
export function saveRoom(w: WorldState, draft: Room): RoomChange | null {
  if (!ROOM_KINDS.includes(draft.kind) || !checkRoom(w, draft).ok) return null
  const old = draft.id ? w.rooms.find(r => r.id === draft.id) : null
  if (draft.id && !old) return null
  if (old?.managed || old?.status === 'blueprint') return null
  const room = { ...draft, id: old?.id ?? w.nextRoomId }
  if (old && JSON.stringify(old) === JSON.stringify(room)) return null
  if (old) w.rooms[w.rooms.indexOf(old)] = room
  else { w.rooms.push(room); w.nextRoomId++ }
  return { before: old ? { ...old } : null, after: { ...room } }
}
export function removeRoom(w: WorldState, id: number): RoomChange | null {
  const index = w.rooms.findIndex(r => r.id === id)
  if (index < 0) return null
  if (w.rooms[index].managed && w.rooms[index].status !== 'blueprint') return null
  return { before: { ...w.rooms.splice(index, 1)[0] }, after: null }
}
export function undoRoom(w: WorldState, change: RoomChange): boolean {
  const id = change.after?.id ?? change.before!.id
  const current = w.rooms.find(r => r.id === id) ?? null
  if (JSON.stringify(current) !== JSON.stringify(change.after)) return false
  const addedPods = change.addedPods ?? []
  const addedPlanters = [...(change.addedPlanters ?? [])]
  if (change.before?.status === 'blueprint' && change.after?.managed) {
    // 干房间建成后才接水时，新增作物也归房间；扩建撤销保留原房间内的苗。
    for (const p of w.farm.planters) if (p.roomId === change.after.id && (!change.alsoBefore || !roomContains(change.alsoBefore, p)) && !addedPlanters.some(a => a.id === p.id)) addedPlanters.push(p)
  }
  if (addedPods.length && w.exploration.clueFound && w.pods.every(p => addedPods.some(a => a.id === p.id))) return false
  if (addedPods.some(p => JSON.stringify(w.pods.find(a => a.id === p.id)) !== JSON.stringify(p))) return false
  // 有收成的房间也能撤回施工；食物、水和升级均不回滚。
  if (addedPlanters.some(p => !w.farm.planters.some(a => a.id === p.id && a.x === p.x && a.y === p.y))) return false
  const candidate = { ...w, rooms: w.rooms.filter(r => r.id !== id), pods: w.pods.filter(p => !addedPods.some(a => a.id === p.id)), farm: { ...w.farm, planters: w.farm.planters.filter(p => !addedPlanters.some(a => a.id === p.id)) } }
  if (change.alsoBefore) candidate.rooms.push({ ...change.alsoBefore })
  if (change.before) {
    const check = change.before.status === 'blueprint' ? checkRoomPlan : checkRoom
    if (!check(candidate, change.before).ok) return false
    candidate.rooms.push({ ...change.before })
  }
  const actor = candidate.exploration.explorer
  if (!workersSafe(candidate) || actor && (!atuCanStand(candidate, actor, true) || !atuRoute(candidate, actor, initialAtuPosition(candidate), true))) return false
  w.rooms = candidate.rooms; w.pods = candidate.pods; w.farm.planters = candidate.farm.planters
  w.rooms.sort((a, b) => a.id - b.id)
  return true
}
export function roomSummary(w: WorldState, r: Room): string {
  const beds = w.pods.filter(p => encloses(r, { ...p, w: 3, h: 2 })).length * 2
  const plants = w.farm.planters.filter(p => roomContains(r, p)).length
  if (beds || plants) return [beds ? `${beds}个床位` : '', plants ? `${plants}个菜槽` : ''].filter(Boolean).join(' · ')
  if (r.managed) return r.kind === 'home' ? '住处已建成 · 原设施保留' : r.kind === 'garden' ? w.farm.waterSupplied ? '原设施保留 · 扩建可增加种植空间' : '种植区已建好' : '公共休息座 · 前侧可以通行'
  return r.kind === 'home' ? '预留住处 · 可放睡眠舱' : r.kind === 'garden' ? '预留种植区 · 有水再放菜槽' : '公共空间 · 可自由布置'
}
