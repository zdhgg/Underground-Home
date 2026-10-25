import { atuRoute, initialAtuPosition } from './atu'
import { TILE, type Cell, type WallLamp, type WorldState } from './world'

export const WIDE_LAMP_ID = 'wide-lamp-shade'
export const BASIC_LIGHT_RANGE = 2
export const WIDE_LIGHT_RANGE = 4
export const hasWideLampAbility = (w: WorldState): boolean => w.partnerUpgrades.includes(WIDE_LAMP_ID)
export interface LitCell extends Cell { strength: number }

/** 晶光灯同样只沿真实空洞传播，升级改变距离，不改变穿岩规则。 */
export function deepLampCoverage(w: WorldState, lampX: number): LitCell[] {
  if (!w.deep.entered || !w.deep.facilities.some(f => f.kind === 'distributor')) return []
  const range = w.deep.farLight ? 6 : 3, field: LitCell[] = []
  for (const dir of [-1, 1]) for (let distance = dir === -1 ? 0 : 1; distance <= range; distance++) {
    const x = lampX + distance * dir
    if (![31, 32, 33].every(y => w.tiles[y]?.[x] === TILE.EMPTY)) break
    for (const y of [31, 32, 33]) field.push({ x, y, strength: 1 - distance / (range + 1) })
  }
  return field
}

/** 沿有两格身体净空的已挖通洞室传播。每盏灯独立计算，土/岩阻断扩散。 */
export function lampCoverage(w: WorldState, lamp: Cell, wide = false): LitCell[] {
  if (!w.powerDown || !w.exploration.entered || ![19, 20, 21].every(y => w.tiles[y]?.[lamp.x] === TILE.EMPTY)) return []
  const range = wide ? WIDE_LIGHT_RANGE : BASIC_LIGHT_RANGE, cells: LitCell[] = []
  for (const direction of [-1, 1]) for (let distance = direction === -1 ? 0 : 1; distance <= range; distance++) {
    const x = lamp.x + direction * distance
    if (w.tiles[20]?.[x] !== TILE.EMPTY || w.tiles[21]?.[x] !== TILE.EMPTY) break
    for (const y of [19, 20, 21]) if (w.tiles[y][x] === TILE.EMPTY) cells.push({ x, y, strength: 1 - distance / (range + 1) * .65 })
  }
  return cells
}

export function lightField(w: WorldState, wideOnly = false): LitCell[] {
  const cells = new Map<string, LitCell>()
  for (const lamp of w.exploration.lamps) {
    if (wideOnly && !lamp.wide) continue
    for (const p of lampCoverage(w, lamp, lamp.wide === true)) {
      const key = `${p.x},${p.y}`
      if ((cells.get(key)?.strength ?? 0) < p.strength) cells.set(key, p)
    }
  }
  return [...cells.values()]
}

/** 有真实的照明缺口才给建议，不制造变暗或强制任务。 */
export function lightingOpportunity(w: WorldState): { lamp: WallLamp; target: Cell } | null {
  if (!w.progress.coreRepaired || !w.exploration.springFound || !w.powerDown) return null
  const covered = new Set(lightField(w).map(p => `${p.x},${p.y}`))
  const from = w.workers.adeng ?? initialAtuPosition(w)
  for (const lamp of w.exploration.lamps) {
    if (lamp.wide || !atuRoute(w, from, { x: lamp.x, y: 21 }, true)) continue
    for (const p of lampCoverage(w, lamp, true)) {
      if (p.y === 21 && !covered.has(`${p.x},${p.y}`) && atuRoute(w, from, p, true)) return { lamp, target: { x: p.x, y: p.y } }
    }
  }
  return null
}

export function canRetrofitLamp(w: WorldState, x: number): boolean {
  return hasWideLampAbility(w) && w.powerDown && w.exploration.lamps.some(l => l.x === x && !l.wide)
}
export function retrofitLamp(w: WorldState, x: number): boolean {
  if (!canRetrofitLamp(w, x)) return false
  w.exploration.lamps.find(l => l.x === x)!.wide = true
  return true
}
