import { TILE, type Cell, type RuinsFacilityKind, type WorldState } from './world'
export const RUINS_TOP = 91, RUINS_FOOT = 94, RUINS_FLOOR = 95
export const RUINS_MOTIF_SPOTS = { lamp:{x:12,y:94}, spring:{x:30,y:94}, tools:{x:38,y:94} } as const
export const SEAL_SPOT:Cell={x:10,y:94}, FOOTPRINT_SPOT:Cell={x:36,y:94}
export const ruinsWidth = (kind: RuinsFacilityKind): number => kind === 'mosaic' ? 6 : kind === 'desk' ? 4 : kind === 'bench' ? 3 : 1
export const ruinsShaftCell = (w: WorldState, x: number, y: number): boolean => x === w.exploration.shaftX && y >= 83 && y <= 90
export const ruinsLadderCell = (w: WorldState, x: number, y: number): boolean => w.ruins.braced && x === w.exploration.shaftX && y >= 82 && y <= 94
export function ruinsFrontier(w: WorldState): Cell | null {
  const x = w.exploration.shaftX
  if (x === null) return null
  for (let y = 83; y <= 90; y++) if (w.tiles[y][x] !== TILE.EMPTY) return { x, y }
  return null
}
export const ruinsConnected = (w: WorldState): boolean => w.ruins.braced && ruinsFrontier(w) === null
export function ruinsSpan(w: WorldState): { left: number; right: number } | null {
  const x = w.exploration.shaftX
  if (!w.ruins.entered || !ruinsConnected(w) || x === null) return null
  let left = x, right = x
  while (w.tiles[94][left - 1] === TILE.EMPTY) left--
  while (w.tiles[94][right + 1] === TILE.EMPTY) right++
  return { left, right }
}
export const ruinsClear = (w: WorldState, x: number): boolean => [91, 92, 93, 94].every(y => w.tiles[y]?.[x] === TILE.EMPTY)
export const ruinsOccupies = (w: WorldState, x: number, y: number): boolean => y >= 91 && y <= 95 && w.ruins.facilities.some(f => x >= f.x && x < f.x + ruinsWidth(f.kind))
