import { canPlacePod } from './build'
import { canPlacePlanter, placePlanter } from './farm'
import { checkRoom, checkRoomPlan, roomContains, type RoomChange } from './rooms'
import { HOME_FLOOR_Y, TILE, type Rect, type Room, type RoomKind, type WorldState } from './world'

/** 扩建每增加一格的材料；用途不能在扩建时改变。 */
export const ROOM_EXPANSION_COST = { stone: 1, wood: 1 } as const
export function roomExpansionCost(from: Room, to: Room): { stone: number; wood: number } {
  const cells = Math.max(0, to.w - from.w)
  return { stone: ROOM_EXPANSION_COST.stone * cells, wood: ROOM_EXPANSION_COST.wood * cells }
}

/** 新用途只需增加规格和设施布局；施工不负责角色寻路或动画。 */
export const ROOM_SPECS: Record<RoomKind, { width: number; min: number; purpose: string }> = {
  home: { width: 3, min: 3, purpose: '睡觉与安顿伙伴' },
  garden: { width: 5, min: 3, purpose: '接水后种菜，收获食物' },
  lounge: { width: 5, min: 4, purpose: '公共休息与相聚' },
}
export function roomCapacity(r: Room): string {
  return r.kind === 'home' ? `${Math.floor(r.w / 3) * 2}个床位`
    : r.kind === 'garden' ? `${Math.floor((r.w - 1) / 2)}个菜槽` : `${Math.max(1, Math.floor((r.w - 2) / 2))}组休息座`
}
export function excavationLeft(w: WorldState, r: Rect): number {
  let count = 0
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (w.tiles[y]?.[x] !== TILE.EMPTY) count++
  return count
}
export function planRoom(w: WorldState, draft: Room): RoomChange | null {
  if (!Object.hasOwn(ROOM_SPECS, draft.kind) || draft.w < ROOM_SPECS[draft.kind].min || !checkRoomPlan(w, draft).ok) return null
  const old = draft.id ? w.rooms.find(r => r.id === draft.id && r.status === 'blueprint') : null
  if (draft.id && !old) return null
  if (draft.replaces && w.rooms.some(r => r.replaces === draft.replaces && r.id !== old?.id)) return null
  const room: Room = { ...draft, id: old?.id ?? w.nextRoomId, status: 'blueprint' }
  delete room.managed
  if (old) w.rooms[w.rooms.indexOf(old)] = room
  else { w.rooms.push(room); w.nextRoomId++ }
  return { before: old ? { ...old } : null, after: { ...room } }
}

/** 不移动旧设施；空缺由后侧基础设施补齐。所有写入在确认建成后发生。 */
function furnish(w: WorldState, r: Room): void {
  if (r.kind === 'home') {
    const target = Math.floor(r.w / 3)
    let beds = w.pods.filter(p => roomContains(r, p) && roomContains(r, { x: p.x + 2, y: p.y + 1 })).length
    for (let x = r.x; x + 3 <= r.x + r.w && beds < target; x++) {
      if (w.farm.planters.some(p => p.x >= x && p.x < x + 3 && roomContains(r, p))) continue
      const result = canPlacePod(w, x, HOME_FLOOR_Y - 2, undefined, true)
      if (!result.ok) continue
      w.pods.push({ id: Math.max(0, ...w.pods.map(p => p.id)) + 1, x, y: HOME_FLOOR_Y - 2, door: result.door, backWall: true }); beds++
    }
  } else if (r.kind === 'garden' && w.farm.waterSupplied) {
    const target = Math.floor((r.w - 1) / 2)
    let plants = w.farm.planters.filter(p => roomContains(r, p)).length
    const preferred = Array.from({ length: target }, (_, n) => r.x + 1 + n * 2)
    const candidates = [...new Set([...preferred, ...Array.from({ length: r.w }, (_, n) => r.x + n)])]
    for (const x of candidates) {
      if (plants >= target) break
      if (canPlacePlanter(w, x, HOME_FLOOR_Y - 1).ok) {
        const planter = placePlanter(w, x, HOME_FLOOR_Y - 1)!
        planter.roomId = r.id; plants++
      }
    }
  }
}
export function finishRoom(w: WorldState, id: number): RoomChange | null {
  const plan = w.rooms.find(r => r.id === id && r.status === 'blueprint')
  if (!plan || !canFinishRoom(w, plan).ok) return null
  const old = plan.replaces ? w.rooms.find(r => r.id === plan.replaces) : undefined
  const room: Room = { id: old?.id ?? plan.id, kind: plan.kind, x: plan.x, y: plan.y, w: plan.w, h: plan.h, managed: true }
  const beforePods = new Set(w.pods.map(p => p.id)), beforePlants = new Set(w.farm.planters.map(p => p.id))
  w.rooms = w.rooms.filter(r => r.id !== plan.id && r.id !== old?.id); w.rooms.push(room)
  w.rooms.sort((a, b) => a.id - b.id)
  furnish(w, room)
  return { before: { ...plan }, after: { ...room }, ...(old ? { alsoBefore: { ...old } } : {}), addedPods: w.pods.filter(p => !beforePods.has(p.id)).map(p => ({ ...p })), addedPlanters: w.farm.planters.filter(p => !beforePlants.has(p.id)).map(p => ({ ...p })) }
}
/** 在副本上试排设施，避免先提交一个没有实际功能的房间。 */
export function canFinishRoom(w: WorldState, plan: Room): ReturnType<typeof checkRoom> {
  const physical = checkRoom(w, plan)
  if (!physical.ok) return physical
  const room: Room = { ...plan, id: plan.replaces ?? plan.id, managed: true }
  delete room.status; delete room.replaces
  const candidate = { ...w, rooms: [...w.rooms.filter(r => r.id !== plan.id && r.id !== plan.replaces), room], pods: [...w.pods], farm: { ...w.farm, waterSupplied: room.kind === 'garden' || w.farm.waterSupplied, planters: [...w.farm.planters] } }
  furnish(candidate, room)
  if (room.kind === 'home' && !candidate.pods.some(p => roomContains(room, p) && roomContains(room, { x: p.x + 2, y: p.y + 1 }))) return { ok: false, reason: 'layout' }
  if (room.kind === 'garden' && !candidate.farm.planters.some(p => roomContains(room, p))) return { ok: false, reason: 'layout' }
  return { ok: true }
}
/** 接水完成时启用已建种植区；不提前生成作物，也不重置旧苗。 */
export function activateGardens(w: WorldState): number {
  const before = w.farm.planters.length
  for (const r of w.rooms) if (r.status !== 'blueprint' && r.managed && r.kind === 'garden') furnish(w, r)
  return w.farm.planters.length - before
}
