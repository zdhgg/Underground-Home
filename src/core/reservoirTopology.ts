import { TILE, type Cell, type ReservoirFacilityKind, type WorldState } from './world'
export const RESERVOIR_TOP = 67, RESERVOIR_FOOT = 70, RESERVOIR_FLOOR = 71
export const TUANTUAN_SPOT: Cell = { x: 12, y: 70 }, SHELL_SPOT: Cell = { x: 38, y: 70 }, REED_SPOT: Cell = { x: 10, y: 70 }
export const reservoirWidth = (kind: ReservoirFacilityKind): number => kind === 'basin' ? 5 : kind === 'wheel' || kind === 'nest' ? 4 : kind === 'gate' ? 2 : 3
export const reservoirShaftCell = (w: WorldState, x: number, y: number): boolean => x === w.exploration.shaftX && y >= 59 && y <= 66
export const reservoirLadderCell = (w: WorldState, x: number, y: number): boolean => w.reservoir.shored && x === w.exploration.shaftX && y >= 58 && y <= 70
export function reservoirFrontier(w: WorldState): Cell | null {
  const x = w.exploration.shaftX
  if (x === null) return null
  for (let y = 59; y <= 66; y++) if (w.tiles[y][x] !== TILE.EMPTY) return { x, y }
  return null
}
export const reservoirConnected = (w: WorldState): boolean => w.reservoir.shored && reservoirFrontier(w) === null
export function reservoirSpan(w: WorldState): { left: number; right: number } | null {
  const x = w.exploration.shaftX
  if (!w.reservoir.entered || !reservoirConnected(w) || x === null) return null
  let left = x, right = x
  while (w.tiles[70][left - 1] === TILE.EMPTY) left--
  while (w.tiles[70][right + 1] === TILE.EMPTY) right++
  return { left, right }
}
export const reservoirClear = (w: WorldState, x: number): boolean => [67, 68, 69, 70].every(y => w.tiles[y]?.[x] === TILE.EMPTY)
export const reservoirOccupies = (w: WorldState, x: number, y: number): boolean => y >= 67 && y <= 71 && w.reservoir.facilities.some(f => x >= f.x && x < f.x + reservoirWidth(f.kind))
/** 管渠只沿四格净空与后侧岩壁连续连接；没有自动穿岩或真实流体。 */
export function reservoirCanalPath(w: WorldState): number[] | null {
  const required = ['intake', 'basin', 'gate', 'wheel'] as const
  const facilities = required.map(kind => w.reservoir.facilities.find(f => f.kind === kind))
  if (facilities.some(f => !f)) return null
  const left = Math.min(...facilities.map(f => f!.x), w.exploration.shaftX!), right = Math.max(...facilities.map(f => f!.x + reservoirWidth(f!.kind) - 1), w.exploration.shaftX!)
  const path: number[] = []
  for (let x = left; x <= right; x++) { if (!reservoirClear(w, x)) return null; path.push(x) }
  return path
}
export const reservoirNetwork = (w: WorldState): boolean => {
  const path = reservoirCanalPath(w)
  return !!path && path.every(x => w.reservoir.canal.includes(x))
}
