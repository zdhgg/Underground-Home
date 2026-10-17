import { LANDMARKS, SURFACE_Y, TILE, isInside, type TileType, type WorldState } from './world'
import { isPodStructure } from './build'

/** 挖掘失败原因（翻译成儿童可读的提示由界面层负责） */
export type DigFailure =
  /** 地图边界之外 */
  | 'out-of-bounds'
  /** 地表以上 */
  | 'sky'
  /** 坚硬岩石，暂不可挖 */
  | 'rock'
  /** 已经挖空 */
  | 'empty'
  | 'facility'

export interface DigResult {
  ok: boolean
  x: number
  y: number
  /** 挖掘前的瓦片；越界时为 null */
  tile: TileType | null
  reason?: DigFailure
}

/**
 * 挖掘规则（map/dig rules，与渲染解耦）：
 * 1. 只能在地图内的地层中挖——不能挖出边界，也不能挖地表以上；
 * 2. 只有松软泥土可挖；坚硬岩石要等后续工具升级；
 * 3. 每次点击恰好只挖一格（不连带、不容错扩散）。
 */
export function canDig(world: WorldState, x: number, y: number): DigResult {
  if (!isInside(world, x, y)) return { ok: false, x, y, tile: null, reason: 'out-of-bounds' }
  const tile = world.tiles[y][x]
  if (isPodStructure(world, x, y)) return { ok: false, x, y, tile, reason: 'facility' }
  if (y < SURFACE_Y) return { ok: false, x, y, tile, reason: 'sky' }
  if (tile === TILE.ROCK) return { ok: false, x, y, tile, reason: 'rock' }
  if (tile === TILE.EMPTY) return { ok: false, x, y, tile, reason: 'empty' }
  return { ok: true, x, y, tile }
}

/** 执行挖掘：成功时恰好挖开一格并计入统计；失败时世界保持不变 */
export function dig(world: WorldState, x: number, y: number): DigResult {
  const result = canDig(world, x, y)
  if (result.ok) {
    world.tiles[y][x] = TILE.EMPTY
    world.dugCount += 1
    // 挖开能源石所在的泥土 = 发现能源石。进度位单调，撤销不会回退它。
    if (x === LANDMARKS.crystal.x && y === LANDMARKS.crystal.y) {
      world.progress.crystalFound = true
    }
  }
  return result
}
