import { TILE, type Cell, type WorldState } from './world'

/**
 * 挖掘撤销栈：只记录"挖开一格"，撤销即把这一格恢复成泥土。
 * 任务进度位不回退（设计要求：已完成的有效进度仍计入）。
 */
export interface DigHistory {
  record(x: number, y: number): void
  /** 撤销最近一次挖掘；栈空或状态异常时返回 null */
  undo(world: WorldState): Cell | null
  size(): number
}

export function createDigHistory(limit = 200): DigHistory {
  const stack: Cell[] = []
  return {
    record(x, y) {
      stack.push({ x, y })
      if (stack.length > limit) stack.shift()
    },
    undo(world) {
      const last = stack.pop()
      if (!last) return null
      // 防御：只恢复"当前确实被挖空"的格子
      if (world.tiles[last.y][last.x] !== TILE.EMPTY) return null
      world.tiles[last.y][last.x] = TILE.SOIL
      world.dugCount = Math.max(0, world.dugCount - 1)
      return last
    },
    size: () => stack.length,
  }
}
