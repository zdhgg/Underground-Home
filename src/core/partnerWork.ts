import { atuCanStand, atuRoute, initialAtuPosition } from './atu'
import { canPlaceWallLamp } from './exploration'
import { canSupplyWater, planterAt, RIPE_STAGE } from './farm'
import { availablePartners, PARTNERS, partnerById } from './partners'
import { LANDMARKS, type Cell, type WorkerId, type WorldState } from './world'
import { canRetrofitLamp } from './lighting'

export type WorkTarget = { kind: 'harvest'; x: number; y: number } | { kind: 'water' } | { kind: 'watering'; x: number; y: number } | { kind: 'lamp' | 'lamp-retrofit'; x: number } | { kind: 'deep-rock'; x: number; y: number }
export interface WorkPlan { worker: WorkerId; target: WorkTarget; at: Cell; route: Cell[] }
export const WORKERS: readonly WorkerId[] = PARTNERS.map(p => p.id).filter((id): id is WorkerId => id !== 'atu')
export const workOwner = (target: WorkTarget): WorkerId => target.kind === 'harvest' || target.kind === 'watering' ? 'xiaoman' : target.kind === 'water' ? 'xiaoquan' : 'adeng'
export const workTitle = (target: WorkTarget): string => target.kind === 'harvest' ? '收菜' : target.kind === 'water' ? '接水管' : target.kind === 'watering' ? '浇浇水' : target.kind === 'lamp-retrofit' ? '加装聚光灯罩' : '装壁灯'
export const workerName = (id: WorkerId): string => partnerById(id)!.name
export function workerHomeRoute(w: WorldState, p: Cell, returning?: WorkerId): Cell[] | null {
  if (!returning) return atuRoute(w, p, initialAtuPosition(w), true)
  // 返营地停在空闲侧边，避免和阿土/待命伙伴挤在同一个格子里。
  for (const x of [18, 17, 25, 24, 20, 23]) {
    const to = { x, y: 11 }
    if (w.exploration.explorer?.x === x && w.exploration.explorer.y === 11) continue
    if (Object.entries(w.workers).some(([id, other]) => id !== returning && other?.x === x && other.y === 11)) continue
    const route = atuRoute(w, p, to, true)
    if (route) return route
  }
  return null
}

/** 只在加入或旧档迁移时初始化。已有站位绝不为了接工作换起点。 */
export function initializeWorkers(w: WorldState): boolean {
  let changed = false
  const joined = availablePartners(w).filter(p => p.id !== 'atu' && w.progress.coreRepaired)
  // 旧加入条件来自床位/泉水；撤销首床后不能把已离开的伙伴站位写成非法存档。
  for (const id of Object.keys(w.workers) as WorkerId[]) {
    if (!joined.some(p => p.id === id)) { delete w.workers[id]; changed = true }
  }
  if (!w.progress.coreRepaired) return changed
  for (const partner of availablePartners(w)) {
    if (partner.id === 'atu' || w.workers[partner.id]) continue
    const id = partner.id
    // 小满先在泉水层的天然洞穴里等玩家；小泉在泉边。两人都不占第一层的大厅。
    const near = id === 'lingling' ? [{x:36,y:82},{x:35,y:82},{x:37,y:82}] : id === 'tuantuan' ? [{ x:12,y:70 }, { x:13,y:70 }, { x:11,y:70 }] : id === 'taitai' ? [{ x: 36, y: 58 }, { x: 35, y: 58 }, { x: 37, y: 58 }] : id === 'ayan' ? [{ x: 36, y: 21 }]
      : id === 'amu' ? w.deep.facilities.filter(f => f.kind === 'workshop').flatMap(f => [{ x: f.x + 1, y: 33 }, { x: f.x + 2, y: 33 }, { x: f.x, y: 33 }])
      : id === 'xiaoman' ? [{ x: 25, y: 21 }, { x: 24, y: 21 }, { x: 26, y: 21 }]
      : id === 'xiaoquan' ? w.farm.waterSupplied ? [{ x: 18, y: 11 }] : [{ x: 19, y: 21 }, { ...LANDMARKS.spring }] : []
    const facility = id === 'xiaoman' ? w.farm.planters.flatMap(p => [{ x: p.x - 1, y: p.y }, { x: p.x + 1, y: p.y }])
      : id === 'adeng' ? w.exploration.lamps.map(p => ({ x: p.x, y: 21 })) : []
    const lounges = w.rooms.filter(r => r.kind === 'lounge').flatMap(r => [{ x: r.x, y: r.y + r.h - 1 }, { x: r.x + r.w - 1, y: r.y + r.h - 1 }])
    const home = id === 'adeng' ? [24, 25, 20, 18] : [17, 25, 18, 24]
    const candidates = [...near, ...facility, ...lounges, ...home.map(x => ({ x, y: 11 }))]
    const safe = candidates.filter(p => atuCanStand(w, p, true) && workerHomeRoute(w, p))
    const spot = safe.find(p => !Object.values(w.workers).some(other => other?.x === p.x && other.y === p.y)
      && !(w.exploration.explorer?.x === p.x && w.exploration.explorer.y === p.y)) ?? safe[0]
    if (spot) { w.workers[id] = { ...spot }; changed = true }
  }
  return changed
}

export function workAvailable(w: WorldState, t: WorkTarget): boolean {
  if (t.kind === 'harvest') return (planterAt(w, t.x, t.y)?.growth ?? -1) >= RIPE_STAGE
  if (t.kind === 'watering') {
    const planter = planterAt(w, t.x, t.y)
    return !!planter && planter.growth < RIPE_STAGE
  }
  return t.kind === 'water' ? canSupplyWater(w) : t.kind === 'lamp-retrofit' ? canRetrofitLamp(w, t.x) : canPlaceWallLamp(w, t.x)
}

export function planPartnerWork(w: WorldState, target: WorkTarget): { ok: true; plan: WorkPlan } | { ok: false; message: string } {
  const worker = workOwner(target), from = w.workers[worker]
  if (!partnerById(worker)?.joins(w) || !from) return { ok: false, message: `${workerName(worker)}还没准备好，先继续探索吧。` }
  if (!workAvailable(w, target)) return { ok: false, message: '这里还没准备好，看看设施的提示吧。' }
  const cell = target.kind === 'water' ? LANDMARKS.spring
    : target.kind === 'harvest' || target.kind === 'watering' ? { x: target.x, y: target.y }
      : { x: target.x, y: 21 }
  const options = target.kind === 'lamp' || target.kind === 'lamp-retrofit' ? [cell] : [{ x: cell.x - 1, y: cell.y }, { x: cell.x + 1, y: cell.y }, cell]
  const routes = options.map(to => atuRoute(w, from, to)).filter((r): r is Cell[] => r !== null)
  // 尽量停在设施旁，不踩进菜槽或泉水；同类位置再选较短路径。
  const route = routes.filter(r => r.at(-1)!.x !== cell.x).sort((a, b) => a.length - b.length)[0] ?? routes[0]
  if (!route) return { ok: false, message: `${workerName(worker)}走不到这里，先挖出两格高、连到梯子或大厅的通道吧。` }
  return { ok: true, plan: { worker, target: { ...target }, at: { ...route.at(-1)! }, route } }
}
