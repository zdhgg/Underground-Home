import { TILE, type Cell, type WorldState } from './world'
import { canRestoreDig } from './build'

/**
 * 挖掘撤销栈：只记录"挖开一格"，撤销即把这一格恢复成泥土。
 * 任务进度位不回退（设计要求：已完成的有效进度仍计入）。
 *
 * 受保护规则：isProtected 命中的记录（如"已挖开的能源石"）不可撤销——
 * 遇到时会跳过该记录继续找上一条可撤销的挖掘，
 * 避免出现"任务说已找到能源石，它却被泥土重新埋回去"的矛盾状态。
 */
export interface DigHistory {
  record(x: number, y: number): void
  /** 撤销最近一次可撤销的挖掘；没有可撤销内容时返回 null */
  undo(world: WorldState, isProtected?: (x: number, y: number) => boolean): Cell | null
  size(): number
}

type WorldAction = { kind: 'dig'; x: number; y: number } | { kind: 'pod'; id: number }

/** 建造与挖掘共用LIFO撤销；记录仅限本次会话。 */
export function createWorldHistory(limit = 200) {
  const stack: WorldAction[] = []
  return {
    record(action: WorldAction): void {
      stack.push(action)
      if (stack.length > limit) stack.shift()
    },
    undo(world: WorldState): WorldAction | null {
      while (stack.length) {
        const action = stack.pop()!
        if (action.kind === 'pod') {
          const index = world.pods.findIndex((pod) => pod.id === action.id)
          if (index < 0) continue
          world.pods.splice(index, 1)
          return action
        }
        if (!canRestoreDig(world, action.x, action.y)) continue
        world.tiles[action.y][action.x] = TILE.SOIL
        world.dugCount = Math.max(0, world.dugCount - 1)
        return action
      }
      return null
    },
  }
}

export function createDigHistory(limit = 200): DigHistory {
  const stack: Cell[] = []
  return {
    record(x, y) {
      stack.push({ x, y })
      if (stack.length > limit) stack.shift()
    },
    undo(world, isProtected) {
      while (stack.length > 0) {
        const last = stack.pop()
        if (!last) break
        if (isProtected?.(last.x, last.y)) continue
        // 防御：只恢复"当前确实被挖空"的格子
        if (world.tiles[last.y][last.x] !== TILE.EMPTY) continue
        world.tiles[last.y][last.x] = TILE.SOIL
        world.dugCount = Math.max(0, world.dugCount - 1)
        return last
      }
      return null
    },
    size: () => stack.length,
  }
}
