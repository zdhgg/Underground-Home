import { TILE, type Cell, type FinaleFacilityKind, type WorldState } from './world'
export const WARMTH_SPOT:Cell={x:36,y:106}
export const FINALE_TOP = 103, FINALE_FOOT = 106, FINALE_FLOOR = 107
export const finaleWidth = (kind: FinaleFacilityKind): number => kind === 'table' ? 10 : kind === 'memory' || kind === 'beacon' ? 4 : kind === 'bench' ? 3 : 1
export const finaleShaftCell = (w: WorldState, x: number, y: number): boolean => x === w.exploration.shaftX && y >= 95 && y <= 102
export const finaleLadderCell = (w: WorldState, x: number, y: number): boolean => w.finale.braced && x === w.exploration.shaftX && y >= 94 && y <= 106
export function finaleFrontier(w: WorldState): Cell | null {
  const x = w.exploration.shaftX
  if (x === null) return null
  for (let y = 95; y <= 102; y++) if (w.tiles[y][x] !== TILE.EMPTY) return { x, y }
  return null
}
export const finaleConnected = (w: WorldState): boolean => w.finale.braced && finaleFrontier(w) === null
export function finaleSpan(w: WorldState): { left: number; right: number } | null {
  const x = w.exploration.shaftX
  if (!w.finale.entered || !finaleConnected(w) || x === null) return null
  let left = x, right = x
  while (w.tiles[106][left - 1] === TILE.EMPTY) left--
  while (w.tiles[106][right + 1] === TILE.EMPTY) right++
  return { left, right }
}
export const finaleClear = (w: WorldState, x: number): boolean => [103, 104, 105, 106].every(y => w.tiles[y]?.[x] === TILE.EMPTY)
export const finaleOccupies = (w: WorldState, x: number, y: number): boolean => y >= 103 && y <= 107 && w.finale.facilities.some(f => x >= f.x && x < f.x + finaleWidth(f.kind))
