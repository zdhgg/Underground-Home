import { TILE, type Inventory, type TileType, type WorldState } from './world'

export const MATERIAL_NAMES = { stone: '石料', wood: '旧木料' } as const
/** 固定掉落，撤销后重挖不会换一种材料；每次真实开挖才获得。 */
export function digLoot(x: number, y: number, tile: TileType): Inventory {
  return tile === TILE.SOIL ? (Math.abs(x + y) % 3 === 0 ? { stone: 0, wood: 1 } : { stone: 1, wood: 0 })
    : tile === TILE.WEAK_ROCK ? { stone: 1, wood: 0 } : { stone: 0, wood: 0 }
}
export const canAfford = (w: WorldState, cost: Inventory): boolean => w.inventory.stone >= cost.stone && w.inventory.wood >= cost.wood
export function changeMaterials(w: WorldState, amount: Inventory, sign = 1): void {
  w.inventory.stone += amount.stone * sign; w.inventory.wood += amount.wood * sign
}
export const materialText = (amount: Inventory): string => [amount.stone ? `石料 ${amount.stone}` : '', amount.wood ? `旧木料 ${amount.wood}` : ''].filter(Boolean).join(' · ')
export const PLANTER_COST: Inventory = { stone: 1, wood: 1 }
