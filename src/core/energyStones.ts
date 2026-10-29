import { LANDMARKS, TILE, type Cell, type Rect, type WorldState } from './world'

/**
 * 能源石：点亮家园要两块。
 *
 * 第一块在大厅左门旁，一挖就到——第一次成功要近、要快。
 * 第二块埋在右翼地面，得往右挖三格——第一次"离开大厅"的那一小步。
 * 两块都放进核心，家才真正亮起来；只装一块，核心只会轻轻亮一下。
 *
 * 这里只有石头的位置和"挖开/收好"的判定，交互与演出留给上层。
 */
export type EnergyStoneId = 'left' | 'right'

export interface EnergyStone {
  id: EnergyStoneId
  /** 石头本体所在的泥土格 */
  cell: Cell
  /** 点按收集的容错范围 */
  zone: Rect
}

export const ENERGY_STONES: readonly EnergyStone[] = [
  { id: 'left', cell: LANDMARKS.crystal, zone: LANDMARKS.crystalZone },
  { id: 'right', cell: LANDMARKS.secondCrystal, zone: LANDMARKS.secondCrystalZone },
]

/** 点亮家园需要的石头数量；改动只影响规则层，不散落在界面里。 */
export const REQUIRED_STONES = ENERGY_STONES.length

const inZone = (rect: Rect, x: number, y: number): boolean =>
  x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h

/** 石头所在的泥土已被挖开（露出石头本体）。由地图推导，不新增存档字段。 */
export function stoneRevealed(world: WorldState, stone: EnergyStone): boolean {
  return world.tiles[stone.cell.y]?.[stone.cell.x] === TILE.EMPTY
}

export function stoneFound(world: WorldState, stone: EnergyStone): boolean {
  return stone.id === 'left' ? world.progress.crystalFound : world.progress.secondCrystalFound
}

export function markStoneFound(world: WorldState, stone: EnergyStone): void {
  if (stone.id === 'left') world.progress.crystalFound = true
  else world.progress.secondCrystalFound = true
}

export function stoneCollected(world: WorldState, stone: EnergyStone): boolean {
  return stone.id === 'left' ? world.progress.crystalCollected : world.progress.secondCrystalCollected
}

export function markStoneCollected(world: WorldState, stone: EnergyStone): void {
  if (stone.id === 'left') world.progress.crystalCollected = true
  else world.progress.secondCrystalCollected = true
}

/** 点到的容错区域属于哪块石头；只按区域判定，不考虑是否已收集。 */
export function stoneAt(x: number, y: number): EnergyStone | null {
  return ENERGY_STONES.find(stone => inZone(stone.zone, x, y)) ?? null
}

export function foundStones(world: WorldState): EnergyStone[] {
  return ENERGY_STONES.filter(stone => stoneFound(world, stone))
}

export function collectedStones(world: WorldState): EnergyStone[] {
  return ENERGY_STONES.filter(stone => stoneCollected(world, stone))
}

export const collectedStoneCount = (world: WorldState): number => collectedStones(world).length

/** 还没露出来的下一块石头（没有就是 null），用于高亮与提示。 */
export function nextStoneToFind(world: WorldState): EnergyStone | null {
  return ENERGY_STONES.find(stone => !stoneFound(world, stone)) ?? null
}

/** 已经露出来、还没收好的下一块石头。 */
export function nextStoneToCollect(world: WorldState): EnergyStone | null {
  return ENERGY_STONES.find(stone => stoneFound(world, stone) && !stoneCollected(world, stone)) ?? null
}
