import { TILE, type Cell, type WorldState } from './world'

export const DEEP_FLOOR = 34
export const DEEP_FOOT = DEEP_FLOOR - 1
export const AYAN_SPOT: Cell = { x: 36, y: 21 }
export const CRYSTAL_SPOT: Cell = { x: 30, y: DEEP_FOOT }
export const MOSS_SPOT: Cell = { x: 38, y: DEEP_FOOT }
export const DRILL_SPOT: Cell = { x: 19, y: DEEP_FOOT }
export const deepShaftCell = (w: WorldState, x: number, y: number): boolean => x === w.exploration.shaftX && y >= 22 && y <= 30
export const deepLadderCell = (w: WorldState, x: number, y: number): boolean => w.deep.metAyan && x === w.exploration.shaftX && y >= 21 && y <= DEEP_FOOT
export function deepFrontier(w: WorldState): Cell | null {
  const x = w.exploration.shaftX
  if (x === null) return null
  for (let y = 22; y <= 30; y++) if (w.tiles[y][x] !== TILE.EMPTY) return { x, y }
  return null
}
export const deepConnected = (w: WorldState): boolean => w.deep.metAyan && deepFrontier(w) === null
/** 只画从上方连续接下来的梯段，天然空洞里不会提前浮着梯子。 */
export function deepLadderSegments(w: WorldState): number[] {
  const x = w.exploration.shaftX, rows: number[] = []
  if (!w.deep.metAyan || x === null) return rows
  for (let y = 22; y <= DEEP_FOOT; y++) { if (w.tiles[y][x] !== TILE.EMPTY) break; rows.push(y) }
  return rows
}
export const mineralCell = (x: number, y: number): boolean => (x === 10 || x === 11) && y >= 31 && y <= DEEP_FOOT
export function deepSpan(w: WorldState): { left: number; right: number } | null {
  const x = w.exploration.shaftX
  if (!w.deep.entered || x === null || !deepConnected(w)) return null
  let left = x, right = x
  while (w.tiles[DEEP_FOOT]?.[left - 1] === TILE.EMPTY) left--
  while (w.tiles[DEEP_FOOT]?.[right + 1] === TILE.EMPTY) right++
  return { left, right }
}
