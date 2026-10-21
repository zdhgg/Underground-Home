import { LANDMARKS, STRATA, SURFACE_Y, TILE, WATER_FLOOR_Y, isInside, type Cell, type Planter, type WorldState } from './world'
import { isShaftColumn } from './exploration'
import { podRect } from './build'
import { RELICS } from './relics'

/**
 * 引水与种植（规则层，与渲染无关）。
 *
 * 水在第二层的泉水边接通，菜园也建在第二层；作物不用真实时间生长——
 * 玩家每亲自做一件事（挖土、破岩、建造、安灯、收获）就长一档，孩子随时收。
 * 旧存档里第一层的菜槽继续可用，只作为兼容，不再作为新玩家的引导目标。
 */
export const RIPE_STAGE = 3

export type FarmFailure = 'no-water' | 'layer' | 'bounds' | 'soil' | 'support' | 'reserved' | 'overlap'
export type PlanterPlacement = { ok: true } | { ok: false; reason: FarmFailure }

/** 找到泉水、但还没接进菜园 */
export function canSupplyWater(world: WorldState): boolean {
  return world.exploration.springFound && !world.farm.waterSupplied
}

export const isFarmUnlocked = (world: WorldState): boolean => world.farm.waterSupplied

export const ripePlanters = (world: WorldState): Planter[] => world.farm.planters.filter((planter) => planter.growth >= RIPE_STAGE)

export const planterAt = (world: WorldState, x: number, y: number): Planter | null =>
  world.farm.planters.find((planter) => planter.x === x && planter.y === y) ?? null

/**
 * 一格种植槽：已挖空、有承托，不压核心 / 竖井 / 睡眠舱 / 遗物 / 泉眼。
 * 新菜园在第二层；第一层仍允许旧档里的菜槽通过校验，不再作为引导目标。
 */
export function canPlacePlanter(world: WorldState, x: number, y: number): PlanterPlacement {
  if (!isFarmUnlocked(world)) return { ok: false, reason: 'no-water' }
  if (!Number.isInteger(x) || !Number.isInteger(y) || !isInside(world, x, y)) return { ok: false, reason: 'bounds' }
  const onHome = y >= SURFACE_Y && y < STRATA.home.bottom
  const onWater = y >= 18 && y < WATER_FLOOR_Y
  if (!onHome && !onWater) return { ok: false, reason: 'layer' }
  // 第二层要真正下去过，不能在梯子上隔着岩层种菜。
  if (onWater && !world.exploration.entered) return { ok: false, reason: 'layer' }
  if (world.tiles[y][x] !== TILE.EMPTY) return { ok: false, reason: 'soil' }
  if (world.tiles[y + 1]?.[x] === TILE.EMPTY) return { ok: false, reason: 'support' }
  if (isShaftColumn(x) || (x >= LANDMARKS.shaft.x && x < LANDMARKS.shaft.x + LANDMARKS.shaft.w)) return { ok: false, reason: 'reserved' }
  if (onWater && Math.abs(x - LANDMARKS.spring.x) <= 1) return { ok: false, reason: 'reserved' }
  const reserved = [LANDMARKS.generatorZone, { ...LANDMARKS.crystal, w: 1, h: 1 }]
  if (reserved.some((rect) => x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h)) return { ok: false, reason: 'reserved' }
  if (RELICS.some((relic) => relic.x === x && relic.y === y)) return { ok: false, reason: 'reserved' }
  if (world.pods.some((pod) => {
    const rect = podRect(pod)
    return x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h
  })) return { ok: false, reason: 'overlap' }
  if (world.farm.planters.some((planter) => planter.x === x && planter.y === y)) return { ok: false, reason: 'overlap' }
  return { ok: true }
}

export function placePlanter(world: WorldState, x: number, y: number): Planter | null {
  if (!canPlacePlanter(world, x, y).ok) return null
  const planter: Planter = { id: Math.max(0, ...world.farm.planters.map((item) => item.id)) + 1, x, y, growth: 0 }
  world.farm.planters.push(planter)
  return planter
}

/** 收获：成熟的槽自动重新种下一颗，食物 +1；harvests 只增不减 */
export function harvestPlanter(world: WorldState, x: number, y: number): boolean {
  const planter = world.farm.planters.find((item) => item.x === x && item.y === y)
  if (!planter || planter.growth < RIPE_STAGE) return false
  planter.growth = 0
  world.farm.food += 1
  world.farm.harvests += 1
  return true
}

/** 请伙伴吃饭：消耗一份食物 */
export function feedPartners(world: WorldState): boolean {
  if (world.farm.food <= 0 || world.pods.length === 0) return false
  world.farm.food -= 1
  return true
}

/**
 * 玩家亲自做完一件事：所有作物长一档（到成熟为止）。
 * 收成不靠等待，所以这里刻意不做任何时间判断。
 */
export function advancePlanters(world: WorldState): Cell[] {
  const grown: Cell[] = []
  for (const planter of world.farm.planters) {
    if (planter.growth >= RIPE_STAGE) continue
    planter.growth += 1
    grown.push({ x: planter.x, y: planter.y })
  }
  return grown
}
