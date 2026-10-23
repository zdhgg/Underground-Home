import { TILE, type Inventory, type TileType, type WorldState } from './world'

export const MATERIAL_NAMES = { stone: '石料', wood: '旧木料', clay: '红黏土' } as const

/** 泉边偏红的土层：挖这些格子得到红黏土（发现物 + 后续装饰材料，本阶段不做配方）。 */
export function isClayCell(x: number, y: number): boolean {
  return y >= 19 && y <= 20 && x >= 19 && x <= 21
}

/** 固定掉落，撤销后重挖不会换一种材料；每次真实开挖才获得。 */
export function digLoot(x: number, y: number, tile: TileType): Inventory {
  return tile === TILE.SOIL ? (isClayCell(x, y) ? { stone: 0, wood: 0, clay: 1 } : Math.abs(x + y) % 3 === 0 ? { stone: 0, wood: 1 } : { stone: 1, wood: 0 })
    : tile === TILE.WEAK_ROCK ? { stone: 1, wood: 0 } : { stone: 0, wood: 0 }
}
export const canAfford = (w: WorldState, cost: Inventory): boolean => w.inventory.stone >= cost.stone && w.inventory.wood >= cost.wood
export function changeMaterials(w: WorldState, amount: Inventory, sign = 1): void {
  w.inventory.stone += amount.stone * sign; w.inventory.wood += amount.wood * sign
  if (amount.clay) w.inventory.clay = Math.max(0, (w.inventory.clay ?? 0) + amount.clay * sign)
}
export const materialText = (amount: Inventory): string => [
  amount.stone ? `石料 ${amount.stone}` : '',
  amount.wood ? `旧木料 ${amount.wood}` : '',
  amount.clay ? `红黏土 ${amount.clay}` : '',
].filter(Boolean).join(' · ')
export const PLANTER_COST: Inventory = { stone: 1, wood: 1 }
