import { describe, expect, it } from 'vitest'
import { drawMemoryCorner } from '../src/render/memoryCorner'
import { createInitialWorld } from '../src/core/world'

describe('第一层记忆角', () => {
  it('没有记录时不占画面，有记录且家园点亮后显示一个纪念物', () => {
    const world = createInitialWorld()
    const empty = drawMemoryCorner(world)
    expect(empty.visible).toBe(false)

    world.progress.coreRepaired = true
    world.memories.entries.push({ id: 1, kind: 'note', title: '一起种薄荷', body: '和爸爸一起浇水。', createdAt: '2026-10-27T03:00:00.000Z' })
    const corner = drawMemoryCorner(world)
    expect(corner.visible).toBe(true)
    expect(corner.label).toBe('memory-corner')
    expect(corner.children.length).toBeGreaterThanOrEqual(2)
    empty.destroy({ children: true })
    corner.destroy({ children: true })
  })
})
