import { TILE, type Cell, type WorldState } from './world'

export const HALL_TOP = 43
export const HALL_FOOT = 46
export const HALL_FLOOR = 47
export const MURAL_SPOT: Cell = { x: 37, y: HALL_FOOT }
export const WARM_LIGHT_SPOT: Cell = { x: 11, y: HALL_FOOT }
export const hallShaftCell = (w: WorldState, x: number, y: number): boolean => x === w.exploration.shaftX && y >= 34 && y <= 42
export const hallLadderCell = (w: WorldState, x: number, y: number): boolean => w.hall.braced && x === w.exploration.shaftX && y >= 33 && y <= HALL_FOOT
export function hallFrontier(w: WorldState): Cell | null {
  const x = w.exploration.shaftX
  if (x === null) return null
  for (let y = 34; y <= 42; y++) if (w.tiles[y][x] !== TILE.EMPTY) return { x, y }
  return null
}
export const hallConnected = (w: WorldState): boolean => w.hall.braced && hallFrontier(w) === null
export function hallSpan(w: WorldState): { left: number; right: number } | null {
  const x = w.exploration.shaftX
  if (!w.hall.entered || x === null || !hallConnected(w)) return null
  let left = x, right = x
  while (w.tiles[HALL_FOOT]?.[left - 1] === TILE.EMPTY) left--
  while (w.tiles[HALL_FOOT]?.[right + 1] === TILE.EMPTY) right++
  return { left, right }
}
export function hallLadderSegments(w: WorldState): number[] {
  const rows: number[] = [], x = w.exploration.shaftX
  if (!w.hall.braced || x === null) return rows
  for (let y = 34; y <= HALL_FOOT; y++) { if (w.tiles[y][x] !== TILE.EMPTY) break; rows.push(y) }
  return rows
}
export const hallFacilityWidth = (kind: 'hall' | 'memory' | 'nest'): number => kind === 'hall' ? 8 : kind === 'nest' ? 4 : 3
export function hallOccupies(w: WorldState, x: number, y: number): boolean {
  return y >= HALL_TOP && y <= HALL_FLOOR && w.hall.facilities.some(f => x >= f.x && x < f.x + hallFacilityWidth(f.kind))
}
