import { podRect } from './build'
import { COLLECTION_SHELF } from './bag'
import { isShaftColumn } from './exploration'
import { RELICS } from './relics'
import { BUILDING_SITES } from './sites'
import { LANDMARKS, STRATA, SURFACE_Y, TILE, type Inventory, type Rect, type Shelf, type WorldState } from './world'

/**
 * 储物架（2D）：第一层可自由摆放的一格设施。
 * 材料与旧物"看得见、摆得下"——面板沿用设施框架，摆放沿用与菜槽一致的孩子能懂的规则：
 * 有地面承托、不压任何已有设施与预留地标、不在预设洞室蓝图里。
 */

export const SHELF_COST: Inventory = { stone: 1, wood: 2 }

export type ShelfFailure = 'power' | 'bounds' | 'layer' | 'soil' | 'support' | 'reserved' | 'overlap'
export type ShelfPlacement = { ok: true } | { ok: false; reason: ShelfFailure }

const overlaps = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

export function canPlaceShelf(world: WorldState, x: number, y: number): ShelfPlacement {
  if (!world.progress.coreRepaired) return { ok: false, reason: 'power' }
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 1 || x >= world.width - 1 || y < SURFACE_Y || y >= world.height) return { ok: false, reason: 'bounds' }
  if (y >= STRATA.home.bottom) return { ok: false, reason: 'layer' }
  if (world.tiles[y][x] !== TILE.EMPTY) return { ok: false, reason: 'soil' }
  if (world.tiles[y + 1]?.[x] === TILE.EMPTY) return { ok: false, reason: 'support' }
  // 预留：竖井与梯口、能源核心、能源石、大厅收藏架、裂纹柱，以及埋着旧物的格子。
  if (isShaftColumn(x) || (x >= LANDMARKS.shaft.x && x < LANDMARKS.shaft.x + LANDMARKS.shaft.w)) return { ok: false, reason: 'reserved' }
  const reserved: Rect[] = [LANDMARKS.generatorZone, { ...LANDMARKS.crystal, w: 1, h: 1 }, COLLECTION_SHELF,
    ...BUILDING_SITES.filter(site => site.layer === 'home')]
  if (reserved.some(rect => overlaps({ x, y, w: 1, h: 1 }, rect))) return { ok: false, reason: 'reserved' }
  if (RELICS.some(relic => relic.x === x && relic.y === y)) return { ok: false, reason: 'reserved' }
  // 不压睡眠舱、房间、菜槽（含旧档第一层）和其他储物架。
  if (world.pods.some(pod => overlaps({ x, y, w: 1, h: 1 }, podRect(pod)))) return { ok: false, reason: 'overlap' }
  if (world.rooms.some(room => overlaps({ x, y, w: 1, h: 1 }, room))) return { ok: false, reason: 'overlap' }
  if (world.farm.planters.some(planter => planter.x === x && planter.y === y)) return { ok: false, reason: 'overlap' }
  if (world.shelves.some(shelf => shelf.x === x && shelf.y === y)) return { ok: false, reason: 'overlap' }
  return { ok: true }
}

export function placeShelf(world: WorldState, x: number, y: number): Shelf | null {
  if (!canPlaceShelf(world, x, y).ok) return null
  const shelf: Shelf = { id: Math.max(0, ...world.shelves.map(item => item.id)) + 1, x, y }
  world.shelves.push(shelf)
  return shelf
}

/** 存档校验：架子仍然站在合法的空地上（校验时排除自己，避免和自己"重叠"）。 */
export function validShelves(world: WorldState): boolean {
  const ids = new Set<number>()
  return world.shelves.every((shelf, index) => {
    if (!Number.isInteger(shelf.id) || shelf.id < 1 || ids.has(shelf.id)) return false
    ids.add(shelf.id)
    const others = { ...world, shelves: world.shelves.filter((_, i) => i !== index) }
    return canPlaceShelf(others, shelf.x, shelf.y).ok
  })
}
