import { TILE, type Cell, type GardenFacilityKind, type WorldState } from './world'
export const GARDEN_TOP = 55, GARDEN_FOOT = 58, GARDEN_FLOOR = 59
export const TAITAI_SPOT: Cell = { x: 36, y: GARDEN_FOOT }
export const SPORE_SPOT: Cell = { x: 11, y: GARDEN_FOOT }, ROOT_SPOT: Cell = { x: 38, y: GARDEN_FOOT }
export const gardenWidth = (kind: GardenFacilityKind): number => kind === 'bed' || kind === 'nest' ? 4 : kind === 'lamp' ? 1 : 3
export const gardenShaftCell = (w: WorldState, x: number, y: number): boolean => x === w.exploration.shaftX && y >= 47 && y <= 54
export const gardenLadderCell = (w: WorldState, x: number, y: number): boolean => w.garden.drained && x === w.exploration.shaftX && y >= 46 && y <= GARDEN_FOOT
export function gardenFrontier(w: WorldState): Cell | null {
  const x = w.exploration.shaftX
  if (x === null) return null
  for (let y = 47; y <= 54; y++) if (w.tiles[y][x] !== TILE.EMPTY) return { x, y }
  return null
}
export const gardenConnected = (w: WorldState): boolean => w.garden.drained && gardenFrontier(w) === null
export function gardenSpan(w: WorldState): { left: number; right: number } | null {
  const x = w.exploration.shaftX
  if (!w.garden.entered || !gardenConnected(w) || x === null) return null
  let left = x, right = x
  while (w.tiles[GARDEN_FOOT][left - 1] === TILE.EMPTY) left--
  while (w.tiles[GARDEN_FOOT][right + 1] === TILE.EMPTY) right++
  return { left, right }
}
export const gardenClearColumn = (w: WorldState, x: number): boolean => [55, 56, 57, 58].every(y => w.tiles[y]?.[x] === TILE.EMPTY)
export const gardenOccupies = (w: WorldState, x: number, y: number): boolean => y >= GARDEN_TOP && y <= GARDEN_FLOOR && w.garden.facilities.some(f => x >= f.x && x < f.x + gardenWidth(f.kind))

/** 灯照两格；苔苔铺的真实连续菌毯把光传进菌床，岩石会切断传播。 */
export function gardenLight(w: WorldState): Set<number> {
  const lit = new Set<number>()
  if (!w.garden.entered) return lit
  for (const lamp of w.garden.facilities.filter(f => f.kind === 'lamp')) for (const direction of [-1, 1]) for (let d = 0; d <= 2; d++) {
    const x = lamp.x + d * direction
    if (!gardenClearColumn(w, x)) break
    lit.add(x)
  }
  const trail = new Set(w.garden.trail.filter(x => gardenClearColumn(w, x))), queue = [...trail].filter(x => lit.has(x))
  for (let i = 0; i < queue.length; i++) for (const x of [queue[i] - 1, queue[i] + 1]) if (trail.has(x) && !lit.has(x)) { lit.add(x); queue.push(x) }
  return lit
}
