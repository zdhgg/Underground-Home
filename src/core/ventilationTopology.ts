import { TILE, type Cell, type VentilationFacilityKind, type WorldState } from './world'
export const VENTILATION_TOP = 79, VENTILATION_FOOT = 82, VENTILATION_FLOOR = 83
export const LINGLING_SPOT: Cell = { x: 36, y: 82 }, ECHO_SPOT: Cell = { x: 38, y: 82 }, VANE_SPOT: Cell = { x: 10, y: 82 }
export const ventilationWidth = (kind: VentilationFacilityKind): number => kind === 'bench' ? 5 : kind === 'fan' || kind === 'nest' ? 4 : kind === 'baffle' ? 2 : 3
export const ventilationShaftCell = (w: WorldState, x: number, y: number): boolean => x === w.exploration.shaftX && y >= 71 && y <= 78
export const ventilationLadderCell = (w: WorldState, x: number, y: number): boolean => w.ventilation.braced && x === w.exploration.shaftX && y >= 70 && y <= 82
export function ventilationFrontier(w: WorldState): Cell | null {
  const x = w.exploration.shaftX
  if (x === null) return null
  for (let y = 71; y <= 78; y++) if (w.tiles[y][x] !== TILE.EMPTY) return { x, y }
  return null
}
export const ventilationConnected = (w: WorldState): boolean => w.ventilation.braced && ventilationFrontier(w) === null
export function ventilationSpan(w: WorldState): { left: number; right: number } | null {
  const x = w.exploration.shaftX
  if (!w.ventilation.entered || !ventilationConnected(w) || x === null) return null
  let left = x, right = x
  while (w.tiles[82][left - 1] === TILE.EMPTY) left--
  while (w.tiles[82][right + 1] === TILE.EMPTY) right++
  return { left, right }
}
export const ventilationClear = (w: WorldState, x: number): boolean => [79, 80, 81, 82].every(y => w.tiles[y]?.[x] === TILE.EMPTY)
export const ventilationOccupies = (w: WorldState, x: number, y: number): boolean => y >= 79 && y <= 83 && w.ventilation.facilities.some(f => x >= f.x && x < f.x + ventilationWidth(f.kind))
/** 风管只沿四格净空与后侧岩壁连续连接；没有自动穿岩或真实流体。 */
export function ventilationDuctPath(w: WorldState): number[] | null {
  const required = ['inlet', 'fan', 'baffle', 'bench'] as const
  const facilities = required.map(kind => w.ventilation.facilities.find(f => f.kind === kind))
  if (facilities.some(f => !f)) return null
  const left = Math.min(...facilities.map(f => f!.x), w.exploration.shaftX!), right = Math.max(...facilities.map(f => f!.x + ventilationWidth(f!.kind) - 1), w.exploration.shaftX!)
  const path: number[] = []
  for (let x = left; x <= right; x++) { if (!ventilationClear(w, x)) return null; path.push(x) }
  return path
}
export const ventilationNetwork = (w: WorldState): boolean => {
  const path = ventilationDuctPath(w)
  return !!path && path.every(x => w.ventilation.duct.includes(x))
}
