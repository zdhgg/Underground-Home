import { podBlocksPassage } from './passages'
import { canDig, type DigResult } from './dig'
import { canStand, isShaftColumn, shaftConnected } from './exploration'
import { TILE, type Cell, type WorldState } from './world'

export const sameCell = (a: Cell | null, b: Cell): boolean => a?.x === b.x && a.y === b.y
const occupied = (w: WorldState, x: number, y: number): boolean => w.pods.some(p => podBlocksPassage(w, p) && x >= p.x && x < p.x + 3 && y >= p.y && y < p.y + 2)
const clear = (w: WorldState, x: number, y: number): boolean => w.tiles[y]?.[x] === TILE.EMPTY && !occupied(w, x, y)

/** 脚所在格 + 上方净空，覆盖40px身体。梯道是唯一允许上下移动的交通。 */
export function atuCanStand(w: WorldState, p: Cell, deep = false): boolean {
  return p.x > 0 && p.x < w.width - 1 && p.y >= 11 && p.y <= 21
    && (p.y < 19 || w.exploration.entered || (deep && shaftConnected(w)))
    && clear(w, p.x, p.y) && clear(w, p.x, p.y - 1) && canStand(w, p.x, p.y)
}

export function atuRoute(w: WorldState, from: Cell, to: Cell, deep = false): Cell[] | null {
  if (!atuCanStand(w, from, deep) || !atuCanStand(w, to, deep)) return null
  const queue = [from], previous = new Map<string, Cell | null>([[`${from.x},${from.y}`, null]])
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i]
    if (sameCell(p, to)) {
      const result: Cell[] = []
      let step: Cell | null = p
      while (step) { result.unshift(step); step = previous.get(`${step.x},${step.y}`) ?? null }
      return result
    }
    for (const n of [{ x: p.x - 1, y: p.y }, { x: p.x + 1, y: p.y }, { x: p.x, y: p.y - 1 }, { x: p.x, y: p.y + 1 }]) {
      if (n.y !== p.y && (!isShaftColumn(p.x) || p.x !== w.exploration.shaftX)) continue
      const key = `${n.x},${n.y}`
      if (!previous.has(key) && atuCanStand(w, n, deep)) { previous.set(key, p); queue.push(n) }
    }
  }
  return null
}

export function moveDestination(w: WorldState, from: Cell, clicked: Cell): Cell[] | null {
  if (w.tiles[clicked.y]?.[clicked.x] !== TILE.EMPTY) return null
  const limit = clicked.y < 12 ? 11 : 21
  for (let y = Math.max(11, clicked.y); y <= limit; y++) {
    if (w.tiles[y]?.[clicked.x] !== TILE.EMPTY) break
    const route = atuRoute(w, from, { x: clicked.x, y })
    if (route) return route
  }
  return null
}

export interface SoilPlan { target: Cell; stand: Cell; route: Cell[]; lift: 0 | 1; overhead?: true }
export type SoilPlanning = { ok: true; plan: SoilPlan } | { ok: false; message: string; blocker?: Cell; failure?: DigResult }

/** 暴露的侧面才能接触；下两格地面施工，第三格需一格高踏台。踏台不能叠加或放在梯子上。 */
export function soilPlan(w: WorldState, from: Cell, target: Cell): SoilPlanning {
  const permission = canDig(w, target.x, target.y)
  if (!permission.ok) return { ok: false, message: '', failure: permission }
  if (permission.tile !== TILE.SOIL) return { ok: false, message: '裂纹岩要用小铁镐。' }
  const options: SoilPlan[] = []
  for (const dx of [-1, 1]) for (const dy of [0, 1, 2]) {
    const stand = { x: target.x + dx, y: target.y + dy }, lift = dy === 2 ? 1 : 0
    if (!clear(w, stand.x, target.y)) continue
    if (lift && (!clear(w, stand.x, stand.y - 2) || w.tiles[stand.y + 1]?.[stand.x] === TILE.EMPTY)) continue
    const route = atuRoute(w, from, stand)
    if (route) options.push({ target: { ...target }, stand, lift, route })
  }
  options.sort((a, b) => a.route.length - b.route.length || a.lift - b.lift)
  if (options[0]) return { ok: true, plan: options[0] }
  // 梯口旁不能把高踏台架在梯子上。先清出自身两格净空后，
  // 可站实地用12px矮凳向正上方挖；身体仍留在已挖空空间内。
  const below = { x: target.x, y: target.y + 2 }, overheadRoute = atuRoute(w, from, below)
  if (overheadRoute && w.tiles[below.y + 1]?.[below.x] !== TILE.EMPTY) return {
    ok: true, plan: { target: { ...target }, stand: below, route: overheadRoute, lift: 1, overhead: true },
  }
  // 三格高的施工先清出踏台上方，提示具体的一格，不替玩家自动开挖。
  for (const dx of [-1, 1]) {
    const stand = { x: target.x + dx, y: target.y + 2 }
    if (w.tiles[target.y]?.[stand.x] === TILE.SOIL && atuRoute(w, from, stand)) return {
      ok: false, message: '小凳子上方还有土，先挖亮框里的这一格。', blocker: { x: stand.x, y: target.y },
    }
  }
  // 指出可接触的挡路土，不替玩家开挖，也不为远处目标自动安排长队列。
  const direction = Math.sign(target.x - from.x)
  if (direction) for (let x = from.x + direction; direction > 0 ? x < target.x : x > target.x; x += direction) {
    for (const y of [from.y, from.y - 1]) if (w.tiles[y]?.[x] === TILE.SOIL) return {
      ok: false, message: '先挖开前面亮框里的土。', blocker: { x, y },
    }
  }
  return { ok: false, message: target.y < from.y - 2 ? '这里还够不到，需要施工梯。' : '这里还站不稳，先挖出能走过去的通道。' }
}

export function soilPlanStillValid(w: WorldState, plan: SoilPlan): boolean {
  const current = soilPlan(w, plan.stand, plan.target)
  return current.ok && sameCell(current.plan.stand, plan.stand) && current.plan.lift === plan.lift
}

export function initialAtuPosition(w: WorldState): Cell {
  for (const x of [18, 25, 17, 24, 19, 20, 21, 22, 23]) {
    if (atuCanStand(w, { x, y: 11 })) return { x, y: 11 }
  }
  return { x: 18, y: 11 }
}

/** 建设施与撤销不能埋住专业伙伴，或切断其回大厅的真实通路。 */
export function workersSafe(w: WorldState): boolean {
  return Object.values(w.workers).every(p => p && atuCanStand(w, p, true) && atuRoute(w, p, initialAtuPosition(w), true) !== null)
}

/** 建床前安排退让：未来舱体既不能埋住角色，也不能把他隔在回家通道另一侧。 */
export function routeBeforePod(w: WorldState, actor: Cell, anchor: Cell): Cell[] | null {
  const candidates = [actor]
  for (let d = 1; d < w.width; d++) candidates.push({ x: actor.x - d, y: actor.y }, { x: actor.x + d, y: actor.y })
  for (const to of candidates) {
    const before = atuRoute(w, actor, to)
    if (!before) continue
    w.pods.push({ id: -1, ...anchor, door: 'left' })
    let safe = false
    try { safe = [18, 25].some(x => atuRoute(w, to, { x, y: 11 }) !== null) }
    finally { w.pods.pop() }
    if (safe) return before
  }
  return null
}
