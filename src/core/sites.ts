import { atuRoute, initialAtuPosition, soilPlan } from './atu'
import { canPlacePlanter, placePlanter } from './farm'
import { canAfford, changeMaterials, materialText } from './materials'
import { canFinishRoom, finishRoom, planRoom } from './roomConstruction'
import { checkRoomPlan, roomContains, undoRoom, type RoomChange } from './rooms'
import { TILE, type BuiltSite, type Cell, type Inventory, type Rect, type Room, type RoomKind, type SiteKind, type WorldState } from './world'

export interface BuildingSite extends Rect {
  id: string; name: string; icon: string; layer: 'home' | 'water'; kinds: readonly SiteKind[]; cost: Inventory; description: string
}
/** 第二层共餐设施（2A）：定义放这里，meal.ts 引用并再导出，避免相互导入。 */
export const KITCHEN_SITE_ID = 'spring-kitchen'
export const DINING_SITE_ID = 'spring-table'
/** 第一层定用途；第二层有一个二选一洞室，右侧其余软土继续自由探索。 */
export const BUILDING_SITES: readonly BuildingSite[] = [
  { id: 'first-nest', name: '两人小窝', icon: '🛏', layer: 'home', x: 12, y: 9, w: 3, h: 3, kinds: ['home'], cost: { stone: 3, wood: 2 }, description: '铺好两张床，今晚睡个好觉。' },
  { id: 'home-lounge', name: '暖暖客厅', icon: '☕', layer: 'home', x: 28, y: 9, w: 5, h: 3, kinds: ['lounge'], cost: { stone: 4, wood: 2 }, description: '修好旧座椅，家里多一个休息的地方。' },
  { id: 'friends-nest', name: '新朋友的小窝', icon: '🛏', layer: 'home', x: 9, y: 9, w: 3, h: 3, kinds: ['home'], cost: { stone: 3, wood: 2 }, description: '给楼下遇见的新朋友留两张床。' },
  { id: 'spring-garden', name: '泉边小菜园', icon: '🌱', layer: 'water', x: 28, y: 19, w: 3, h: 3, kinds: ['garden'], cost: { stone: 2, wood: 2 }, description: '摆上两个菜槽，让小满种出新鲜蔬菜。' },
  { id: 'water-corner', name: '泉边小洞室', icon: '🌿', layer: 'water', x: 32, y: 19, w: 4, h: 3, kinds: ['garden', 'lounge'], cost: { stone: 2, wood: 2 }, description: '这里由你决定：种菜，还是放休息座椅？' },
  { id: 'spring-kitchen', name: '泉边灶台', icon: '🍲', layer: 'water', x: 10, y: 19, w: 3, h: 3, kinds: ['kitchen'], cost: { stone: 2, wood: 2 }, description: '修一个灶台，把收成做熟。' },
  { id: 'spring-table', name: '围坐餐桌', icon: '🍽', layer: 'water', x: 13, y: 19, w: 4, h: 3, kinds: ['dining'], cost: { stone: 2, wood: 3 }, description: '摆一张餐桌，大家坐下来一起吃。' },
]
export const siteById = (id: string): BuildingSite | undefined => BUILDING_SITES.find(s => s.id === id)
export const siteAt = (p: Cell): BuildingSite | undefined => BUILDING_SITES.find(s => roomContains(s, p))
export const isRoomKind = (kind: SiteKind): kind is RoomKind => kind === 'home' || kind === 'garden' || kind === 'lounge'
export type PreviewRoom = Omit<Room, 'kind'> & { kind: SiteKind }
export const siteRoom = (s: BuildingSite, kind: SiteKind): PreviewRoom => ({ id: 0, kind, x: s.x, y: s.y, w: s.w, h: s.h })
const overlaps = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
export function siteBuilt(w: WorldState, s: BuildingSite): boolean {
  return w.builtSites.some(b => b.id === s.id)
    || w.rooms.some(r => r.status !== 'blueprint' && overlaps(r, s))
    || w.pods.some(p => overlaps({ ...p, w: 3, h: 2 }, s))
}
export function siteVisible(w: WorldState, s: BuildingSite): boolean {
  return w.progress.coreRepaired && (s.layer === 'home' || w.exploration.entered) && (s.id !== 'friends-nest' || w.exploration.entered)
}
/**
 * 预设蓝图只在对应洞室本体已经挖空后出现。
 * 连接大厅的走道仍由阿土在开工时逐格施工；挖掘阶段保留普通泥土命中，蓝图不会提前覆盖土层。
 */
export function siteBlueprintVisible(w: WorldState, s: BuildingSite): boolean {
  if (!siteVisible(w, s)) return false
  for (let y = s.y; y < s.y + s.h; y++) for (let x = s.x; x < s.x + s.w; x++) {
    if (w.tiles[y]?.[x] !== TILE.EMPTY) return false
  }
  return true
}
export function siteBlocker(w: WorldState, s: BuildingSite, kind: SiteKind): string {
  if (!siteVisible(w, s)) return '先点亮家园，再来看看。'
  if (!siteBlueprintVisible(w, s)) return '先把这块空间挖空，建筑蓝图就会出现。'
  if (!s.kinds.includes(kind)) return '这里不适合这个用途。'
  if (siteBuilt(w, s)) return '这里已经建好啦！'
  if (kind === 'garden' && !w.farm.waterSupplied) return '先请小泉把水接到菜园。'
  if (w.rooms.some(r => overlaps(r, s)) || w.farm.planters.some(p => roomContains(s, p))) return '这里保留了原来的设施，去另一个洞室看看吧。'
  if (s.layer === 'home' && !isRoomKind(kind)) return '这里不适合这个用途。'
  if (s.layer === 'home' && !checkRoomPlan(w, siteRoom(s, kind) as Room).ok) return '这里有原来的设施，先保留它们吧。'
  if (!canAfford(w, s.cost)) return `还需要${materialText({ stone: Math.max(0, s.cost.stone - w.inventory.stone), wood: Math.max(0, s.cost.wood - w.inventory.wood) })}，挖旁边的泥土就能找到。`
  return ''
}

/** 含连接走道；只选真实可达的一格，绝不跳过岩石或直接清空矩形。 */
export function siteWorkCells(w: WorldState, s: BuildingSite): Cell[] {
  const anchor = s.layer === 'home' ? (s.x < 17 ? 17 : 25) : w.exploration.shaftX
  if (anchor === null) return []
  const cells: Cell[] = []
  for (let x = Math.min(anchor, s.x); x < Math.max(anchor + 1, s.x + s.w); x++) {
    for (let y = s.y + s.h - 1; y >= s.y; y--) {
      // 连接走道只需两格高，房间保持完整三格。
      if (y === s.y && (x < s.x || x >= s.x + s.w)) continue
      cells.push({ x, y })
    }
  }
  return cells
}
export function nextSiteDig(w: WorldState, s: BuildingSite): Cell | null {
  const actor = w.exploration.explorer
  if (!actor) return null
  return siteWorkCells(w, s).find(p => w.tiles[p.y]?.[p.x] === TILE.SOIL && soilPlan(w, actor, p).ok) ?? null
}
export interface SiteChange { site: BuiltSite; cost: Inventory; room?: RoomChange; addedPlanters: number[] }
export function finishSite(w: WorldState, s: BuildingSite, kind: SiteKind): SiteChange | null {
  if (siteBlocker(w, s, kind) || siteWorkCells(w, s).some(p => w.tiles[p.y]?.[p.x] !== TILE.EMPTY)) return null
  const actor = w.exploration.explorer
  if (!actor || !atuRoute(w, actor, { x: s.x, y: s.y + s.h - 1 })) return null
  const change: SiteChange = { site: { id: s.id, kind }, cost: { ...s.cost }, addedPlanters: [] }
  if (s.layer === 'home') {
    if (!isRoomKind(kind)) return null
    // 在副本上完成，任何失败都不会留下一份半提交蓝图。
    const copy = structuredClone(w), draft = siteRoom(s, kind) as Room
    const plan = planRoom(copy, draft)
    if (!plan || !canFinishRoom(copy, plan.after!).ok) return null
    change.room = finishRoom(copy, plan.after!.id)!
    // 预设建造不需要撤回到旧蓝图状态。
    change.room.before = null
    w.rooms = copy.rooms; w.nextRoomId = copy.nextRoomId; w.pods = copy.pods
  } else if (kind === 'garden') {
    const xs = [s.x, s.x + 2]
    if (xs.some(x => !canPlacePlanter(w, x, 21).ok)) return null
    for (const x of xs) change.addedPlanters.push(placePlanter(w, x, 21)!.id)
  }
  w.builtSites.push(change.site); changeMaterials(w, s.cost, -1)
  return change
}
export function undoSite(w: WorldState, change: SiteChange): boolean {
  if (!w.builtSites.some(b => b.id === change.site.id && b.kind === change.site.kind)) return false
  // 围坐共餐已经发生过：灶台和餐桌成为家里的事实设施，不能再"撤销没建过"，
  // 否则存档会出现"围坐过却没有设施"的矛盾状态（进度位单调，章末不回退）。
  if (w.farm.sharedMeals > 0 && (change.site.id === KITCHEN_SITE_ID || change.site.id === DINING_SITE_ID)) return false
  if (change.room && !undoRoom(w, change.room)) return false
  w.farm.planters = w.farm.planters.filter(p => !change.addedPlanters.includes(p.id))
  w.builtSites = w.builtSites.filter(b => b.id !== change.site.id)
  changeMaterials(w, change.cost)
  return true
}
/** 严格校验新存档中的洞室身份、地形与实际设施。 */
export function validBuiltSites(w: WorldState): boolean {
  const ids = new Set<string>()
  return w.builtSites.every(b => {
    if (!b || typeof b.id !== 'string') return false
    const s = siteById(b.id)
    if (!s || ids.has(b.id) || !s.kinds.includes(b.kind) || !siteVisible(w, s)) return false
    ids.add(b.id)
    if (siteWorkCells(w, s).some(p => w.tiles[p.y]?.[p.x] !== TILE.EMPTY)) return false
    if (s.layer === 'home') return w.rooms.some(r => r.status !== 'blueprint' && r.managed && r.kind === b.kind && r.x === s.x && r.y === s.y && r.w === s.w && r.h === s.h)
    if (!atuRoute(w, initialAtuPosition(w), { x: s.x, y: 21 }, true)) return false
    return b.kind !== 'garden' || w.farm.waterSupplied && [s.x, s.x + 2].every(x => w.farm.planters.some(p => p.x === x && p.y === 21))
  })
}
