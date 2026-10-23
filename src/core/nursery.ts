import { canPlacePlanter, type FarmFailure } from './farm'
import { isMushroomSpot, mushroomSpots } from './exploration'
import { type Inventory, type Nursery, type WorldState } from './world'

// 发光蘑菇的点位定义在 exploration.ts（菜槽保留规则也要用）；这里再导出供面板与演出使用。
export { mushroomSpots, isMushroomSpot }

/**
 * 育苗架（2C）：第二层可自由摆放的一格设施，解锁新菜种（番茄）。
 * 这是设施面板里的第一个"升级入口"——升级必须是孩子说得出的新做法：
 * "搭起育苗架，就会种番茄了"。摆放规则与菜槽同构（复用 canPlacePlanter）。
 */

export const NURSERY_COST: Inventory = { stone: 2, wood: 2 }

export type NurseryPlacement = { ok: true } | { ok: false; reason: FarmFailure }

export function canPlaceNursery(world: WorldState, x: number, y: number): NurseryPlacement {
  // 育苗架只属于第二层：老存档第一层菜槽的兼容不适用于它。
  if (y < 18 || y >= 22) return { ok: false, reason: 'layer' }
  const check = canPlacePlanter(world, x, y)
  if (!check.ok) return check
  if (world.nurseries.some(nursery => nursery.x === x && nursery.y === y)) return { ok: false, reason: 'overlap' }
  return { ok: true }
}

export function placeNursery(world: WorldState, x: number, y: number): Nursery | null {
  if (!canPlaceNursery(world, x, y).ok) return null
  const nursery: Nursery = { id: Math.max(0, ...world.nurseries.map(item => item.id)) + 1, x, y }
  world.nurseries.push(nursery)
  return nursery
}

/** 存档校验：育苗架站在合法空地上（排除自身）；番茄苗必须真的有育苗架。 */
export function validNurseries(world: WorldState): boolean {
  const ids = new Set<number>()
  const ok = world.nurseries.every((nursery, index) => {
    if (!Number.isInteger(nursery.id) || nursery.id < 1 || ids.has(nursery.id)) return false
    ids.add(nursery.id)
    const others = { ...world, nurseries: world.nurseries.filter((_, i) => i !== index) }
    return canPlaceNursery(others, nursery.x, nursery.y).ok
  })
  if (!ok) return false
  return !world.farm.planters.some(planter => planter.crop === 'tomato') || world.nurseries.length > 0
}

/** 育苗架是否已经解锁新菜种。 */
export const tomatoUnlocked = (world: WorldState): boolean => world.nurseries.length > 0
