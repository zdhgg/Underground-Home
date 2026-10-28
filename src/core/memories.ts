import { TILE_SIZE as T, type WorldState } from './world'

/** 第一层大厅右侧的固定记忆角；它是展示位，不占用自由建设格。 */
export const MEMORY_CORNER = { x: 19, y: 8, w: 2, h: 1 } as const

export function memoryCornerVisible(world: WorldState): boolean {
  return world.progress.coreRepaired && world.memories.entries.length > 0
}

export function memoryCornerCenter(): { x: number; y: number } {
  return { x: (MEMORY_CORNER.x + MEMORY_CORNER.w / 2) * T, y: (MEMORY_CORNER.y + .55) * T }
}
